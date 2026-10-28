import { BaseSchema } from '@adonisjs/lucid/schema'

/** Hora de início da aula, registrada a cada chamada (uma por turma e data). */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('attendance_sessions', (table) => {
      table.increments('id')
      table.integer('classroom_id').unsigned().notNullable().references('id').inTable('classrooms')
      table.date('date').notNullable()
      table.string('start_time', 5).notNullable() // HH:mm
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['classroom_id', 'date'])
    })
  }

  async down() {
    this.schema.dropTable('attendance_sessions')
  }
}
