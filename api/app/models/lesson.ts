import { column, belongsTo, computed } from '@adonisjs/lucid/orm'
import { booleanColumn } from '#support/columns'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import AuditedModel from '#models/audited_model'
import LessonDay from '#models/lesson_day'

export default class Lesson extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare lessonDayId: number

  /** 1ª aula, 2ª aula, ... */
  @column()
  declare period: number

  @column()
  declare teacherName: string | null

  @column()
  declare subject: string | null

  @column()
  declare content: string | null

  @column()
  declare progress: string | null

  @column()
  declare notes: string | null

  /** RF-07: o preceptor não conseguiu identificar/acompanhar a aula. Nada é inventado. */
  @booleanColumn()
  declare notIdentified: boolean

  @column()
  declare notIdentifiedReason: string | null

  @belongsTo(() => LessonDay)
  declare lessonDay: BelongsTo<typeof LessonDay>

  /** Avisa campos vazios sem impedir o registro (situações justificadas). */
  @computed()
  get isComplete() {
    if (this.notIdentified) return true
    return !!(this.teacherName && this.subject && this.content)
  }

  get auditClassroomId() {
    return null
  }
}
