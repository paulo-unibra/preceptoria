import { column, belongsTo } from '@adonisjs/lucid/orm'
import { booleanColumn } from '#support/columns'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import AuditedModel from '#models/audited_model'
import Occurrence, { type RecordStatus } from '#models/occurrence'

export default class Notification extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare studentId: number

  @column()
  declare classroomId: number

  /** RN06: opcional. Vincular não cria outra ocorrência nem altera a ocorrência. */
  @column()
  declare occurrenceId: number | null

  @column.date()
  declare notifiedOn: DateTime

  @column()
  declare reason: string

  @booleanColumn()
  declare guardianInformed: boolean

  @column.dateTime()
  declare guardianInformedAt: DateTime | null

  @column()
  declare status: RecordStatus

  @column.dateTime()
  declare cancelledAt: DateTime | null

  @column({ serializeAs: null })
  declare cancelledBy: number | null

  @column()
  declare cancelReason: string | null

  @belongsTo(() => Occurrence)
  declare occurrence: BelongsTo<typeof Occurrence>
}
