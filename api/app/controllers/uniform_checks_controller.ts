import type { HttpContext } from '@adonisjs/core/http'
import UniformCheck from '#models/uniform_check'
import ClassroomAccess from '#services/classroom_access'
import { bulkUpsertDaily, rosterFor } from '#services/daily_records'
import { bulkUniformValidator, rosterQueryValidator } from '#validators/daily'
import { pageParams, toId } from '#support/query'

export default class UniformChecksController {
  async roster({ auth, request }: HttpContext) {
    const { classroom_id, date } = await request.validateUsing(rosterQueryValidator)
    await ClassroomAccess.assert(auth.user!, classroom_id)
    const roster = await rosterFor(UniformCheck, classroom_id, date)
    return {
      classroom_id,
      date,
      data: roster.map((r) => ({ student: r.student, check: r.record })),
    }
  }

  /** RF-02 — checklist diário de fardamento e calçado, em lote. */
  async bulk({ auth, request }: HttpContext) {
    const { classroom_id, date, records } = await request.validateUsing(bulkUniformValidator)
    const saved = await bulkUpsertDaily(
      UniformCheck,
      auth.user!,
      classroom_id,
      date,
      records,
      (r) => ({
        uniformStatus: r.uniform_status,
        footwearStatus: r.footwear_status,
        note: r.note ?? null,
      })
    )
    return { data: saved }
  }

  async index({ auth, request }: HttpContext) {
    const { page, perPage } = pageParams(request)
    const query = UniformCheck.query()
      .preload('student')
      .orderBy('date', 'desc')
      .orderBy('id', 'desc')
    await ClassroomAccess.scope(query, auth.user!)
    const classroomId = toId(request.input('classroom_id'))
    const studentId = toId(request.input('student_id'))
    if (classroomId) query.where('classroom_id', classroomId)
    if (studentId) query.where('student_id', studentId)
    if (request.input('from')) query.where('date', '>=', request.input('from'))
    if (request.input('to')) query.where('date', '<=', request.input('to'))
    return query.paginate(page, perPage)
  }
}
