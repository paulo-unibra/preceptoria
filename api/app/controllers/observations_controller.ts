import type { HttpContext } from '@adonisjs/core/http'
import StudentObservation from '#models/student_observation'
import ClassroomAccess from '#services/classroom_access'
import { writableStudent } from '#services/daily_records'
import { assertNotCancelled, cancelRecord } from '#services/records'
import {
  cancelValidator,
  createObservationValidator,
  updateObservationValidator,
} from '#validators/records'
import { parseDate } from '#support/dates'
import { pageParams, toId } from '#support/query'

export default class ObservationsController {
  async index({ auth, request }: HttpContext) {
    const { page, perPage } = pageParams(request)
    const query = StudentObservation.query().orderBy('observed_on', 'desc').orderBy('id', 'desc')
    await ClassroomAccess.scope(query, auth.user!)
    const studentId = toId(request.input('student_id'))
    const classroomId = toId(request.input('classroom_id'))
    if (studentId) query.where('student_id', studentId)
    if (classroomId) query.where('classroom_id', classroomId)
    query.where('status', request.input('status', 'active'))
    return query.paginate(page, perPage)
  }

  async store({ auth, request, response }: HttpContext) {
    const input = await request.validateUsing(createObservationValidator)
    const student = await writableStudent(auth.user!, input.student_id)
    const observation = await StudentObservation.create({
      studentId: student.id,
      classroomId: student.classroomId!,
      observedOn: parseDate(input.observed_on),
      content: input.content,
      status: 'active',
    })
    return response.created({ observation })
  }

  async update({ auth, params, request }: HttpContext) {
    const observation = await StudentObservation.findOrFail(params.id)
    await ClassroomAccess.assertCanModify(auth.user!, observation)
    assertNotCancelled(observation)
    const input = await request.validateUsing(updateObservationValidator)
    observation.merge({
      ...(input.observed_on !== undefined && { observedOn: parseDate(input.observed_on) }),
      ...(input.content !== undefined && { content: input.content }),
    })
    await observation.save()
    return { observation }
  }

  async cancel({ auth, params, request }: HttpContext) {
    const observation = await StudentObservation.findOrFail(params.id)
    const { reason } = await request.validateUsing(cancelValidator)
    await cancelRecord(auth.user!, observation, reason)
    return { observation }
  }
}
