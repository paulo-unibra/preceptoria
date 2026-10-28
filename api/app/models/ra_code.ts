import { column } from '@adonisjs/lucid/orm'
import { booleanColumn } from '#support/columns'
import AuditedModel from '#models/audited_model'
import type { Polarity } from '#support/ra'

export default class RaCode extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: number

  /** null = descrição oficial ainda não informada pela escola (DP05). */
  @column()
  declare description: string | null

  @column()
  declare polarity: Polarity

  @booleanColumn()
  declare isActive: boolean

  get auditClassroomId() {
    return null
  }
}
