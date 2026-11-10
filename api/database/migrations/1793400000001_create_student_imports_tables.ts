import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('student_imports', (table) => {
      table.increments('id')
      table.string('file_hash', 64).notNullable().unique()
      table.string('filename', 255).notNullable()
      table.integer('classroom_id').unsigned().notNullable().references('id').inTable('classrooms')
      table.integer('user_id').unsigned().nullable().references('id').inTable('users')
      table.integer('school_year').notNullable()
      table.integer('students_count').notNullable()
      table.text('summary').notNullable()
      table.timestamp('created_at').notNullable()
    })
    this.schema.createTable('student_import_entries', (table) => {
      table.increments('id')
      table
        .integer('import_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('student_imports')
        .onDelete('CASCADE')
      table
        .integer('student_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('students')
        .onDelete('SET NULL')
      table.string('registration', 40).notNullable()
      table.text('profile').notNullable()
      table.unique(['import_id', 'registration'])
      table.index(['student_id', 'id'])
    })
  }
  async down() {
    this.schema.dropTable('student_import_entries')
    this.schema.dropTable('student_imports')
  }
}
