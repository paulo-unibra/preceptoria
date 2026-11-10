import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class StudentNfcCard extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare studentId: number

  @column({ serializeAs: null })
  declare tokenHash: string | null

  @column({ serializeAs: null })
  declare pendingHash: string | null

  @column.dateTime({ serializeAs: null })
  declare pendingExpiresAt: DateTime | null

  @column({ serializeAs: null })
  declare pendingUserId: number | null

  @column.dateTime()
  declare activatedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
