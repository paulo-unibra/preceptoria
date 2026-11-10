import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('student_nfc_cards', (table) => {
      table.increments('id')
      table
        .integer('student_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('students')
        .onDelete('CASCADE')
      table.string('token_hash', 64).nullable().unique()
      table.string('pending_hash', 64).nullable().unique()
      table.timestamp('pending_expires_at').nullable()
      table.integer('pending_user_id').unsigned().nullable().references('id').inTable('users')
      table.timestamp('activated_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable('student_nfc_cards')
  }
}
