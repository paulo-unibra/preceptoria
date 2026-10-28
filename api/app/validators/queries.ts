import vine from '@vinejs/vine'
import { RECORD_TYPES } from '#services/history_service'
import { isoDate } from '#validators/shared'

export const historyQueryValidator = vine.compile(
  vine.object({
    from: isoDate().optional(),
    to: isoDate().optional(),
    types: vine.string().trim().optional(),
    include_cancelled: vine.boolean().optional(),
    format: vine.enum(['json', 'pdf'] as const).optional(),
    include_items: vine.boolean().optional(),
  })
)

export const dayReportQueryValidator = vine.compile(
  vine.object({
    date: isoDate(),
    format: vine.enum(['json', 'pdf'] as const).optional(),
  })
)

export const rankingQueryValidator = vine.compile(
  vine.object({
    kind: vine.enum(['weekly', 'biweekly'] as const).optional(),
    end: isoDate().optional(),
    classroom_id: vine.number().positive().optional(),
  })
)

export function parseTypes(value: string | undefined) {
  if (!value) return { types: undefined, invalid: [] as string[] }
  const requested = value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  const invalid = requested.filter((t) => !(RECORD_TYPES as readonly string[]).includes(t))
  return { types: requested as (typeof RECORD_TYPES)[number][], invalid }
}
