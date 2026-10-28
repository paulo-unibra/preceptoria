import { column } from '@adonisjs/lucid/orm'
import AuditedModel from '#models/audited_model'

export default class Setting extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare key: string

  @column({
    prepare: (value: unknown) => JSON.stringify(value),
    consume: (value: string | unknown) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare value: any

  get auditClassroomId() {
    return null
  }
}
