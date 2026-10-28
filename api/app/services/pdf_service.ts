import PDFDocument from 'pdfkit'
import app from '@adonisjs/core/services/app'
import { existsSync } from 'node:fs'
import { APP_NAME, BRAND, ORG_NAME } from '#support/brand'
import {
  ATTENDANCE_LABELS,
  CHECKLIST_LABELS,
  POLARITY_LABELS,
  REFERRAL_STATUS_LABELS,
  REFERRED_TO_LABELS,
} from '#support/labels'
import type { DayReport } from '#services/day_report_service'
import type {
  ClassroomReport,
  Period,
  StudentReport,
  Totals,
  TimelineItem,
} from '#services/history_service'

const MARGIN = 40
const PAGE_BOTTOM = 790

const br = (iso?: string | null) => (iso ? iso.split('-').reverse().join('/') : '—')
const periodText = (p: Period) =>
  p.from || p.to ? `${br(p.from)} a ${br(p.to)}` : 'Todo o período'

/** Linhas de "Totais" exibidas no PDF. Única fonte: o mesmo objeto de totais do JSON (CA05). */
export function totalsLines(t: Totals): [string, number][] {
  return [
    ['Registros de frequência', t.attendance.records],
    ['Presenças', t.attendance.present],
    ['Faltas', t.attendance.absent],
    ['Faltas justificadas', t.attendance.absent_justified],
    ['Atrasos', t.attendance.late],
    ['Checklists de fardamento/calçado', t.uniform.records],
    ['Fardamento inadequado', t.uniform.uniform_inadequate],
    ['Calçado inadequado', t.uniform.footwear_inadequate],
    ['RAs (total)', t.occurrences.total],
    ['RAs positivos', t.occurrences.positive],
    ['RAs negativos', t.occurrences.negative],
    ['RAs para conferência', t.occurrences.needs_review],
    ['Notificações', t.notifications.total],
    ['Encaminhamentos', t.referrals.total],
    ['Observações', t.observations.total],
  ]
}

