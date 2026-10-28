import { DateTime } from 'luxon'
import string from '@adonisjs/core/helpers/string'
import { HttpContext } from '@adonisjs/core/http'
import {
  afterCreate,
  afterUpdate,
  BaseModel,
  beforeCreate,
  beforeUpdate,
  column,
} from '@adonisjs/lucid/orm'
import type { AuditChanges } from '#models/audit_log'

/**
 * Import tardio: AuditLog -> User -> Classroom -> AuditedModel formaria um ciclo de módulos.
 */
const auditLog = async () => (await import('#models/audit_log')).default

/** Campos que nunca entram no diff de auditoria. */
const IGNORED_FIELDS = new Set(['createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'password'])

/** Diff calculado em beforeUpdate e gravado em afterUpdate (depois do UPDATE ter dado certo). */
const pendingChanges = new WeakMap<object, AuditChanges>()

function plain(value: unknown): unknown {
  if (DateTime.isDateTime(value)) {
    const isMidnight =
      value.hour === 0 && value.minute === 0 && value.second === 0 && value.millisecond === 0
    return isMidnight ? value.toISODate() : value.toISO()
  }
  return value === undefined ? null : value
}

function currentUserId(): number | null {
  const user = HttpContext.get()?.auth?.user as { id?: number } | undefined
  return user?.id ?? null
}

/**
 * Base de todos os registros do acompanhamento. Garante, de forma centralizada:
 *  - created_by / updated_by preenchidos com o usuário autenticado;
 *  - um AuditLog para cada criação e alteração, com valor anterior e novo.
 */
export default class AuditedModel extends BaseModel {
  @column({ serializeAs: null })
  declare createdBy: number | null

  @column({ serializeAs: null })
  declare updatedBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  /** Turma usada para escopo do log de auditoria. Sobrescrito por models que a possuem. */
  get auditClassroomId(): number | null {
    return ((this as any).classroomId as number | undefined) ?? null
  }

  @beforeCreate()
  static stampCreator(model: AuditedModel) {
    const userId = currentUserId()
    if (userId) {
      model.createdBy = userId
      model.updatedBy = userId
    }
  }

  @beforeUpdate()
  static stampUpdater(model: AuditedModel) {
    const userId = currentUserId()
    if (userId) model.updatedBy = userId

    const changes: AuditChanges = {}
    for (const [key, value] of Object.entries(model.$dirty)) {
      if (IGNORED_FIELDS.has(key)) continue
      changes[string.snakeCase(key)] = { old: plain(model.$original[key]), new: plain(value) }
    }
    if (Object.keys(changes).length) pendingChanges.set(model, changes)
  }

  @afterCreate()
  static async auditCreate(model: AuditedModel) {
    const changes: AuditChanges = {}
    for (const [key, value] of Object.entries(model.$attributes)) {
      if (IGNORED_FIELDS.has(key) || value === null || value === undefined) continue
      changes[string.snakeCase(key)] = { old: null, new: plain(value) }
    }
    const AuditLog = await auditLog()
    await AuditLog.create(
      {
        userId: currentUserId(),
        entity: (model.constructor as typeof BaseModel).table,
        entityId: (model as any).id,
        classroomId: model.auditClassroomId,
        action: 'create',
        changes,
      },
      { client: model.$trx }
    )
  }

  @afterUpdate()
  static async auditUpdate(model: AuditedModel) {
    const changes = pendingChanges.get(model)
    if (!changes) return
    pendingChanges.delete(model)
    const AuditLog = await auditLog()
    await AuditLog.create(
      {
        userId: currentUserId(),
        entity: (model.constructor as typeof BaseModel).table,
        entityId: (model as any).id,
        classroomId: model.auditClassroomId,
        action: changes.status?.new === 'cancelled' ? 'cancel' : 'update',
        changes,
      },
      { client: model.$trx }
    )
  }
}
