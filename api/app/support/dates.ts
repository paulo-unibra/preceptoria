import { DateTime } from 'luxon'

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function parseDate(value: string): DateTime {
  return DateTime.fromISO(value, { zone: 'utc' })
}

export function todayISO(): string {
  return DateTime.now().toISODate()!
}

/** Soma `days` dias a uma data ISO (YYYY-MM-DD). */
export function addDays(iso: string, days: number): string {
  return parseDate(iso).plus({ days }).toISODate()!
}

/** Número de dias entre duas datas ISO (inclusive nas duas pontas). */
export function daysInclusive(from: string, to: string): number {
  return Math.floor(parseDate(to).diff(parseDate(from), 'days').days) + 1
}
