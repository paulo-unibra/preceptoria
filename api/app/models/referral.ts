import { column } from '@adonisjs/lucid/orm'
import { booleanColumn } from '#support/columns'
import type { DateTime } from 'luxon'
import AuditedModel from '#models/audited_model'

export type ReferralStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled'
export const REFERRAL_STATUSES: ReferralStatus[] = ['open', 'in_progress', 'resolved', 'cancelled']

export default class Referral extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare studentId: number

  @column()
  declare classroomId: number

  @column()
  declare occurrenceId: number | null

  @column()
  declare referredTo: 'coordination' | 'management'

  @column.date()
  declare referredOn: DateTime

  @column()
  declare reason: string

  @column()
  declare actionTaken: string | null

  @column()
  declare status: ReferralStatus

  @column.date()
  declare resolvedOn: DateTime | null

  @column.date()
  declare guardianContactedOn: DateTime | null

  @column()
  declare guardianContactResult: string | null

  @booleanColumn()
  declare isConfidential: boolean

  @column()
  declare cancelReason: string | null
}
