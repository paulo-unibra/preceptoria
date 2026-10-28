import vine from '@vinejs/vine'
import { ISO_DATE_REGEX, parseDate, todayISO } from '#support/dates'

const validDate = vine.createRule((value, _options, field) => {
  if (typeof value !== 'string') return
  if (!parseDate(value).isValid)
    field.report(
      'O campo {{ field }} deve ser uma data válida (AAAA-MM-DD).',
      'date.invalid',
      field
    )
})

const notFuture = vine.createRule((value, _options, field) => {
  if (typeof value !== 'string') return
  if (value > todayISO())
    field.report('O campo {{ field }} não pode ser uma data futura.', 'date.future', field)
})

/** Data no formato AAAA-MM-DD, validada de verdade (rejeita 2026-02-31). */
export const isoDate = () => vine.string().trim().regex(ISO_DATE_REGEX).use(validDate())

/** Data AAAA-MM-DD que não pode estar no futuro (data de fatos já ocorridos). */
export const pastOrTodayDate = () => isoDate().use(notFuture())

export const text = (max = 2000) => vine.string().trim().maxLength(max)
export const requiredText = (min = 3, max = 2000) =>
  vine.string().trim().minLength(min).maxLength(max)

export const periodQuery = vine.compile(
  vine.object({
    from: isoDate().optional(),
    to: isoDate().optional(),
  })
)

export const idParam = (value: unknown) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}
