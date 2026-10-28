import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type User from '#models/user'
import type { UserRole } from '#models/user'

export function forbidden(message = 'Você não tem permissão para esta ação.') {
  return new Exception(message, { status: 403, code: 'E_FORBIDDEN' })
}

/**
 * RNF02 — acesso limitado às turmas autorizadas.
 * Administrador enxerga todas as turmas; preceptor e coordenação, apenas as vinculadas a eles.
 */
export default class ClassroomAccess {
  /** `null` significa "todas as turmas". */
  static async classroomIds(user: User): Promise<number[] | null> {
    if (user.role === 'admin') return null
    const rows = await db.from('classroom_user').where('user_id', user.id).select('classroom_id')
    return rows.map((r) => r.classroom_id as number)
  }

  static async canAccess(user: User, classroomId: number | null): Promise<boolean> {
    if (user.role === 'admin') return true
    if (!classroomId) return false
    const row = await db
      .from('classroom_user')
      .where({ user_id: user.id, classroom_id: classroomId })
      .first()
    return !!row
  }

  static async assert(user: User, classroomId: number | null) {
    if (!(await ClassroomAccess.canAccess(user, classroomId)))
      throw forbidden('Você não tem acesso a esta turma.')
  }

  /** Restringe uma query às turmas permitidas ao usuário. */
  static async scope<Q extends ModelQueryBuilderContract<any, any>>(
    query: Q,
    user: User,
    column = 'classroom_id'
  ): Promise<Q> {
    const ids = await ClassroomAccess.classroomIds(user)
    if (ids !== null) query.whereIn(column, ids.length ? ids : [-1])
    return query
  }

  static requireRole(user: User, ...roles: UserRole[]) {
    if (!roles.includes(user.role)) throw forbidden()
  }

  /**
   * DP04 (premissa adotada, a confirmar com o cliente): corrige/cancela o próprio autor do registro,
   * desde que ainda tenha acesso à turma, ou o administrador. Coordenação é somente leitura.
   */
  static async assertCanModify(
    user: User,
    record: { createdBy: number | null; classroomId: number | null }
  ) {
    if (user.role === 'admin') return
    if (user.role !== 'preceptor') throw forbidden('Seu perfil não pode alterar este registro.')
    if (record.createdBy !== user.id)
      throw forbidden('Somente quem criou o registro (ou um administrador) pode alterá-lo.')
    await ClassroomAccess.assert(user, record.classroomId)
  }
}
