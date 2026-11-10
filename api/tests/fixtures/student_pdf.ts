import PDFDocument from 'pdfkit'
import { createCanvas } from '@napi-rs/canvas'

/** Documento artificial: não contém dados do PDF real nem fotos de estudantes. */
export async function makeStudentPdf(
  options: {
    name?: string
    registration?: string
    photo?: boolean
    complete?: boolean
    year?: number
    second?: boolean
    largeLogo?: boolean
  } = {}
) {
  const doc = new PDFDocument({ size: [595, 842], margin: 0, autoFirstPage: false })
  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  const text = (value: string, x: number, y: number) => {
    doc.font('Helvetica').fontSize(8).text(value, x, y, { lineBreak: false })
  }
  const field = (label: string, value: string, x: number, y: number) => {
    text(label, x, y)
    if (value) text(value, x + 2, y + 12)
  }
  function header() {
    doc.addPage()
    if (options.largeLogo) {
      const logo = createCanvas(2600, 2600)
      logo.getContext('2d').fillStyle = '#e2d6bd'
      logo.getContext('2d').fillRect(0, 0, 2600, 2600)
      doc.image(logo.toBuffer('image/jpeg'), 23, 20, { width: 64, height: 64 })
      logo.width = logo.height = 1
    }
    text('EREF ESCOLA DE TESTE', 220, 60)
    text(`ANO LETIVO: ${options.year ?? 2026}`, 473, 125)
  }
  function student(name: string, registration: string) {
    header()
    text('IDENTIFICACAO', 23, 139)
    text(`MATRICULA: ${registration}`, 463, 139)
    field('NOME ALUNO:', name, 20, 155)
    field('NOME SOCIAL:', '', 20, 179)
    field('DATA DE NASCIMENTO:', '15/05/2012', 20, 203)
    field('SEXO:', 'FEMININO', 20, 227)
    if (options.photo !== false) {
      const photo = createCanvas(80, 100)
      photo.getContext('2d').fillStyle = '#b2c8af'
      photo.getContext('2d').fillRect(0, 0, 80, 100)
      doc.image(photo.toBuffer('image/jpeg'), 492, 145, { width: 80, height: 100 })
    }
    text('FILIACAO', 23, 257)
    text('MAE NAO DECLARADA', 40, 271)
    text('PAI NAO DECLARADO', 320, 271)
    field('NOME:', 'RESPONSAVEL DE TESTE', 20, 307)
    field('NOME:', 'PAI DE TESTE', 300, 307)
    field('CPF:', '00000000000', 20, 331)
    field('CPF:', '', 300, 331)
    field('CELULAR:', '(81) 99912-3456', 20, 379)
    field('CELULAR:', '(00) 0 0000-0000', 300, 379)
    text('RESPONSAVEL PELA MATRICULA', 23, 432)
    field('GRAU DE PARENTESCO:', 'MAE', 20, 446)
    field('NOME COMPLETO:', 'RESPONSAVEL DE TESTE', 20, 470)
    field('CPF:', '00000000000', 20, 494)
    field('CELULAR:', '(81) 99912-3456', 213, 494)
    field('DATA NASCIMENTO:', '01/01/0001', 400, 494)
    text('RESPONSAVEL PELO ESTUDANTE', 23, 597)
    field('GRAU DE PARENTESCO:', 'MAE', 20, 611)
    field('NOME COMPLETO:', 'RESPONSAVEL DE TESTE', 20, 635)
    field('CELULAR:', '(81) 99912-3456', 213, 659)
    if (options.complete === false) return
    header()
    text('DADOS PESSOAIS', 23, 143)
    field('NATURALIDADE:', 'PE', 20, 160)
    text('INFORMACOES SOBRE PESSOA COM DEFICIENCIA (PCD)', 23, 256)
    text('X', 27, 271)
    text('O ESTUDANTE E PUBLICO ALVO DA EDUCACAO ESPECIAL?', 38, 271)
    field('DEFICIENCIA:', 'INFORMACAO DE TESTE', 20, 296)
    text('LOCALIZACAO', 23, 333)
    field('CEP:', '53700-000', 20, 359)
    field('LOGRADOURO:', 'RUA DE TESTE', 20, 383)
    field('NUMERO:', '12', 450, 383)
    text('DOCUMENTACAO', 23, 489)
    field('CPF:', '', 35, 524)
    field('NIS:', '12345678900', 220, 524)
    field('SUS:', '0000000000000', 405, 524)
    header()
    text('BOLSA FAMILIA', 23, 143)
    field('RESPONSAVEL:', 'RESPONSAVEL DE TESTE', 20, 160)
    text('CONTATO DO ESTUDANTE:', 23, 330)
    field('CELULAR:', '', 20, 350)
    field('E-MAIL:', 'aluno@example.test', 170, 350)
    text('INFORMACOES ESCOLARES', 23, 400)
    field('CELULAR:', 'ESCOLA ANTERIOR DE TESTE', 20, 420)
    field('EDUCACENSO:', '012345678901', 20, 450)
    text('INFORMACOES ADICIONAIS', 23, 490)
    field('CPF:', 'CAMISA', 80, 510)
    field('TAMANHO :', 'M', 400, 510)
    text('TRANSPORTE ESCOLAR', 23, 650)
    field('DEPENDE DE TRANSPORTE ESCOLAR:', 'NAO', 20, 675)
  }
  student(options.name ?? 'ALUNA DE TESTE', options.registration ?? '900000000001')
  if (options.second) student('SEGUNDA ALUNA DE TESTE', '900000000002')
  doc.end()
  return done
}
