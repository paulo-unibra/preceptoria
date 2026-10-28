import vine from '@vinejs/vine'
import { USER_ROLES } from '#models/user'
import { text } from '#validators/shared'

export const createUserValidator = vine.compile(
  vine.object({
    full_name: vine.string().trim().minLength(3).maxLength(120),
    email: vine
      .string()
      .trim()
      .toLowerCase()
      .email()
      .unique(async (db, value) => !(await db.from('users').where('email', value).first())),
    password: vine.string().minLength(8).maxLength(128),
    role: vine.enum(USER_ROLES),
    is_active: vine.boolean().optional(),
    classroom_ids: vine.array(vine.number().positive()).distinct().optional(),
  })
)

export const updateUserValidator = vine.compile(
  vine.object({
    full_name: vine.string().trim().minLength(3).maxLength(120).optional(),
    email: vine.string().trim().toLowerCase().email().optional(),
    password: vine.string().minLength(8).maxLength(128).optional(),
    role: vine.enum(USER_ROLES).optional(),
    is_active: vine.boolean().optional(),
  })
)

export const syncClassroomsValidator = vine.compile(
  vine.object({ classroom_ids: vine.array(vine.number().positive()).distinct() })
)

const SHIFTS = ['morning', 'afternoon', 'evening', 'full_time'] as const

export const createClassroomValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80),
    school_year: vine.number().range([2000, 2100]),
    shift: vine.enum(SHIFTS).optional().nullable(),
    is_active: vine.boolean().optional(),
  })
)

export const updateClassroomValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(80).optional(),
    school_year: vine.number().range([2000, 2100]).optional(),
    shift: vine.enum(SHIFTS).optional().nullable(),
    is_active: vine.boolean().optional(),
  })
)

export const updateRaCodeValidator = vine.compile(
  vine.object({
    description: text(500).optional().nullable(),
    is_active: vine.boolean().optional(),
  })
)

const ROLES = ['admin', 'coordenacao', 'preceptor'] as const

export const rankingSettingsValidator = vine.compile(
  vine.object({
    period_days: vine.object({
      weekly: vine.number().range([1, 31]),
      biweekly: vine.number().range([1, 62]),
    }),
    top_n: vine.number().range([1, 50]),
    weights: vine.object({
      positive_ra: vine.number().range([-100, 100]),
      negative_ra: vine.number().range([-100, 100]),
      attendance_rate: vine.number().range([-100, 100]),
      uniform_rate: vine.number().range([-100, 100]),
      progress: vine.number().range([-100, 100]),
    }),
  })
)

export const privacySettingsValidator = vine.compile(
  vine.object({
    guardian_phone_roles: vine.array(vine.enum(ROLES)).distinct(),
    photo_roles: vine.array(vine.enum(ROLES)).distinct(),
  })
)
