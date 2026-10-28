import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Notification from '#models/notification'
import Occurrence from '#models/occurrence'
import ClassroomAccess from '#services/classroom_access'
import { writableStudent } from '#services/daily_records'
import { assertNotCancelled, cancelRecord } from '#services/records'
import {
  cancelValidator,
  createNotificationValidator,
  updateNotificationValidator,
} from '#validators/records'
import { invalid } from '#support/errors'
import { parseDate } from '#support/dates'
import { pageParams, toId } from '#support/query'

/** O vínculo é só uma referência: não cria nem altera a ocorrência (RN06). */
async function assertLinkable(occurrenceId: number, studentId: number) {
  const occurrence = await Occurrence.find(occurrenceId)
  if (!occurrence || occurrence.studentId !== studentId)
    throw invalid('A ocorrência informada não existe ou é de outro estudante.')
  if (occurrence.status === 'cancelled')
    throw invalid('Não é possível vincular uma ocorrência cancelada.')
}

export default class NotificationsController {
  async index({ auth, request }: HttpContext) {
    const { page, perPage } = pageParams(request)
    const query = Notification.query().orderBy('notified_on', 'desc').orderBy('id', 'desc')
    await ClassroomAccess.scope(query, auth.user!)
    const classroomId = toId(request.input('classroom_id'))
    const studentId = toId(request.input('student_id'))
    if (classroomId) query.where('classroom_id', classroomId)
    if (studentId) query.where('student_id', studentId)
    if (request.input('from')) query.where('notified_on', '>=', request.input('from'))
    if (request.input('to')) query.where('notified_on', '<=', request.input('to'))
    query.where('status', request.input('status', 'active'))
    return query.paginate(page, perPage)
  }

  async show({ auth, params }: HttpContext) {
    const notification = await Notification.findOrFail(params.id)
    await ClassroomAccess.assert(auth.user!, notification.classroomId)
    return { notification }
  }

  async store({ auth, request, response }: HttpContext) {
    const input = await request.validateUsing(createNotificationValidator)
    const student = await writableStudent(auth.user!, input.student_id)
    if (input.occurrence_id) await assertLinkable(input.occurrence_id, student.id)
    const notification = await Notification.create({
      studentId: student.id,
      classroomId: student.classroomId!,
      occurrenceId: input.occurrence_id ?? null,
      notifiedOn: parseDate(input.notified_on),
      reason: input.reason,
      guardianInformed: input.guardian_informed ?? false,
      guardianInformedAt: input.guardian_informed ? DateTime.now() : null,
      status: 'active',
    })
    return response.created({ notification })
  }

  async update({ auth, params, request }: HttpContext) {
    const notification = await Notification.findOrFail(params.id)
    await ClassroomAccess.assertCanModify(auth.user!, notification)
    assertNotCancelled(notification)
    const input = await request.validateUsing(updateNotificationValidator)
    if (input.occurrence_id) await assertLinkable(input.occurrence_id, notification.studentId)
    notification.merge({
      ...(input.notified_on !== undefined && { notifiedOn: parseDate(input.notified_on) }),
      ...(input.reason !== undefined && { reason: input.reason }),
      ...(input.occurrence_id !== undefined && { occurrenceId: input.occurrence_id }),
      ...(input.guardian_informed !== undefined && {
        guardianInformed: input.guardian_informed,
        guardianInformedAt: input.guardian_informed
          ? (notification.guardianInformedAt ?? DateTime.now())
          : null,
      }),
    })
    await notification.save()
    return { notification }
  }

  async cancel({ auth, params, request }: HttpContext) {
    const notification = await Notification.findOrFail(params.id)
    const { reason } = await request.validateUsing(cancelValidator)
    await cancelRecord(auth.user!, notification, reason)
    return { notification }
  }
}
