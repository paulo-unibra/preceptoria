import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // RNF03 / CA06 — quem alterou o quê, quando, valor anterior e novo.
    this.schema.createTable('audit_logs', (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().nullable().references('id').inTable('users')
      table.string('entity', 60).notNullable()
      table.integer('entity_id').unsigned().notNullable()
      table.integer('classroom_id').unsigned().nullable()
      table.string('action', 15).notNullable() // create | update | cancel
      table.text('changes').notNullable() // JSON: { campo: { old, new } }
      table.timestamp('created_at').notNullable()
      table.index(['entity', 'entity_id'])
      table.index(['classroom_id'])
    })

    // Parâmetros configuráveis (critérios do ranking, privacidade).
    this.schema.createTable('settings', (table) => {
      table.increments('id')
      table.string('key', 60).notNullable().unique()
      table.text('value').notNullable() // JSON
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable('settings')
    this.schema.dropTable('audit_logs')
  }
}
