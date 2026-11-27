import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('classroom_events', (table) => {
      table.increments('id')
      table
        .integer('classroom_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('classrooms')
        .onDelete('CASCADE')
      table.date('date').notNullable()
      table.string('kind', 32).notNullable()
      table.string('title', 160).notNullable()
      table.text('description').notNullable()
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.integer('updated_by').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at')
      table.index(['classroom_id', 'date', 'id'])
    })
  }

  async down() {
    this.schema.dropTable('classroom_events')
  }
}
