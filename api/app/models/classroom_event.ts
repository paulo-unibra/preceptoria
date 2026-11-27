import { column } from '@adonisjs/lucid/orm'
import type { DateTime } from 'luxon'
import AuditedModel from '#models/audited_model'

export const CLASSROOM_EVENT_KINDS = [
  'atividade',
  'interrupcao',
  'ocorrencia_institucional',
] as const

export default class ClassroomEvent extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare classroomId: number

  @column.date()
  declare date: DateTime

  @column()
  declare kind: (typeof CLASSROOM_EVENT_KINDS)[number]

  @column()
  declare title: string

  @column()
  declare description: string
}
