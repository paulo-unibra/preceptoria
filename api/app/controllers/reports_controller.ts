import type { HttpContext } from '@adonisjs/core/http'
import Classroom from '#models/classroom'
import Student from '#models/student'
import ClassroomAccess from '#services/classroom_access'
import { buildClassroomReport, buildStudentReport } from '#services/history_service'
import PdfService from '#services/pdf_service'
import { historyQueryValidator, parseTypes } from '#validators/queries'
import { invalid } from '#support/errors'

async function parseQuery(request: HttpContext['request']) {
  const q = await request.validateUsing(historyQueryValidator, { data: request.qs() })
  if (q.from && q.to && q.from > q.to)
    throw invalid('A data inicial não pode ser posterior à data final.')
  const { types, invalid: bad } = parseTypes(q.types)
  if (bad.length) throw invalid(`Tipos de registro inválidos: ${bad.join(', ')}.`)
  return {
    period: { from: q.from ?? null, to: q.to ?? null },
    types,
    includeCancelled: q.include_cancelled ?? false,
    format: q.format ?? 'json',
    includeItems: q.include_items ?? false,
  }
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()

export default class ReportsController {
  /** RF-09 — histórico individual cronológico, com os totais do mesmo período (CA03). */
  async history({ auth, params, request }: HttpContext) {
    const student = await Student.findOrFail(params.id)
    await ClassroomAccess.assert(auth.user!, student.classroomId)
    const q = await parseQuery(request)
    return buildStudentReport(auth.user!, student, {
      period: q.period,
      types: q.types,
      includeCancelled: q.includeCancelled,
    })
  }

  /** RF-10 — relatório individual (JSON ou PDF com `?format=pdf`). */
  async student({ auth, params, request, response }: HttpContext) {
    const student = await Student.findOrFail(params.id)
    await ClassroomAccess.assert(auth.user!, student.classroomId)
    const q = await parseQuery(request)
    const report = await buildStudentReport(auth.user!, student, {
      period: q.period,
      types: q.types,
      includeCancelled: q.includeCancelled,
    })
    if (q.format === 'pdf') {
      const pdf = await PdfService.studentReport(report)
      return response
        .header('Content-Type', 'application/pdf')
        .header(
          'Content-Disposition',
          `attachment; filename="relatorio-${slug(student.fullName)}.pdf"`
        )
        .send(pdf)
    }
    return report
  }

  async classroom({ auth, params, request, response }: HttpContext) {
    const classroom = await Classroom.findOrFail(params.id)
    await ClassroomAccess.assert(auth.user!, classroom.id)
    const q = await parseQuery(request)
    const report = await buildClassroomReport(
      auth.user!,
      classroom,
      { period: q.period, types: q.types, includeCancelled: q.includeCancelled },
      q.includeItems
    )
    if (q.format === 'pdf') {
      const pdf = await PdfService.classroomReport(report)
      return response
        .header('Content-Type', 'application/pdf')
        .header(
          'Content-Disposition',
          `attachment; filename="relatorio-turma-${slug(classroom.name)}-${classroom.schoolYear}.pdf"`
        )
        .send(pdf)
    }
    return report
  }
}
