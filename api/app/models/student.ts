import { column, belongsTo, computed, hasMany } from '@adonisjs/lucid/orm'
import { booleanColumn } from '#support/columns'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import AuditedModel from '#models/audited_model'
import Classroom from '#models/classroom'
import Guardian from '#models/guardian'

export default class Student extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string

  @column()
  declare registration: string | null

  @column.date()
  declare birthDate: DateTime | null

  /** Caminho interno da foto: nunca exposto na API (a foto é servida por rota autenticada). */
  @column({ serializeAs: null })
  declare photoPath: string | null

  @column()
  declare classroomId: number | null

  @column()
  declare trackingNotes: string | null

  @booleanColumn()
  declare isActive: boolean

  @belongsTo(() => Classroom)
  declare classroom: BelongsTo<typeof Classroom>

  @hasMany(() => Guardian)
  declare guardians: HasMany<typeof Guardian>

  @computed()
  get hasPhoto() {
    return !!this.photoPath
  }

  get auditClassroomId() {
    return this.classroomId
  }
}
