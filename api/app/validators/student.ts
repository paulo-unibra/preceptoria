import vine from '@vinejs/vine'
import { pastOrTodayDate, text } from '#validators/shared'

export const createStudentValidator = vine.compile(
  vine.object({
    full_name: vine.string().trim().minLength(3).maxLength(160),
    registration: vine.string().trim().maxLength(40).optional().nullable(),
    birth_date: pastOrTodayDate().optional().nullable(),
    classroom_id: vine.number().positive().optional().nullable(),
    tracking_notes: text(4000).optional().nullable(),
    is_active: vine.boolean().optional(),
  })
)

export const updateStudentValidator = vine.compile(
  vine.object({
    full_name: vine.string().trim().minLength(3).maxLength(160).optional(),
    registration: vine.string().trim().maxLength(40).optional().nullable(),
    birth_date: pastOrTodayDate().optional().nullable(),
    classroom_id: vine.number().positive().optional().nullable(),
    tracking_notes: text(4000).optional().nullable(),
    is_active: vine.boolean().optional(),
  })
)

export const createGuardianValidator = vine.compile(
  vine.object({
    full_name: vine.string().trim().minLength(3).maxLength(160),
    relationship: vine.string().trim().maxLength(60).optional().nullable(),
    phone: vine.string().trim().maxLength(30).optional().nullable(),
    is_primary: vine.boolean().optional(),
  })
)

export const updateGuardianValidator = vine.compile(
  vine.object({
    full_name: vine.string().trim().minLength(3).maxLength(160).optional(),
    relationship: vine.string().trim().maxLength(60).optional().nullable(),
    phone: vine.string().trim().maxLength(30).optional().nullable(),
    is_primary: vine.boolean().optional(),
    is_active: vine.boolean().optional(),
  })
)
