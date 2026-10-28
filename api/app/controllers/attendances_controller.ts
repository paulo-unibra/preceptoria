import type { HttpContext } from '@adonisjs/core/http'
import Attendance from '#models/attendance'
import AttendanceSession from '#models/attendance_session'
import ClassroomAccess from '#services/classroom_access'
import { bulkUpsertDaily, rosterFor } from '#services/daily_records'
import { bulkAttendanceValidator, rosterQueryValidator } from '#validators/daily'
import { parseDate } from '#support/dates'
import { pageParams, toId } from '#support/query'

export default class AttendancesController {
  /** Tela de chamada: estudantes da turma com a frequência do dia (ou null). */
  async roster({ auth, request }: HttpContext) {
    const { classroom_id, date } = await request.validateUsing(rosterQueryValidator)
    await ClassroomAccess.assert(auth.user!, classroom_id)
    const roster = await rosterFor(Attendance, classroom_id, date)
    const session = await AttendanceSession.query()
      .where('classroom_id', classroom_id)
      .where('date', date)
      .first()
    // Último horário gravado para a turma: sugestão para as próximas chamadas.
    const last = await AttendanceSession.query()
      .where('classroom_id', classroom_id)
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc')
      .first()
    return {
      classroom_id,
      date,
      start_time: session?.startTime ?? null,
      last_start_time: last?.startTime ?? null,
      data: roster.map((r) => ({ student: r.student, attendance: r.record })),
    }
  }

  /** RF-05 — registra/corrige presença, falta e atraso de várias pessoas de uma vez. */
  async bulk({ auth, request }: HttpContext) {
    const { classroom_id, date, start_time, records } =
      await request.validateUsing(bulkAttendanceValidator)
    const saved = await bulkUpsertDaily(
      Attendance,
      auth.user!,
      classroom_id,
      date,
      records,
      (r) => ({
        status: r.status,
        // Horário de chegada só faz sentido para status "late"; justificativa só para falta.
        arrivalTime: r.status === 'late' ? (r.arrival_time ?? null) : null,
        isJustified: r.status === 'absent' ? (r.is_justified ?? false) : false,
        note: r.note ?? null,
      }),
      async (trx, classroom) => {
        const session = await AttendanceSession.query({ client: trx })
          .where('classroom_id', classroom.id)
          .where('date', date)
          .first()
        if (session) {
          session.merge({ startTime: start_time })
          await session.save()
        } else {
          await AttendanceSession.create(
            { classroomId: classroom.id, date: parseDate(date), startTime: start_time },
            { client: trx }
          )
        }
      }
    )
    return { data: saved }
  }

  /** Consulta de histórico com filtros (RF-12). */
  async index({ auth, request }: HttpContext) {
    const { page, perPage } = pageParams(request)
    const query = Attendance.query()
      .preload('student')
      .orderBy('date', 'desc')
      .orderBy('id', 'desc')
    await ClassroomAccess.scope(query, auth.user!)
    const classroomId = toId(request.input('classroom_id'))
    const studentId = toId(request.input('student_id'))
    if (classroomId) query.where('classroom_id', classroomId)
    if (studentId) query.where('student_id', studentId)
    if (request.input('status')) query.where('status', request.input('status'))
    if (request.input('from')) query.where('date', '>=', request.input('from'))
    if (request.input('to')) query.where('date', '<=', request.input('to'))
    return query.paginate(page, perPage)
  }
}
