import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export type AuditAction = 'create' | 'update' | 'cancel'
export type AuditChanges = Record<string, { old: unknown; new: unknown }>

export default class AuditLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number | null

  @column()
  declare entity: string

  @column()
  declare entityId: number

  @column()
  declare classroomId: number | null

  @column()
  declare action: AuditAction

  @column({
    prepare: (value: AuditChanges) => JSON.stringify(value),
    consume: (value: string | AuditChanges) =>
      typeof value === 'string' ? JSON.parse(value) : value,
  })
  declare changes: AuditChanges

  // Registros de auditoria são imutáveis: só existe created_at.
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
