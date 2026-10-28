import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // RF-05 — frequência (DP02: registrada por dia).
    this.schema.createTable('attendances', (table) => {
      table.increments('id')
      table.integer('student_id').unsigned().notNullable().references('id').inTable('students')
      table.integer('classroom_id').unsigned().notNullable().references('id').inTable('classrooms')
      table.date('date').notNullable()
      table.string('status', 10).notNullable() // present | absent | late
      table.integer('minutes_late').unsigned().nullable()
      table.boolean('is_justified').notNullable().defaultTo(false)
      table.text('note').nullable()
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['student_id', 'date'])
      table.index(['classroom_id', 'date'])
    })

    // RF-02 — checklist de fardamento e calçado.
    this.schema.createTable('uniform_checks', (table) => {
      table.increments('id')
      table.integer('student_id').unsigned().notNullable().references('id').inTable('students')
      table.integer('classroom_id').unsigned().notNullable().references('id').inTable('classrooms')
      table.date('date').notNullable()
      table.string('uniform_status', 15).notNullable() // adequate | inadequate | not_observed
      table.string('footwear_status', 15).notNullable()
      table.text('note').nullable()
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['student_id', 'date'])
      table.index(['classroom_id', 'date'])
    })

    // RF-06 / RF-07 — registro diário das aulas.
    this.schema.createTable('lesson_days', (table) => {
      table.increments('id')
      table.integer('classroom_id').unsigned().notNullable().references('id').inTable('classrooms')
      table.date('date').notNullable()
      table.integer('planned_lessons').unsigned().notNullable()
      table.text('note').nullable()
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['classroom_id', 'date'])
    })

    this.schema.createTable('lessons', (table) => {
      table.increments('id')
      table
        .integer('lesson_day_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('lesson_days')
        .onDelete('CASCADE')
      table.integer('period').unsigned().notNullable()
      table.string('teacher_name', 120).nullable()
      table.string('subject', 120).nullable()
      table.text('content').nullable()
      table.text('progress').nullable()
      table.text('notes').nullable()
      table.boolean('not_identified').notNullable().defaultTo(false)
      table.text('not_identified_reason').nullable()
      table.integer('created_by').unsigned().nullable().references('id').inTable('users')
      table.integer('updated_by').unsigned().nullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['lesson_day_id', 'period'])
    })
  }

  async down() {
    this.schema.dropTable('lessons')
    this.schema.dropTable('lesson_days')
    this.schema.dropTable('uniform_checks')
    this.schema.dropTable('attendances')
  }
}
