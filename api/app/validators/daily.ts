import vine from '@vinejs/vine'
import { ATTENDANCE_STATUSES } from '#models/attendance'
import { CHECKLIST_STATUSES } from '#models/uniform_check'
import { isoDate, pastOrTodayDate, text } from '#validators/shared'

export const rosterQueryValidator = vine.compile(
  vine.object({
    classroom_id: vine.number().positive(),
    date: isoDate(),
  })
)

export const bulkAttendanceValidator = vine.compile(
  vine.object({
    classroom_id: vine.number().positive(),
    date: pastOrTodayDate(),
    // Hora de início da aula: obrigatória em toda chamada (HH:mm).
    start_time: vine
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    records: vine
      .array(
        vine.object({
          student_id: vine.number().positive(),
          status: vine.enum(ATTENDANCE_STATUSES),
          arrival_time: vine
            .string()
            .trim()
            .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
            .optional()
            .nullable(),
          is_justified: vine.boolean().optional(),
          note: text(500).optional().nullable(),
        })
      )
      .minLength(1)
      .maxLength(200)
      .distinct('student_id'),
  })
)

export const bulkUniformValidator = vine.compile(
  vine.object({
    classroom_id: vine.number().positive(),
    date: pastOrTodayDate(),
    records: vine
      .array(
        vine.object({
          student_id: vine.number().positive(),
          uniform_status: vine.enum(CHECKLIST_STATUSES),
          footwear_status: vine.enum(CHECKLIST_STATUSES),
          note: text(500).optional().nullable(),
        })
      )
      .minLength(1)
      .maxLength(200)
      .distinct('student_id'),
  })
)

export const upsertLessonDayValidator = vine.compile(
  vine.object({
    classroom_id: vine.number().positive(),
    date: pastOrTodayDate(),
    planned_lessons: vine.number().range([1, 12]),
    note: text(1000).optional().nullable(),
    lessons: vine
      .array(
        vine.object({
          period: vine.number().range([1, 12]),
          teacher_name: vine.string().trim().maxLength(120).optional().nullable(),
          subject: vine.string().trim().maxLength(120).optional().nullable(),
          content: text(2000).optional().nullable(),
          progress: text(2000).optional().nullable(),
          notes: text(2000).optional().nullable(),
          not_identified: vine.boolean().optional(),
          not_identified_reason: text(500).optional().nullable(),
        })
      )
      .maxLength(12)
      .distinct('period')
      .optional(),
  })
)
