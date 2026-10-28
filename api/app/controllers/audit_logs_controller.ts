import type { HttpContext } from '@adonisjs/core/http'
import AuditLog from '#models/audit_log'
import ClassroomAccess from '#services/classroom_access'
import { pageParams, toId } from '#support/query'

export default class AuditLogsController {
  /**
   * CA06 — quem alterou, quando, valor anterior e novo. Administração vê tudo; a coordenação só vê
   * registros das suas turmas.
   */
  async index({ auth, request }: HttpContext) {
    const { page, perPage } = pageParams(request)
    const query = AuditLog.query()
      .preload('user', (q) => q.select('id', 'full_name', 'role'))
      .orderBy('id', 'desc')
    await ClassroomAccess.scope(query, auth.user!)
    if (request.input('entity')) query.where('entity', request.input('entity'))
    const entityId = toId(request.input('entity_id'))
    if (entityId) query.where('entity_id', entityId)
    const classroomId = toId(request.input('classroom_id'))
    if (classroomId) query.where('classroom_id', classroomId)
    const userId = toId(request.input('user_id'))
    if (userId) query.where('user_id', userId)
    if (request.input('from')) query.where('created_at', '>=', `${request.input('from')} 00:00:00`)
    if (request.input('to')) query.where('created_at', '<=', `${request.input('to')} 23:59:59`)
    return query.paginate(page, perPage)
  }
}
