import { column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import { booleanColumn } from '#support/columns'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import AuditedModel from '#models/audited_model'
import Student from '#models/student'
import User from '#models/user'

export default class Classroom extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare schoolYear: number

  @column()
  declare shift: 'morning' | 'afternoon' | 'evening' | 'full_time' | null

  @booleanColumn()
  declare isActive: boolean

  @hasMany(() => Student)
  declare students: HasMany<typeof Student>

  @manyToMany(() => User, { pivotTable: 'classroom_user', pivotTimestamps: true })
  declare users: ManyToMany<typeof User>

  get auditClassroomId() {
    return this.id
  }
}
