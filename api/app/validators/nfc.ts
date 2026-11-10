import vine from '@vinejs/vine'
import { pastOrTodayDate } from '#validators/shared'

const token = () => vine.string().regex(/^[a-f0-9]{64}$/)

export const activateNfcValidator = vine.compile(vine.object({ token: token() }))

export const nfcAttendanceValidator = vine.compile(
  vine.object({
    token: token(),
    classroom_id: vine.number().positive().withoutDecimals(),
    date: pastOrTodayDate(),
    start_time: vine.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
)
