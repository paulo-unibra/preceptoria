import { column, belongsTo } from '@adonisjs/lucid/orm'
import { booleanColumn } from '#support/columns'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import AuditedModel from '#models/audited_model'
import Student from '#models/student'

export default class Guardian extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare studentId: number

  @column()
  declare fullName: string

  @column()
  declare relationship: string | null

  @column()
  declare phone: string | null

  @booleanColumn()
  declare isPrimary: boolean

  @booleanColumn()
  declare isActive: boolean

  @belongsTo(() => Student)
  declare student: BelongsTo<typeof Student>

  get auditClassroomId() {
    return null
  }
}
