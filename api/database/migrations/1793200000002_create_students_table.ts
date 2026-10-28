import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('students', (table) => {
      table.increments('id')
      table.string('full_name', 160).notNullable()
      table.string('registration', 40).nullable().unique()
      table.date('birth_date').nullable()
      table.string('photo_path').nullable()
      table.integer('classroom_id').unsigned().nullable().references('id').inTable('classrooms')
      table.text('tracking_notes').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['classroom_id'])
      table.index(['full_name'])
    })

    this.schema.createTable('guardians', (table) => {
      table.increments('id')
      table
        .integer('student_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('students')
        .onDelete('CASCADE')
      table.string('full_name', 160).notNullable()
      table.string('relationship', 60).nullable()
      table.string('phone', 30).nullable()
      table.boolean('is_primary').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['student_id'])
    })
  }

  async down() {
    this.schema.dropTable('guardians')
    this.schema.dropTable('students')
  }
}
