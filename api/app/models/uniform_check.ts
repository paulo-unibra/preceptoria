import { column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import AuditedModel from '#models/audited_model'
import Student from '#models/student'

export type ChecklistStatus = 'adequate' | 'inadequate' | 'not_observed'
export const CHECKLIST_STATUSES: ChecklistStatus[] = ['adequate', 'inadequate', 'not_observed']

export default class UniformCheck extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare studentId: number

  @column()
  declare classroomId: number

  @column.date()
  declare date: DateTime

  @column()
  declare uniformStatus: ChecklistStatus

  @column()
  declare footwearStatus: ChecklistStatus

  @column()
  declare note: string | null

  @belongsTo(() => Student)
  declare student: BelongsTo<typeof Student>
}
