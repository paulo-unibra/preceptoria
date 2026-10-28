export type Polarity = 'positive' | 'negative'

export const RA_MIN_CODE = 1
export const RA_MAX_POSITIVE = 9
export const RA_MAX_CODE = 21

/**
 * RN01: códigos 01 a 09 são positivos; 10 a 21 são negativos.
 * RN02: o código 09 é sempre positivo (está dentro da faixa positiva).
 * Retorna null para códigos fora da faixa conhecida.
 */
export function polarityForCode(code: number): Polarity | null {
  if (!Number.isInteger(code) || code < RA_MIN_CODE || code > RA_MAX_CODE) return null
  return code <= RA_MAX_POSITIVE ? 'positive' : 'negative'
}