export function itemDescription(item: TimelineItem): string {
  const d = item.data
  switch (item.type) {
    case 'attendance':
      return `${ATTENDANCE_LABELS[d.status] ?? d.status}${d.arrival_time ? ` (chegada ${d.arrival_time})` : ''}${d.is_justified ? ' - justificada' : ''}${d.note ? ` - ${d.note}` : ''}`
    case 'uniform_check':
      return `Fardamento: ${CHECKLIST_LABELS[d.uniform_status]}; Calçado: ${CHECKLIST_LABELS[d.footwear_status]}${d.note ? ` - ${d.note}` : ''}`
    case 'occurrence':
      return `RA ${String(d.ra_code).padStart(2, '0')} (${POLARITY_LABELS[d.polarity]})${d.polarity_divergent ? ' [CONFERIR]' : ''}: ${d.description}${item.status === 'cancelled' ? ' [CANCELADO]' : ''}`
    case 'notification':
      return `Notificação: ${d.reason}${d.occurrence_id ? ` (vinculada ao RA #${d.occurrence_id})` : ''}${item.status === 'cancelled' ? ' [CANCELADA]' : ''}`
    case 'referral':
      return `Encaminhamento à ${REFERRED_TO_LABELS[d.referred_to] ?? d.referred_to} (${REFERRAL_STATUS_LABELS[d.status] ?? d.status}): ${d.reason}`
    case 'observation':
      return `Observação: ${d.content}${item.status === 'cancelled' ? ' [CANCELADA]' : ''}`
  }
}

class Writer {
  doc: PDFKit.PDFDocument
  constructor(title: string, subtitle: string) {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      bufferPages: true,
      compress: process.env.NODE_ENV !== 'test',
      info: { Title: title, Author: ORG_NAME },
    })
    this.header(title, subtitle)
  }

  header(title: string, subtitle: string) {
    const { doc } = this
    doc.rect(0, 0, doc.page.width, 78).fill(BRAND.navy)
    const logo = app.makePath('resources/logo.jpeg')
    if (existsSync(logo)) doc.image(logo, MARGIN, 10, { height: 58 })
    doc
      .fillColor(BRAND.white)
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(title, MARGIN + 70, 18, { width: 440 })
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(BRAND.skyLight)
      .text(`${ORG_NAME} • ${APP_NAME}`, MARGIN + 70, 40, { width: 440 })
    doc
      .fontSize(9)
      .fillColor(BRAND.white)
      .text(subtitle, MARGIN + 70, 54, { width: 440 })
    doc.y = 96
    doc.x = MARGIN
    doc.fillColor(BRAND.navyDark)
  }

  ensure(height: number) {
    if (this.doc.y + height > PAGE_BOTTOM) {
      this.doc.addPage()
      this.doc.y = MARGIN
    }
  }

  section(title: string) {
    this.ensure(40)
    this.doc.moveDown(0.6)
    this.doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(BRAND.navy)
      .text(title, MARGIN, this.doc.y)
    const y = this.doc.y + 2
    this.doc
      .moveTo(MARGIN, y)
      .lineTo(this.doc.page.width - MARGIN, y)
      .lineWidth(1)
      .strokeColor(BRAND.sky)
      .stroke()
    this.doc.y = y + 6
    this.doc.fillColor(BRAND.navyDark).font('Helvetica').fontSize(9)
  }

  line(text: string, opts: { bold?: boolean; color?: string } = {}) {
    this.ensure(14)
    this.doc
      .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9)
      .fillColor(opts.color ?? BRAND.navyDark)
      .text(text, MARGIN, this.doc.y, { width: this.doc.page.width - MARGIN * 2 })
  }

  totals(t: Totals) {
    const lines = totalsLines(t)
    const colWidth = (this.doc.page.width - MARGIN * 2) / 3
    for (let i = 0; i < lines.length; i += 3) {
      this.ensure(16)
      const y = this.doc.y
      lines.slice(i, i + 3).forEach(([label, value], col) => {
        this.doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(BRAND.textSecondary)
          .text(label, MARGIN + col * colWidth, y, { width: colWidth - 30, continued: false })
        this.doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(BRAND.navy)
          .text(String(value), MARGIN + col * colWidth + colWidth - 30, y, {
            width: 26,
            align: 'right',
          })
      })
      this.doc.y = y + 15
    }
    const c = t.cancelled
    const cancelled = c.occurrences + c.notifications + c.referrals + c.observations
    if (cancelled)
      this.line(`Registros cancelados (fora dos totais): ${cancelled}`, {
        color: BRAND.textSecondary,
      })
  }

  /** Barra horizontal dividida em partes coloridas, com legenda. */
  bar(segments: { label: string; value: number; color: string }[]) {
    const { doc } = this
    const total = segments.reduce((n, s) => n + s.value, 0)
    this.ensure(34)
    const width = doc.page.width - MARGIN * 2
    const y = doc.y + 2
    doc.roundedRect(MARGIN, y, width, 10, 5).fill(BRAND.border)
    if (total > 0) {
      let x = MARGIN
      doc.save()
      doc.roundedRect(MARGIN, y, width, 10, 5).clip()
      for (const s of segments.filter((s) => s.value > 0)) {
        const w = (s.value / total) * width
        doc.rect(x, y, w, 10).fill(s.color)
        x += w
      }
      doc.restore()
    }
    doc.y = y + 15
    let lx = MARGIN
    const ly = doc.y
    doc.font('Helvetica').fontSize(8)
    for (const s of segments) {
      const text = `${s.label}: ${s.value}`
      doc.rect(lx, ly + 1.5, 7, 7).fill(s.color)
      doc.fillColor(BRAND.textSecondary).text(text, lx + 10, ly, { lineBreak: false })
      lx += 10 + doc.widthOfString(text) + 14
    }
    doc.y = ly + 14
    doc.fillColor(BRAND.navyDark)
  }

  footer() {
    const range = this.doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      this.doc.switchToPage(range.start + i)
      this.doc.font('Helvetica').fontSize(8).fillColor(BRAND.textSecondary)
      this.doc.text(
        `Gerado em ${new Date().toLocaleString('pt-BR')}  •  Página ${i + 1} de ${range.count}`,
        MARGIN,
        815,
        { width: this.doc.page.width - MARGIN * 2, align: 'center', lineBreak: false }
      )
    }
  }

  toBuffer(): Promise<Buffer> {
    this.footer()
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      this.doc.on('data', (c) => chunks.push(c))
      this.doc.on('end', () => resolve(Buffer.concat(chunks)))
      this.doc.on('error', reject)
      this.doc.end()
    })
  }
}

