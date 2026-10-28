import vine from '@vinejs/vine'
import { RA_MAX_CODE, RA_MIN_CODE } from '#support/ra'
import { pastOrTodayDate, requiredText, text } from '#validators/shared'

export const createOccurrenceValidator = vine.compile(
  vine.object({
    student_id: vine.number().positive(),
    occurred_on: pastOrTodayDate(),
    ra_code: vine.number().range([RA_MIN_CODE, RA_MAX_CODE]),
    description: requiredText(3, 2000),
    context: text(500).optional().nullable(),
    lesson_period: vine.number().range([1, 12]).optional().nullable(),
    reported_by_name: vine.string().trim().maxLength(120).optional().nullable(),
  })
)

export const updateOccurrenceValidator = vine.compile(
  vine.object({
    occurred_on: pastOrTodayDate().optional(),
    ra_code: vine.number().range([RA_MIN_CODE, RA_MAX_CODE]).optional(),
    description: requiredText(3, 2000).optional(),
    context: text(500).optional().nullable(),
    lesson_period: vine.number().range([1, 12]).optional().nullable(),
    reported_by_name: vine.string().trim().maxLength(120).optional().nullable(),
  })
)

export const cancelValidator = vine.compile(vine.object({ reason: requiredText(3, 500) }))

export const createNotificationValidator = vine.compile(
  vine.object({
    student_id: vine.number().positive(),
    notified_on: pastOrTodayDate(),
    reason: requiredText(3, 2000),
    occurrence_id: vine.number().positive().optional().nullable(),
    guardian_informed: vine.boolean().optional(),
  })
)

export const updateNotificationValidator = vine.compile(
  vine.object({
    notified_on: pastOrTodayDate().optional(),
    reason: requiredText(3, 2000).optional(),
    occurrence_id: vine.number().positive().optional().nullable(),
    guardian_informed: vine.boolean().optional(),
  })
)

export const createReferralValidator = vine.compile(
  vine.object({
    student_id: vine.number().positive(),
    occurrence_id: vine.number().positive().optional().nullable(),
    referred_to: vine.enum(['coordination', 'management'] as const),
    referred_on: pastOrTodayDate(),
    reason: requiredText(3, 2000),
    action_taken: text(2000).optional().nullable(),
    is_confidential: vine.boolean().optional(),
    guardian_contacted_on: pastOrTodayDate().optional().nullable(),
    guardian_contact_result: text(2000).optional().nullable(),
  })
)

export const updateReferralValidator = vine.compile(
  vine.object({
    referred_to: vine.enum(['coordination', 'management'] as const).optional(),
    reason: requiredText(3, 2000).optional(),
    action_taken: text(2000).optional().nullable(),
    status: vine.enum(['open', 'in_progress', 'resolved'] as const).optional(),
    resolved_on: pastOrTodayDate().optional().nullable(),
    is_confidential: vine.boolean().optional(),
    guardian_contacted_on: pastOrTodayDate().optional().nullable(),
    guardian_contact_result: text(2000).optional().nullable(),
  })
)

export const createObservationValidator = vine.compile(
  vine.object({
    student_id: vine.number().positive(),
    observed_on: pastOrTodayDate(),
    content: requiredText(3, 4000),
  })
)

export const updateObservationValidator = vine.compile(
  vine.object({
    observed_on: pastOrTodayDate().optional(),
    content: requiredText(3, 4000).optional(),
  })
)
