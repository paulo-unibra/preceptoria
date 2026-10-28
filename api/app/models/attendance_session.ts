import { column } from '@adonisjs/lucid/orm'
import type { DateTime } from 'luxon'
import AuditedModel from '#models/audited_model'

/** Hora de início da aula na chamada de uma turma em uma data. */
export default class AttendanceSession extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare classroomId: number

  @column.date()
  declare date: DateTime

  @column()
  declare startTime: string
}