function filtersText(f: { include_cancelled: boolean }, period: Period) {
  return `Período: ${periodText(period)}${f.include_cancelled ? '  •  inclui registros cancelados' : ''}`
}

const weekday = (iso: string) => {
  const name = new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' })
  return name.charAt(0).toUpperCase() + name.slice(1)
}
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

export default class PdfService {
  /** Registros do dia da turma: frequência, fardamento, aulas, RAs, eventos e visão por estudante. */
  static async dayReport(r: DayReport): Promise<Buffer> {
    const w = new Writer(
      `Registros do dia - ${r.classroom.name}`,
      `${weekday(r.date)}, ${br(r.date)}  •  Início da aula: ${r.start_time ?? 'não informado'}`
    )
    const name = new Map(r.students.map((s) => [s.student.id, s.student.full_name]))
    const who = (id: number) => name.get(id) ?? `Estudante ${id}`
    const items = r.students.flatMap((s) => s.items ?? [])
    const ofType = (t: TimelineItem['type']) => items.filter((i) => i.type === t)
    const t = r.totals

    w.line(
      `Turma: ${r.classroom.name} (${r.classroom.school_year})   •   Estudantes: ${r.students.length}`,
      { bold: true }
    )

    // ---- Frequência
    const attendance = new Map<number, TimelineItem>()
    for (const i of ofType('attendance')) attendance.set(i.data.student_id, i)
    const records = t.attendance.records
    const attended = t.attendance.present + t.attendance.late
    const pending = r.students.filter((s) => !attendance.has(s.student.id))
    const latePct = pct(t.attendance.late, attended)
    w.section('Frequência')
    w.bar([
      { label: 'No horário', value: t.attendance.present, color: BRAND.positive },
      { label: 'Atrasados', value: t.attendance.late, color: '#C98A1B' },
      { label: 'Faltas', value: t.attendance.absent, color: BRAND.negative },
      { label: 'Sem registro', value: pending.length, color: BRAND.textSecondary },
    ])
    if (records) {
      if (attended) {
        w.line(
          `${100 - latePct}% chegou no horário (${t.attendance.present} de ${attended})   •   ${latePct}% chegou atrasado (${t.attendance.late} de ${attended})`
        )
      }
      w.line(
        `${pct(t.attendance.absent, records)}% faltou (${t.attendance.absent} de ${records})   •   Justificadas: ${t.attendance.absent_justified}   •   Não justificadas: ${t.attendance.absent - t.attendance.absent_justified}`
      )
    } else {
      w.line('A chamada deste dia ainda não foi registrada.', { color: BRAND.textSecondary })
    }
    const late = [...attendance.values()]
      .filter((i) => i.data.status === 'late')
      .sort((a, b) =>
        String(a.data.arrival_time ?? '99').localeCompare(String(b.data.arrival_time ?? '99'))
      )
    if (late.length) {
      w.line('Chegaram atrasados', { bold: true, color: BRAND.blue })
      for (const i of late)
        w.line(
          `   • ${who(i.data.student_id)} - ${i.data.arrival_time ? `chegou às ${i.data.arrival_time}` : 'horário não informado'}`
        )
    }
    const absent = [...attendance.values()].filter((i) => i.data.status === 'absent')
    if (absent.length) {
      w.line('Faltas', { bold: true, color: BRAND.blue })
      for (const i of absent)
        w.line(
          `   • ${who(i.data.student_id)} - ${i.data.is_justified ? 'justificada' : 'sem justificativa'}${i.data.is_justified && i.data.note ? ` (${i.data.note})` : ''}`
        )
    }
    if (records && pending.length)
      w.line(`Sem registro de frequência: ${pending.map((s) => s.student.full_name).join(', ')}`, {
        color: BRAND.textSecondary,
      })

    // ---- Fardamento e calçado
    w.section('Fardamento e calçado')
    if (t.uniform.records) {
      const nObs = (ok: number, bad: number) => Math.max(0, t.uniform.records - ok - bad)
      w.line('Fardamento', { bold: true, color: BRAND.blue })
      w.bar([
        { label: 'Adequado', value: t.uniform.uniform_adequate, color: BRAND.positive },
        { label: 'Inadequado', value: t.uniform.uniform_inadequate, color: BRAND.negative },
        {
          label: 'Não observado',
          value: nObs(t.uniform.uniform_adequate, t.uniform.uniform_inadequate),
          color: BRAND.textSecondary,
        },
      ])
      w.line('Calçado', { bold: true, color: BRAND.blue })
      w.bar([
        { label: 'Adequado', value: t.uniform.footwear_adequate, color: BRAND.positive },
        { label: 'Inadequado', value: t.uniform.footwear_inadequate, color: BRAND.negative },
        {
          label: 'Não observado',
          value: nObs(t.uniform.footwear_adequate, t.uniform.footwear_inadequate),
          color: BRAND.textSecondary,
        },
      ])
      const bad = ofType('uniform_check').filter(
        (i) => i.data.uniform_status === 'inadequate' || i.data.footwear_status === 'inadequate'
      )
      if (bad.length) {
        w.line('Com inadequação', { bold: true, color: BRAND.blue })
        for (const i of bad) {
          const what = [
            i.data.uniform_status === 'inadequate' ? 'fardamento' : null,
            i.data.footwear_status === 'inadequate' ? 'calçado' : null,
          ]
            .filter(Boolean)
            .join(' e ')
          w.line(
            `   • ${who(i.data.student_id)} - ${what}${i.data.note ? ` (${i.data.note})` : ''}`
          )
        }
      } else w.line('Todos adequados.')
    } else {
      w.line('O checklist de fardamento deste dia ainda não foi feito.', {
        color: BRAND.textSecondary,
      })
    }

    // ---- Aulas
    w.section('Aulas')
    w.line(
      `Previstas: ${r.lessons.planned_lessons}   •   Registradas: ${r.lessons.registered_lessons}   •   Não identificadas: ${r.lessons.not_identified_lessons}`
    )
    const lessons = (r.lessons.items[0]?.lessons ?? [])
      .slice()
      .sort((a, b) => Number(a.period) - Number(b.period))
    if (!lessons.length)
      w.line('Nenhuma aula registrada neste dia.', { color: BRAND.textSecondary })
    for (const l of lessons) {
      w.line(
        `${l.period}ª aula  -  ${l.subject ?? '—'}  -  ${l.teacher_name ?? 'professor não informado'}`,
        { bold: true }
      )
      if (l.not_identified) {
        w.line(
          `   Não identificado${l.not_identified_reason ? `: ${l.not_identified_reason}` : ''}`
        )
      } else {
        if (l.content) w.line(`   Conteúdo: ${l.content}`)
        if (l.progress) w.line(`   Andamento: ${l.progress}`)
        if (l.notes) w.line(`   Observações: ${l.notes}`)
      }
    }

    // ---- RAs
    w.section('Registros acadêmicos (RA)')
    w.bar([
      { label: 'Positivos', value: t.occurrences.positive, color: BRAND.positive },
      { label: 'Negativos', value: t.occurrences.negative, color: BRAND.negative },
    ])
    w.line(
      `Total: ${t.occurrences.total}   •   Positivos: ${t.occurrences.positive}   •   Negativos: ${t.occurrences.negative}`
    )
    const ras = ofType('occurrence').sort((a, b) =>
      String(a.data.student_id).localeCompare(String(b.data.student_id))
    )
    if (!ras.length) w.line('Nenhum RA neste dia.', { color: BRAND.textSecondary })
    for (const o of ras) {
      const code = Number(o.data.ra_code)
      const cname = r.ra_codes[code]
      w.line(
        `RA ${String(code).padStart(2, '0')}${cname ? ` - ${cname}` : ''} (${POLARITY_LABELS[o.data.polarity]})  -  ${who(o.data.student_id)}${o.data.polarity_divergent ? ' [CONFERIR]' : ''}`,
        { bold: true, color: o.data.polarity === 'positive' ? BRAND.positive : BRAND.negative }
      )
      w.line(`   ${o.data.description}`)
    }

    // ---- Eventos
    const extra = [
      ...ofType('notification').map(
        (i) => `Notificação - ${who(i.data.student_id)}: ${i.data.reason}`
      ),
      ...ofType('referral').map(
        (i) =>
          `Encaminhamento à ${REFERRED_TO_LABELS[i.data.referred_to] ?? i.data.referred_to} (${REFERRAL_STATUS_LABELS[i.data.status] ?? i.data.status}) - ${who(i.data.student_id)}: ${i.data.reason}`
      ),
      ...ofType('observation').map(
        (i) => `Observação - ${who(i.data.student_id)}: ${i.data.content}`
      ),
    ]
    if (extra.length) {
      w.section('Notificações, encaminhamentos e observações')
      for (const e of extra) w.line(`• ${e}`)
    }

    // ---- Por estudante
    w.section(`Por estudante (${r.students.length})`)
    w.line('Estudante  |  Frequência  |  Fardamento  |  RAs +  |  RAs -', {
      bold: true,
      color: BRAND.blue,
    })
    const uniform = new Map<number, TimelineItem>()
    for (const i of ofType('uniform_check')) uniform.set(i.data.student_id, i)
    for (const s of r.students) {
      const a = attendance.get(s.student.id)
      const u = uniform.get(s.student.id)
      const freq = a
        ? a.data.status === 'late'
          ? `Atraso${a.data.arrival_time ? ` ${a.data.arrival_time}` : ''}`
          : a.data.status === 'absent'
            ? a.data.is_justified
              ? 'Falta justificada'
              : 'Falta'
            : 'Presente'
        : 'Sem registro'
      const fard = u
        ? u.data.uniform_status === 'inadequate' || u.data.footwear_status === 'inadequate'
          ? 'Atenção'
          : 'Ok'
        : '—'
      w.line(
        `${s.student.full_name}  |  ${freq}  |  ${fard}  |  ${s.totals.occurrences.positive}  |  ${s.totals.occurrences.negative}`
      )
    }
    return w.toBuffer()
  }

