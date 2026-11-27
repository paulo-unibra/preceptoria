import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('mcp_grants', (table) => {
      table.string('id', 64).primary()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .index()
      table.string('credential_version', 64).notNullable()
      table.string('scope', 80).notNullable()
      table.string('challenge', 43).notNullable()
      table.string('resource', 255).notNullable()
      table.string('code_hash', 64).nullable().unique()
      table.string('access_hash', 64).nullable().unique()
      table.string('refresh_hash', 64).nullable().unique()
      table.bigInteger('access_until').nullable()
      table.bigInteger('grant_until').notNullable().index()
    })
  }

  async down() {
    this.schema.dropTable('mcp_grants')
  }
}
