import type { Request } from '@adonisjs/core/http'

export function pageParams(request: Request, defaultPerPage = 50) {
  const page = Math.max(1, Number(request.input('page', 1)) || 1)
  const perPage = Math.min(
    200,
    Math.max(1, Number(request.input('per_page', defaultPerPage)) || defaultPerPage)
  )
  return { page, perPage }
}

export function boolParam(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return value === true || value === 'true' || value === '1' || value === 1
}

export function toId(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : undefined
}