  static async studentReport(r: StudentReport): Promise<Buffer> {
    const w = new Writer('Relatório individual do estudante', filtersText(r.filters, r.period))
    w.line(r.student.full_name, { bold: true })
    w.line(`Matrícula: ${r.student.registration ?? '—'}   •   Turma: ${r.student.classroom ?? '—'}`)
    w.section('Totais do período')
    w.totals(r.totals)
    w.section(`Detalhamento (${r.items.length} registros)`)
    if (!r.items.length) w.line('Nenhum registro no período.', { color: BRAND.textSecondary })
    for (const item of r.items) w.line(`${br(item.date)}  -  ${itemDescription(item)}`)
    return w.toBuffer()
  }

  static async classroomReport(r: ClassroomReport): Promise<Buffer> {
    const w = new Writer(
      `Relatório da turma ${r.classroom.name} (${r.classroom.school_year})`,
      filtersText(r.filters, r.period)
    )
    w.section('Totais da turma')
    w.totals(r.totals)

    w.section(`Por estudante (${r.students.length})`)
    w.line('Estudante  |  Faltas  |  Atrasos  |  RAs +  |  RAs -  |  Notificações', {
      bold: true,
      color: BRAND.blue,
    })
    for (const s of r.students) {
      const t = s.totals
      w.line(
        `${s.student.full_name}  |  ${t.attendance.absent}  |  ${t.attendance.late}  |  ${t.occurrences.positive}  |  ${t.occurrences.negative}  |  ${t.notifications.total}`
      )
    }

    w.section('Aulas registradas')
    w.line(
      `Dias com registro: ${r.lessons.days}   •   Aulas registradas: ${r.lessons.registered_lessons} de ${r.lessons.planned_lessons} previstas   •   "Não identificado": ${r.lessons.not_identified_lessons}`
    )
    for (const day of r.lessons.items) {
      for (const l of day.lessons) {
        const text = l.not_identified
          ? `Não identificado${l.not_identified_reason ? ` (${l.not_identified_reason})` : ''}`
          : `${l.subject ?? '—'} - ${l.teacher_name ?? '—'}${l.content ? `: ${l.content}` : ''}`
        w.line(`${br(day.date)}  ${l.period}ª aula  -  ${text}`)
      }
    }
    return w.toBuffer()
  }
}
