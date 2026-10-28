import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Atraso passa a ser registrado pelo horário de chegada (HH:mm) em vez de minutos.
 * Não há como converter minutos antigos em horário (a hora de início da aula não é conhecida).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('attendances', (table) => {
      table.dropColumn('minutes_late')
    })
    this.schema.alterTable('attendances', (table) => {
      table.string('arrival_time', 5).nullable()
    })
  }

  async down() {
    this.schema.alterTable('attendances', (table) => {
      table.dropColumn('arrival_time')
    })
    this.schema.alterTable('attendances', (table) => {
      table.integer('minutes_late').unsigned().nullable()
    })
  }
}
