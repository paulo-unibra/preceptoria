import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // RF-08 — ocorrências / Registros de Acompanhamento (RA).
    this.schema.createTable('occurrences', (table) => {
      table.increments('id')
      table.integer('student_id').unsigned().notNullable().references('id').inTable('students')
      table.integer('classroom_id').unsigned().notNullable().references('id').inTable('classrooms')
      // RN04: data do acontecimento (occurred_on) e data de cadastro (created_at) separadas.
      table.date('occurred_on').notNullable()
      table.integer('ra_code').unsigned().notNullable()
      table.string('polarity', 10).notNullable()
      // RN03: divergência entre código e polaridade preservada e sinalizada, nunca "corrigida" em silêncio.
      table.boolean('polarity_divergent').notNullable().defaultTo(false)
      table.string('source', 10).notNullable().defaultTo('app') // app | legacy
      table.text('description').notNullable()
      table.text('context').nullable()
      table.integer('lesson_period').unsigned().nullable()
      table.string('reported_by_name', 120).nullable()
      table.string('status', 10).notNullable().defaultTo('active') // active | cancelled
      table.timestamp('cancelled_at').nullable()
      table.integer('cancelled_by').unsigned().nullable().references('id').inTable('users')
      table.text('cancel_reason').nullable()
      // RN08: possível duplicidade apenas sinalizada; nada é excluído automaticamente.
      table
        .integer('possible_duplicate_of_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('occurrences')
      table.timestamp('duplicate_reviewed_at').nullable()
      table.integer('duplicate_reviewed_by').unsigned().nullable().references('id').inTable('users')
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['student_id', 'occurred_on'])
      table.index(['classroom_id', 'occurred_on'])
    })

    // RN06/RN07: notificação é entidade própria; vincular a uma ocorrência não cria outra ocorrência.
    this.schema.createTable('notifications', (table) => {
      table.increments('id')
      table.integer('student_id').unsigned().notNullable().references('id').inTable('students')
      table.integer('classroom_id').unsigned().notNullable().references('id').inTable('classrooms')
      table.integer('occurrence_id').unsigned().nullable().references('id').inTable('occurrences')
      table.date('notified_on').notNullable()
      table.text('reason').notNullable()
      // DP03: por ora apenas registro; indica se o responsável foi informado fora do sistema.
      table.boolean('guardian_informed').notNullable().defaultTo(false)
      table.timestamp('guardian_informed_at').nullable()
      table.string('status', 10).notNullable().defaultTo('active')
      table.timestamp('cancelled_at').nullable()
      table.integer('cancelled_by').unsigned().nullable().references('id').inTable('users')
      table.text('cancel_reason').nullable()
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['student_id', 'notified_on'])
      table.index(['classroom_id', 'notified_on'])
    })

    // RF-11 — encaminhamentos.
    this.schema.createTable('referrals', (table) => {
      table.increments('id')
      table.integer('student_id').unsigned().notNullable().references('id').inTable('students')
      table.integer('classroom_id').unsigned().notNullable().references('id').inTable('classrooms')
      table.integer('occurrence_id').unsigned().nullable().references('id').inTable('occurrences')
      table.string('referred_to', 15).notNullable() // coordination | management
      table.date('referred_on').notNullable()
      table.text('reason').notNullable()
      table.text('action_taken').nullable()
      table.string('status', 15).notNullable().defaultTo('open') // open | in_progress | resolved | cancelled
      table.date('resolved_on').nullable()
      table.date('guardian_contacted_on').nullable()
      table.text('guardian_contact_result').nullable()
      table.boolean('is_confidential').notNullable().defaultTo(false)
      table.text('cancel_reason').nullable()
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['student_id', 'referred_on'])
      table.index(['status'])
    })

    // RF-09 — observações livres na ficha do estudante.
    this.schema.createTable('student_observations', (table) => {
      table.increments('id')
      table.integer('student_id').unsigned().notNullable().references('id').inTable('students')
      table.integer('classroom_id').unsigned().notNullable().references('id').inTable('classrooms')
      table.date('observed_on').notNullable()
      table.text('content').notNullable()
      table.string('status', 10).notNullable().defaultTo('active')
      table.timestamp('cancelled_at').nullable()
      table.integer('cancelled_by').unsigned().nullable().references('id').inTable('users')
      table.text('cancel_reason').nullable()
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['student_id', 'observed_on'])
    })
  }

  async down() {
    this.schema.dropTable('student_observations')
    this.schema.dropTable('referrals')
    this.schema.dropTable('notifications')
    this.schema.dropTable('occurrences')
  }
}
