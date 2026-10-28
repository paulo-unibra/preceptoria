import { HttpContext } from '@adonisjs/core/http'
import AuditLog, { type AuditAction, type AuditChanges } from '#models/audit_log'

export default class AuditService {
  /** Para entidades que não herdam de AuditedModel (ex.: usuários). */
  static async record(
    entity: string,
    entityId: number,
    action: AuditAction,
    changes: AuditChanges,
    classroomId: number | null = null
  ) {
    const user = HttpContext.get()?.auth?.user as { id?: number } | undefined
    return AuditLog.create({
      userId: user?.id ?? null,
      entity,
      entityId,
      classroomId,
      action,
      changes,
    })
  }
}
