import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Occurrence from '#models/occurrence'
import ClassroomAccess from '#services/classroom_access'
import { writableStudent } from '#services/daily_records'
import OccurrenceService from '#services/occurrence_service'
import { assertNotCancelled, cancelRecord } from '#services/records'
import {
  cancelValidator,
  createOccurrenceValidator,
  updateOccurrenceValidator,
} from '#validators/records'
import { polarityForCode } from '#support/ra'
import { boolParam, pageParams, toId } from '#support/query'
import { conflict } from '#support/errors'

export default class OccurrencesController {
  /** RF-12 — filtros por turma, estudante, data, polaridade, código, situação e revisão pendente. */
  async index({ auth, request }: HttpContext) {
    const { page, perPage } = pageParams(request)
    const query = Occurrence.query()
      .preload('student')
      .orderBy('occurred_on', 'desc')
      .orderBy('id', 'desc')
    await ClassroomAccess.scope(query, auth.user!)

    const classroomId = toId(request.input('classroom_id'))
    const studentId = toId(request.input('student_id'))
    if (classroomId) query.where('classroom_id', classroomId)
    if (studentId) query.where('student_id', studentId)
    if (request.input('polarity')) query.where('polarity', request.input('polarity'))
    if (request.input('ra_code')) query.where('ra_code', Number(request.input('ra_code')))
    if (request.input('from')) query.where('occurred_on', '>=', request.input('from'))
    if (request.input('to')) query.where('occurred_on', '<=', request.input('to'))
    const status = request.input('status', 'active')
    if (status !== 'all') query.where('status', status)
    if (request.input('q')) query.whereLike('description', `%${request.input('q')}%`)

    const needsReview = boolParam(request.input('needs_review'))
    if (needsReview) {
      query.where((b) =>
        b
          .where('polarity_divergent', true)
          .orWhere((d) =>
            d.whereNotNull('possible_duplicate_of_id').whereNull('duplicate_reviewed_at')
          )
      )
    }
    return query.paginate(page, perPage)
  }

  async show({ auth, params }: HttpContext) {
    const occurrence = await Occurrence.query()
      .where('id', params.id)
      .preload('student')
      .firstOrFail()
    await ClassroomAccess.assert(auth.user!, occurrence.classroomId)
    return { occurrence, warnings: OccurrenceService.warningsFor(occurrence) }
  }

  /** RF-08 — o profissional responsável é o usuário autenticado (created_by). */
  async store({ auth, request, response }: HttpContext) {
    const input = await request.validateUsing(createOccurrenceValidator)
    const student = await writableStudent(auth.user!, input.student_id)
    const occurrence = await OccurrenceService.create(student, input)
    return response.created({ occurrence, warnings: OccurrenceService.warningsFor(occurrence) })
  }

  async update({ auth, params, request }: HttpContext) {
    const occurrence = await Occurrence.findOrFail(params.id)
    await ClassroomAccess.assertCanModify(auth.user!, occurrence)
    assertNotCancelled(occurrence)
    const input = await request.validateUsing(updateOccurrenceValidator)
    await OccurrenceService.update(occurrence, input)
    return { occurrence, warnings: OccurrenceService.warningsFor(occurrence) }
  }

  async cancel({ auth, params, request }: HttpContext) {
    const occurrence = await Occurrence.findOrFail(params.id)
    const { reason } = await request.validateUsing(cancelValidator)
    await cancelRecord(auth.user!, occurrence, reason)
    return { occurrence }
  }

  /**
   * RN03 — após conferência, o administrador alinha a polaridade ao código. O valor anterior
   * permanece no histórico de auditoria (CA06).
   */
  async resolveDivergence({ params }: HttpContext) {
    const occurrence = await Occurrence.findOrFail(params.id)
    assertNotCancelled(occurrence)
    if (!occurrence.polarityDivergent)
      throw conflict('Este registro não tem divergência a resolver.', 'E_NOT_DIVERGENT')
    occurrence.polarity = polarityForCode(occurrence.raCode)!
    await occurrence.save()
    return { occurrence }
  }

  /** RN08 — marca a possível duplicidade como revisada (nada é excluído). Para excluir da contagem, cancele o RA. */
  async reviewDuplicate({ auth, params }: HttpContext) {
    const occurrence = await Occurrence.findOrFail(params.id)
    await ClassroomAccess.assert(auth.user!, occurrence.classroomId)
    if (!occurrence.possibleDuplicateOfId)
      throw conflict('Este registro não está sinalizado como duplicado.', 'E_NOT_DUPLICATE')
    occurrence.duplicateReviewedAt = DateTime.now()
    occurrence.duplicateReviewedBy = auth.user!.id
    await occurrence.save()
    return { occurrence }
  }
}
