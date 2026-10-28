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

export default class PdfService {
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
