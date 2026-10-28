import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('ra_codes', (table) => {
      table.increments('id')
      table.integer('code').notNullable().unique()
      // Descrição oficial pendente (DP05): nula até que a escola informe.
      table.text('description').nullable()
      table.string('polarity', 10).notNullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable('ra_codes')
  }
}
