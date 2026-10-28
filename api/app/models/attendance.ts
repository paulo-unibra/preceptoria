import { column, belongsTo } from '@adonisjs/lucid/orm'
import { booleanColumn } from '#support/columns'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import AuditedModel from '#models/audited_model'
import Student from '#models/student'

export type AttendanceStatus = 'present' | 'absent' | 'late'
export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late']

export default class Attendance extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare studentId: number

  @column()
  declare classroomId: number

  @column.date()
  declare date: DateTime

  @column()
  declare status: AttendanceStatus

  @column()
  declare minutesLate: number | null

  @booleanColumn()
  declare isJustified: boolean

  @column()
  declare note: string | null

  @belongsTo(() => Student)
  declare student: BelongsTo<typeof Student>
}
