import { column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import AuditedModel from '#models/audited_model'
import Lesson from '#models/lesson'

export default class LessonDay extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare classroomId: number

  @column.date()
  declare date: DateTime

  @column()
  declare plannedLessons: number

  @column()
  declare note: string | null

  @hasMany(() => Lesson)
  declare lessons: HasMany<typeof Lesson>
}
