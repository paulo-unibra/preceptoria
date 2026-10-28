import { column } from '@adonisjs/lucid/orm'

/**
 * Coluna booleana. SQLite devolve 0/1; aqui normalizamos para true/false (PostgreSQL já devolve boolean).
 */
export const booleanColumn = () =>
  column({
    consume: (value: unknown) => (value === null || value === undefined ? value : Boolean(value)),
  })
