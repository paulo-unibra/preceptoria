import type { HttpContext } from '@adonisjs/core/http'
import Referral from '#models/referral'
import Occurrence from '#models/occurrence'
import type User from '#models/user'
import ClassroomAccess, { forbidden } from '#services/classroom_access'
import { writableStudent } from '#services/daily_records'
import { canSeeReferral, visibleReferralsScope } from '#services/referral_access'
import {
  cancelValidator,
  createReferralValidator,
  updateReferralValidator,
} from '#validators/records'
import { invalid, conflict } from '#support/errors'
import { parseDate, todayISO } from '#support/dates'
import { pageParams, toId } from '#support/query'

async function load(user: User, id: number) {
  const referral = await Referral.findOrFail(id)
  await ClassroomAccess.assert(user, referral.classroomId)
  if (!canSeeReferral(user, referral)) throw forbidden('Este encaminhamento é confidencial.')
  return referral
}

/** Preceptor altera só os próprios; coordenação (da turma) e administração acompanham todos. */
function assertCanEdit(user: User, referral: Referral) {
  if (user.role === 'preceptor' && referral.createdBy !== user.id) {
    throw forbidden(
      'Somente quem criou o encaminhamento (ou a coordenação/administração) pode alterá-lo.'
    )
  }
}

export default class ReferralsController {
  async index({ auth, request }: HttpContext) {
    const user = auth.user!
    const { page, perPage } = pageParams(request)
    const query = Referral.query().orderBy('referred_on', 'desc').orderBy('id', 'desc')
    await ClassroomAccess.scope(query, user)
    visibleReferralsScope(query, user)
    const classroomId = toId(request.input('classroom_id'))
    const studentId = toId(request.input('student_id'))
    if (classroomId) query.where('classroom_id', classroomId)
    if (studentId) query.where('student_id', studentId)
    if (request.input('status')) query.where('status', request.input('status'))
    else query.whereNot('status', 'cancelled')
    if (request.input('from')) query.where('referred_on', '>=', request.input('from'))
    if (request.input('to')) query.where('referred_on', '<=', request.input('to'))
    return query.paginate(page, perPage)
  }

  async show({ auth, params }: HttpContext) {
    return { referral: await load(auth.user!, params.id) }
  }

  async store({ auth, request, response }: HttpContext) {
    const input = await request.validateUsing(createReferralValidator)
    const student = await writableStudent(auth.user!, input.student_id)
    if (input.occurrence_id) {
      const occurrence = await Occurrence.find(input.occurrence_id)
      if (!occurrence || occurrence.studentId !== student.id)
        throw invalid('A ocorrência informada não existe ou é de outro estudante.')
    }
    const referral = await Referral.create({
      studentId: student.id,
      classroomId: student.classroomId!,
      occurrenceId: input.occurrence_id ?? null,
      referredTo: input.referred_to,
      referredOn: parseDate(input.referred_on),
      reason: input.reason,
      actionTaken: input.action_taken ?? null,
      status: 'open',
      isConfidential: input.is_confidential ?? false,
      guardianContactedOn: input.guardian_contacted_on
        ? parseDate(input.guardian_contacted_on)
        : null,
      guardianContactResult: input.guardian_contact_result ?? null,
    })
    return response.created({ referral })
  }

  async update({ auth, params, request }: HttpContext) {
    const user = auth.user!
    const referral = await load(user, params.id)
    assertCanEdit(user, referral)
    if (referral.status === 'cancelled')
      throw conflict('Este encaminhamento está cancelado.', 'E_CANCELLED')
    const input = await request.validateUsing(updateReferralValidator)

    referral.merge({
      ...(input.referred_to !== undefined && { referredTo: input.referred_to }),
      ...(input.reason !== undefined && { reason: input.reason }),
      ...(input.action_taken !== undefined && { actionTaken: input.action_taken }),
      ...(input.is_confidential !== undefined && { isConfidential: input.is_confidential }),
      ...(input.guardian_contacted_on !== undefined && {
        guardianContactedOn: input.guardian_contacted_on
          ? parseDate(input.guardian_contacted_on)
          : null,
      }),
      ...(input.guardian_contact_result !== undefined && {
        guardianContactResult: input.guardian_contact_result,
      }),
    })
    if (input.status !== undefined) {
      referral.status = input.status
      if (input.status === 'resolved')
        referral.resolvedOn = parseDate(input.resolved_on ?? todayISO())
      else referral.resolvedOn = null
    }
    await referral.save()
    return { referral }
  }

  async cancel({ auth, params, request }: HttpContext) {
    const user = auth.user!
    const referral = await load(user, params.id)
    assertCanEdit(user, referral)
    if (referral.status === 'cancelled')
      throw conflict('Este encaminhamento já está cancelado.', 'E_CANCELLED')
    const { reason } = await request.validateUsing(cancelValidator)
    referral.status = 'cancelled'
    referral.cancelReason = reason
    await referral.save()
    return { referral }
  }
}
