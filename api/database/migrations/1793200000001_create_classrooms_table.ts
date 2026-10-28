import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('classrooms', (table) => {
      table.increments('id')
      table.string('name', 80).notNullable()
      table.integer('school_year').notNullable()
      table.string('shift', 20).nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['name', 'school_year'])
    })

    // Turmas sob responsabilidade (preceptor) ou gestão (coordenação) de cada usuário.
    this.schema.createTable('classroom_user', (table) => {
      table.increments('id')
      table
        .integer('classroom_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('classrooms')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['classroom_id', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTable('classroom_user')
    this.schema.dropTable('classrooms')
  }
}
