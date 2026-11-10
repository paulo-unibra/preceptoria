import { setImmediate as yieldToEventLoop } from 'node:timers/promises'
import { createCanvas, ImageData } from '@napi-rs/canvas'
import { getDocument, OPS, Util, type PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { ImportedProfile, ImportedSection } from '../types/student_import.js'
import { invalid } from '#support/errors'

interface PositionedText {
  text: string
  x: number
  y: number
  width: number
}
export interface ParsedStudent {
  fullName: string
  registration: string
  birthDate: string | null
  profile: ImportedProfile
  photo: Buffer | null
}
export interface ParsedStudentPdf {
  classroomName: string
  schoolYear: number
  pages: number
  students: ParsedStudent[]
}

export const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
const keyFor = (value: string) =>
  normalizeText(value)
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()

export function classroomFromFilename(filename: string) {
  const match = normalizeText(filename).match(
    /(?:_|-)\s*(\d{1,2})\s*[º°Oª]?\s*(?:ANO|SERIE)\s+([A-Z][A-Z0-9 -]*)\.PDF$/
  )
  if (!match)
    throw invalid(
      'Não foi possível identificar a turma. Use um nome como "FICHA DO ESTUDANTE_9º ANO A.pdf".',
      'E_IMPORT_CLASSROOM'
    )
  return `${Number(match[1])}º ANO ${match[2].trim()}`
}

export function classroomKey(name: string) {
  return normalizeText(name)
    .replace(/[º°ª]/g, '')
    .replace(/\b(ANO|SERIE)\b/g, '')
    .replace(/[^A-Z0-9]/g, '')
}

export function normalizedDate(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, day, month, year] = match
  if (Number(year) < 1900 || Number(year) > new Date().getFullYear()) return null
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`)
  return Number.isFinite(date.getTime()) &&
    date.getUTCDate() === Number(day) &&
    date.getUTCMonth() + 1 === Number(month)
    ? `${year}-${month}-${day}`
    : null
}

const headings: Record<string, [string, string]> = {
  'IDENTIFICACAO': ['identification', 'Identificação'],
  'FILIACAO': ['parents', 'Filiação'],
  'RESPONSAVEL PELA MATRICULA': ['enrollment_guardian', 'Responsável pela matrícula'],
  'RESPONSAVEL PELO ESTUDANTE': ['student_guardian', 'Responsável pelo estudante'],
  'DADOS PESSOAIS': ['personal', 'Dados pessoais'],
  'INFORMACOES SOBRE PESSOA COM DEFICIENCIA (PCD)': ['special_education', 'Educação especial'],
  'LOCALIZACAO': ['address', 'Endereço do estudante'],
  'DOCUMENTACAO': ['documents', 'Documentação'],
  'BOLSA FAMILIA': ['benefit', 'Bolsa Família'],
  'CONTATO DO ESTUDANTE:': ['contact', 'Contato do estudante'],
  'INFORMACOES ESCOLARES': ['schooling', 'Informações escolares'],
  'INFORMACOES ADICIONAIS': ['additional', 'Informações adicionais'],
  'TRANSPORTE ESCOLAR': ['transport', 'Transporte escolar'],
}

const parentFlags = new Set([
  'MAE NAO DECLARADA',
  'PAI NAO DECLARADO',
  'MAE FALECIDA',
  'PAI FALECIDO',
])
function isField(item: PositionedText) {
  return (
    item.text.endsWith(':') || item.text.endsWith('?') || parentFlags.has(normalizeText(item.text))
  )
}

function normalizeField(
  raw: string | null,
  label: string,
  section: string,
  warnings: string[]
): string | null {
  if (!raw || /^(NAO INFORMADO|NI|N\/I|SEM INFORMACAO)$/i.test(normalizeText(raw))) return null
  const key = normalizeText(label)
  const warn = (reason: string) => {
    warnings.push(
      `${label.replace(/:$/, '')}: ${reason}. O valor original foi preservado na ficha.`
    )
    return null
  }
  if (key.includes('DATA')) return normalizedDate(raw) ?? warn('data inválida ou não informada')
  if (key === 'UF:') return /^[A-Z]{2}$/i.test(raw) ? raw.toUpperCase() : warn('UF inválida')
  if (key === 'CEP:')
    return /^\d{5}-?\d{3}$/.test(raw) ? raw.replace(/\D/g, '') : warn('CEP inválido')
  if (key === 'CPF:' && section !== 'additional') {
    const digits = raw.replace(/\D/g, '')
    return digits.length === 11 && !/^(\d)\1+$/.test(digits)
      ? digits
      : warn('CPF ausente ou fora do formato')
  }
  if (key === 'CELULAR:' && section !== 'schooling') {
    const digits = raw.replace(/\D/g, '')
    return /^\d{10,11}$/.test(digits) && !/^\d{0,2}0{8,}$/.test(digits) && !/9{8,}/.test(digits)
      ? digits
      : warn('telefone ausente ou fora do formato')
  }
  if (key === 'E-MAIL:')
    return /^[^\s@*]+@[^\s@*]+\.[A-Za-z]{2,}$/.test(raw)
      ? raw.toLowerCase()
      : warn('e-mail inválido ou mascarado')
  if (['RG:', 'NIS:', 'SUS:'].includes(key) && /^0+$/.test(raw.replace(/\D/g, '')))
    return warn('documento preenchido apenas com zeros')
  return raw
}

/** A geometria separa as colunas: valores vazios nunca consomem o campo vizinho. */
export function extractSections(items: PositionedText[], pageHeight: number, warnings: string[]) {
  const starts = items
    .flatMap((item) => {
      const heading = headings[normalizeText(item.text)]
      return heading && item.y > 130 && item.y < pageHeight - 55
        ? [{ ...item, key: heading[0], title: heading[1] }]
        : []
    })
    .sort((a, b) => a.y - b.y)
  const result: ImportedSection[] = []
  for (const [index, section] of starts.entries()) {
    const bottom = starts[index + 1]?.y ?? pageHeight - 55
    const content = items.filter((item) => item.y > section.y + 2 && item.y < bottom - 3)
    const labels = content.filter(isField)
    const groups: ImportedSection[] =
      section.key === 'parents'
        ? [
            { key: 'mother', title: 'Mãe', fields: [] },
            { key: 'father', title: 'Pai', fields: [] },
          ]
        : [{ key: section.key, title: section.title, fields: [] }]
    for (const label of labels) {
      const normalizedLabel = normalizeText(label.text)
      const checkbox = label.text.endsWith('?') || parentFlags.has(normalizedLabel)
      const group = section.key === 'parents' ? groups[label.x < 290 ? 0 : 1] : groups[0]
      let fieldKey = keyFor(label.text)
      if (section.key === 'additional' && normalizedLabel === 'CPF:') fieldKey = 'uniform_item'
      if (section.key === 'schooling' && normalizedLabel === 'CELULAR:')
        fieldKey = 'previous_school'
      const duplicateCount = group.fields.filter(
        (field) => field.key === fieldKey || field.key.startsWith(`${fieldKey}_`)
      ).length
      if (duplicateCount) fieldKey += `_${duplicateCount + 1}`
      if (checkbox) {
        const checked = items.some(
          (item) =>
            /^X$/i.test(item.text) &&
            Math.abs(item.y - label.y) < 3 &&
            item.x < label.x &&
            item.x > label.x - 22
        )
        group.fields.push({
          key: fieldKey,
          label: label.text,
          value: checked,
          raw_value: checked ? 'X' : null,
        })
        continue
      }
      const right = Math.min(
        ...labels
          .filter((item) => Math.abs(item.y - label.y) < 3 && item.x > label.x + 5)
          .map((item) => item.x - 2),
        580
      )
      const nextY = Math.min(
        ...labels
          .filter((item) => item.y > label.y + 3 && item.x >= label.x - 2 && item.x < right)
          .map((item) => item.y - 2),
        label.y + 35,
        bottom - 3
      )
      const values = content
        .filter(
          (item) =>
            !isField(item) &&
            item.y > label.y + 3 &&
            item.y < nextY &&
            item.x >= label.x - 2 &&
            item.x < right &&
            !/^X$/i.test(item.text)
        )
        .sort((a, b) => a.y - b.y || a.x - b.x)
      const raw =
        values
          .map((item) => item.text)
          .join(' ')
          .trim() || null
      const displayLabel =
        fieldKey === 'uniform_item'
          ? 'Peça do uniforme (rótulo CPF no documento)'
          : fieldKey === 'previous_school'
            ? 'Escola anterior (rótulo Celular no documento)'
            : label.text.replace(/:$/, '')
      group.fields.push({
        key: fieldKey,
        label: displayLabel,
        raw_value: raw,
        value: normalizeField(raw, label.text, section.key, warnings),
      })
    }
    result.push(...groups)
  }
  return result
}

export function profileValue(profile: ImportedProfile, section: string, key: string) {
  return (
    profile.sections.find((item) => item.key === section)?.fields.find((field) => field.key === key)
      ?.value ?? null
  )
}

function schoolSection(items: PositionedText[]): ImportedSection {
  const header = items.filter((item) => item.y < 130)
  const fields: [string, string, string | null][] = [
    [
      'authority',
      'Secretaria',
      header.find((item) => normalizeText(item.text).startsWith('SECRETARIA'))?.text ?? null,
    ],
    [
      'school_name',
      'Escola',
      header.find((item) => /^(EREF|EREM|ESCOLA|EMEF)\b/i.test(item.text))?.text ?? null,
    ],
    [
      'school_cnpj',
      'CNPJ da escola',
      header
        .find((item) => /^CNPJ:/i.test(item.text) && item.y > 55)
        ?.text.replace(/^CNPJ:\s*/i, '') ?? null,
    ],
    [
      'school_address',
      'Endereço da escola',
      header.find((item) => item.y > 72 && item.y < 90)?.text ?? null,
    ],
    [
      'inep',
      'INEP',
      header.find((item) => /^INEP:/i.test(item.text))?.text.replace(/^INEP:\s*/i, '') ?? null,
    ],
    [
      'school_registration',
      'Cadastro escolar',
      header
        .find((item) => /^CADASTRO ESCOLAR:/i.test(item.text))
        ?.text.replace(/^CADASTRO ESCOLAR:\s*/i, '') ?? null,
    ],
    [
      'diary_number',
      'Número do diário',
      header
        .find((item) => /DI[AÁ]RIO:/i.test(item.text))
        ?.text.split(':')
        .slice(1)
        .join(':')
        .trim() ?? null,
    ],
  ]
  return {
    key: 'school',
    title: 'Unidade escolar',
    fields: fields.map(([key, label, value]) => ({ key, label, value, raw_value: value })),
  }
}

type PdfImage = {
  width: number
  height: number
  kind: number
  data: Uint8Array | Uint8ClampedArray
}
/** Usa a posição do objeto de imagem, não sua ordem: brasões e QR codes são ignorados. */
async function extractPortrait(page: PDFPageProxy): Promise<Buffer | null> {
  const viewport = page.getViewport({ scale: 1 })
  const operators = await page.getOperatorList()
  let matrix = [1, 0, 0, 1, 0, 0]
  const stack: number[][] = []
  for (let i = 0; i < operators.fnArray.length; i++) {
    const fn = operators.fnArray[i]
    const args = operators.argsArray[i]
    if (fn === OPS.save) stack.push([...matrix])
    else if (fn === OPS.restore) matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0]
    else if (fn === OPS.transform) matrix = Util.transform(matrix, args)
    else if (fn === OPS.paintImageXObject) {
      const [left, top, right, bottom] = viewport.convertToViewportRectangle([
        matrix[4],
        matrix[5] + matrix[3],
        matrix[4] + matrix[0],
        matrix[5],
      ])
      if (
        left < viewport.width * 0.8 ||
        top < viewport.height * 0.14 ||
        top > viewport.height * 0.25 ||
        right - left < 25 ||
        bottom - top < 40
      )
        continue
      const objects = String(args[0]).startsWith('g_') ? page.commonObjs : page.objs
      const image = await new Promise<PdfImage>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Tempo excedido ao ler imagem.')), 5000)
        objects.get(args[0], (value: PdfImage) => {
          clearTimeout(timer)
          resolve(value)
        })
      })
      if (
        !image.data ||
        image.width < 40 ||
        image.height < 40 ||
        image.width * image.height > 12_000_000
      )
        continue
      const rgba = new Uint8ClampedArray(image.width * image.height * 4)
      if (image.kind === 3) rgba.set(image.data)
      else if (image.kind === 2) {
        for (let pixel = 0; pixel < image.width * image.height; pixel++) {
          rgba[pixel * 4] = image.data[pixel * 3]
          rgba[pixel * 4 + 1] = image.data[pixel * 3 + 1]
          rgba[pixel * 4 + 2] = image.data[pixel * 3 + 2]
          rgba[pixel * 4 + 3] = 255
        }
      } else continue
      const source = createCanvas(image.width, image.height)
      source.getContext('2d').putImageData(new ImageData(rgba, image.width, image.height), 0, 0)
      const scale = Math.min(1, 640 / Math.max(image.width, image.height))
      const output = createCanvas(Math.round(image.width * scale), Math.round(image.height * scale))
      output.getContext('2d').drawImage(source, 0, 0, output.width, output.height)
      const encoded = output.toBuffer('image/jpeg', 88)
      // Libera os buffers nativos a cada foto, sem depender do ciclo de GC do V8.
      source.width = source.height = 1
      output.width = output.height = 1
      return encoded
    }
  }
  return null
}

/** Parser do modelo SGGE/Sicap. Um novo bloco começa por matrícula + nome, nunca por índice fixo. */
export async function parseStudentPdf(buffer: Buffer, filename: string): Promise<ParsedStudentPdf> {
  const classroomName = classroomFromFilename(filename)
  const task = getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
    // Evita decodificar brasões gigantes do cabeçalho em servidores de pouca memória.
    maxImageSize: 4_000_000,
    stopAtErrors: false,
    verbosity: 0,
  })
  const deadline = setTimeout(() => {
    void task.destroy()
  }, 90_000)
  try {
    const document = await task.promise
    if (!document.numPages || document.numPages > 300)
      throw invalid('Envie um PDF com até 300 páginas.', 'E_IMPORT_LIMIT')
    const students: ParsedStudent[] = []
    const years = new Set<number>()
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      await yieldToEventLoop()
      const page = await document.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      const items: PositionedText[] = content.items.flatMap((item) =>
        'str' in item && item.str.trim()
          ? [
              {
                text: item.str.trim(),
                x: item.transform[4],
                y: viewport.convertToViewportPoint(item.transform[4], item.transform[5])[1],
                width: item.width,
              },
            ]
          : []
      )
      const year = items
        .find((item) => /ANO LETIVO:\s*\d{4}/i.test(item.text))
        ?.text.match(/\d{4}/)?.[0]
      if (year) years.add(Number(year))
      else throw invalid(`Ano letivo ausente na página ${pageNumber}.`, 'E_IMPORT_YEAR')
      const registration = items
        .find((item) => /^MATR[IÍ]CULA:\s*\d+/i.test(item.text))
        ?.text.match(/\d+/)?.[0]
      if (!registration && items.some((item) => normalizeText(item.text) === 'NOME ALUNO:'))
        throw invalid(
          `A ficha da página ${pageNumber} está sem matrícula. Nenhum aluno foi importado.`,
          'E_IMPORT_IDENTITY'
        )
      if (registration) {
        if (registration.length > 40)
          throw invalid(`Matrícula inválida na página ${pageNumber}.`, 'E_IMPORT_IDENTITY')
        if (!items.some((item) => normalizeText(item.text) === 'NOME ALUNO:'))
          throw invalid(
            `A página ${pageNumber} tem matrícula sem identificação do aluno.`,
            'E_IMPORT_LAYOUT'
          )
        students.push({
          fullName: '',
          registration,
          birthDate: null,
          photo: null,
          profile: {
            version: 1,
            school_year: Number(year),
            school_name:
              items.find((item) => item.y < 100 && /^(EREF|EREM|ESCOLA|EMEF)\b/.test(item.text))
                ?.text ?? null,
            source: { filename, pages: [], text: [] },
            sections: [schoolSection(items)],
            warnings: [],
          },
        })
      }
      const current = students.at(-1)
      if (!current)
        throw invalid(
          `Não foi encontrada uma ficha de estudante na página ${pageNumber}. PDFs digitalizados sem texto precisam de OCR.`,
          'E_IMPORT_LAYOUT'
        )
      const sections = extractSections(items, viewport.height, current.profile.warnings)
      if (!sections.length)
        throw invalid(
          `A página ${pageNumber} não corresponde ao modelo de ficha SGGE/Sicap.`,
          'E_IMPORT_LAYOUT'
        )
      if (
        sections.some((section) =>
          current.profile.sections.some((previous) => previous.key === section.key)
        )
      )
        throw invalid(
          `Seção repetida na página ${pageNumber}. Confira a ordem e as matrículas das fichas.`,
          'E_IMPORT_LAYOUT'
        )
      current.profile.sections.push(...sections)
      current.profile.source.pages.push(pageNumber)
      current.profile.source.text.push(
        items
          .slice()
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map((item) => item.text)
          .join('\n')
      )
      if (registration) {
        const name = profileValue(current.profile, 'identification', 'nome_aluno')
        const birthDate = profileValue(current.profile, 'identification', 'data_de_nascimento')
        current.fullName = typeof name === 'string' ? name : ''
        current.birthDate = typeof birthDate === 'string' ? birthDate : null
        if (!current.fullName || current.fullName.length > 160)
          throw invalid(`Nome ausente ou inválido na página ${pageNumber}.`, 'E_IMPORT_IDENTITY')
        try {
          current.photo = await extractPortrait(page)
        } catch {
          current.profile.warnings.push('A foto desta ficha não pôde ser extraída.')
        }
        if (!current.photo)
          current.profile.warnings.push('Sem foto extraível na área de identificação.')
      }
      page.cleanup()
    }
    if (
      years.size !== 1 ||
      !Number.isInteger([...years][0]) ||
      [...years][0] < 2000 ||
      [...years][0] > 2100
    )
      throw invalid('O PDF deve informar um único ano letivo válido.', 'E_IMPORT_YEAR')
    const seen = new Set<string>()
    for (const student of students) {
      if (seen.has(student.registration))
        throw invalid(
          'O PDF contém matrículas repetidas. Confira o arquivo antes de importar.',
          'E_IMPORT_DUPLICATE'
        )
      seen.add(student.registration)
      const primaryName = profileValue(student.profile, 'student_guardian', 'nome_completo')
      const enrollmentName = profileValue(student.profile, 'enrollment_guardian', 'nome_completo')
      const primaryBirth = profileValue(student.profile, 'student_guardian', 'data_nascimento')
      const enrollmentBirth = profileValue(
        student.profile,
        'enrollment_guardian',
        'data_nascimento'
      )
      if (
        typeof primaryName === 'string' &&
        typeof enrollmentName === 'string' &&
        normalizeText(primaryName) === normalizeText(enrollmentName) &&
        primaryBirth &&
        enrollmentBirth &&
        primaryBirth !== enrollmentBirth
      )
        student.profile.warnings.push(
          'O mesmo responsável tem datas de nascimento diferentes nas duas seções do PDF. As duas versões foram preservadas.'
        )
      const studentCpf = profileValue(student.profile, 'documents', 'cpf')
      if (
        studentCpf &&
        ['mother', 'father', 'student_guardian'].some(
          (section) => profileValue(student.profile, section, 'cpf') === studentCpf
        )
      )
        student.profile.warnings.push(
          'O CPF informado para o estudante também consta para um responsável. Confira a documentação de origem.'
        )
      if (
        !['personal', 'contact', 'transport'].every((key) =>
          student.profile.sections.some((section) => section.key === key)
        )
      )
        throw invalid(
          `A ficha iniciada na página ${student.profile.source.pages[0]} está incompleta. Envie todas as páginas.`,
          'E_IMPORT_INCOMPLETE'
        )
    }
    return { classroomName, schoolYear: [...years][0], pages: document.numPages, students }
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) throw error
    throw invalid(
      'Não foi possível ler o PDF. Verifique se está íntegro, sem senha e no modelo SGGE/Sicap.',
      'E_IMPORT_PDF'
    )
  } finally {
    clearTimeout(deadline)
    await task.destroy()
  }
}
