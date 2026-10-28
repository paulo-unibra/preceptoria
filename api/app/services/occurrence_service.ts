import db from '@adonisjs/lucid/services/db'
import Occurrence from '#models/occurrence'
import RaCode from '#models/ra_code'
import type Student from '#models/student'
import { invalid } from '#support/errors'
import { parseDate } from '#support/dates'

export interface OccurrenceInput {
  occurred_on: string
  ra_code: number
  description: string
  context?: string | null
  lesson_period?: number | null
  reported_by_name?: string | null
}

export interface Warning {
  code: string
  message: string
  related_id?: number
}

export default class OccurrenceService {
  /** O código precisa existir na tabela de RAs e estar ativo. */
  static async assertCodeUsable(code: number) {
    const ra = await RaCode.findBy('code', code)
    if (!ra || !ra.isActive)
      throw invalid(`O código RA ${String(code).padStart(2, '0')} não está disponível.`)
    return ra
  }

  /** RN08: procura outro RA ativo do mesmo estudante, na mesma data e com o mesmo código. Só sinaliza. */
  static async findPossibleDuplicate(
    studentId: number,
    occurredOn: string,
    raCode: number,
    ignoreId?: number
  ) {
    const query = Occurrence.query()
      .where({ student_id: studentId, occurred_on: occurredOn, ra_code: raCode, status: 'active' })
      .orderBy('id')
    if (ignoreId) query.whereNot('id', ignoreId)
    return query.first()
  }

  static warningsFor(occurrence: Occurrence): Warning[] {
    const warnings: Warning[] = []
    if (occurrence.possibleDuplicateOfId && !occurrence.duplicateReviewedAt) {
      warnings.push({
        code: 'possible_duplicate',
        message:
          'Já existe um RA com o mesmo código para este estudante nesta data. Confira se não é duplicado.',
        related_id: occurrence.possibleDuplicateOfId,
      })
    }
    if (occurrence.polarityDivergent) {
      warnings.push({
        code: 'polarity_divergent',
        message: `Registro antigo: a polaridade gravada (${occurrence.polarity}) diverge da faixa do código RA ${occurrence.raCode}. O valor original foi preservado para conferência.`,
      })
    }
    return warnings
  }

  static async create(student: Student, input: OccurrenceInput) {
    await OccurrenceService.assertCodeUsable(input.ra_code)
    const duplicate = await OccurrenceService.findPossibleDuplicate(
      student.id,
      input.occurred_on,
      input.ra_code
    )

    return db.transaction(async (trx) => {
      return Occurrence.create(
        {
          studentId: student.id,
          classroomId: student.classroomId!,
          occurredOn: parseDate(input.occurred_on),
          raCode: input.ra_code,
          // A polaridade é recalculada pelo hook do model (RN01/RN02); este valor é só um ponto de partida.
          polarity: input.ra_code <= 9 ? 'positive' : 'negative',
          source: 'app',
          description: input.description,
          context: input.context ?? null,
          lessonPeriod: input.lesson_period ?? null,
          reportedByName: input.reported_by_name ?? null,
          status: 'active',
          possibleDuplicateOfId: duplicate?.id ?? null,
        },
        { client: trx }
      )
    })
  }

  static async update(occurrence: Occurrence, input: Partial<OccurrenceInput>) {
    if (input.ra_code !== undefined && input.ra_code !== occurrence.raCode) {
      await OccurrenceService.assertCodeUsable(input.ra_code)
    }
    occurrence.merge({
      ...(input.occurred_on !== undefined && { occurredOn: parseDate(input.occurred_on) }),
      ...(input.ra_code !== undefined && { raCode: input.ra_code }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.context !== undefined && { context: input.context }),
      ...(input.lesson_period !== undefined && { lessonPeriod: input.lesson_period }),
      ...(input.reported_by_name !== undefined && { reportedByName: input.reported_by_name }),
    })

    // Mudou data ou código: reavalia duplicidade e zera revisões anteriores.
    if (occurrence.$dirty.occurredOn || occurrence.$dirty.raCode) {
      const duplicate = await OccurrenceService.findPossibleDuplicate(
        occurrence.studentId,
        occurrence.occurredOn.toISODate()!,
        occurrence.raCode,
        occurrence.id
      )
      occurrence.possibleDuplicateOfId = duplicate?.id ?? null
      occurrence.duplicateReviewedAt = null
      occurrence.duplicateReviewedBy = null
    }
    await occurrence.save()
    return occurrence
  }
}
