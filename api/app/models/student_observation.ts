import { column } from '@adonisjs/lucid/orm'
import type { DateTime } from 'luxon'
import AuditedModel from '#models/audited_model'
import type { RecordStatus } from '#models/occurrence'

export default class StudentObservation extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare studentId: number

  @column()
  declare classroomId: number

  @column.date()
  declare observedOn: DateTime

  @column()
  declare content: string

  @column()
  declare status: RecordStatus

  @column.dateTime()
  declare cancelledAt: DateTime | null

  @column({ serializeAs: null })
  declare cancelledBy: number | null

  @column()
  declare cancelReason: string | null
}
