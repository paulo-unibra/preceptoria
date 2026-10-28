import { column, belongsTo, beforeSave, computed } from '@adonisjs/lucid/orm'
import { booleanColumn } from '#support/columns'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import AuditedModel from '#models/audited_model'
import Student from '#models/student'
import { polarityForCode, type Polarity } from '#support/ra'

export type RecordStatus = 'active' | 'cancelled'
export type OccurrenceSource = 'app' | 'legacy'

export default class Occurrence extends AuditedModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare studentId: number

  @column()
  declare classroomId: number

  /** RN04: data do acontecimento. A data de cadastro é `createdAt`. */
  @column.date()
  declare occurredOn: DateTime

  @column()
  declare raCode: number

  @column()
  declare polarity: Polarity

  /** RN03: true quando a polaridade gravada diverge da faixa do código (registro antigo). */
  @booleanColumn()
  declare polarityDivergent: boolean

  @column()
  declare source: OccurrenceSource

  @column()
  declare description: string

  @column()
  declare context: string | null

  @column()
  declare lessonPeriod: number | null

  @column()
  declare reportedByName: string | null

  @column()
  declare status: RecordStatus

  @column.dateTime()
  declare cancelledAt: DateTime | null

  @column({ serializeAs: null })
  declare cancelledBy: number | null

  @column()
  declare cancelReason: string | null

  @column()
  declare possibleDuplicateOfId: number | null

  @column.dateTime()
  declare duplicateReviewedAt: DateTime | null

  @column({ serializeAs: null })
  declare duplicateReviewedBy: number | null

  @belongsTo(() => Student)
  declare student: BelongsTo<typeof Student>

  /** Polaridade que a faixa do código determina (RN01). Útil para conferir registros antigos. */
  @computed()
  get expectedPolarity(): Polarity | null {
    return polarityForCode(this.raCode)
  }

  /** Divergência de polaridade (RN03) ou possível duplicidade ainda não revisada (RN08). */
  @computed()
  get needsReview(): boolean {
    if (this.status === 'cancelled') return false
    return this.polarityDivergent || (!!this.possibleDuplicateOfId && !this.duplicateReviewedAt)
  }

  /**
   * RN01/RN02/CA01: em registros criados pelo app a polaridade é SEMPRE derivada do código
   * (o RA 09 nunca vira negativo). RN03/CA02: em registros legados o valor original é preservado
   * e a divergência apenas sinalizada para conferência.
   */
  @beforeSave()
  static applyPolarityRules(occurrence: Occurrence) {
    const expected = polarityForCode(occurrence.raCode)
    if (!expected) return
    if (occurrence.source === 'legacy') {
      occurrence.polarityDivergent = occurrence.polarity !== expected
    } else {
      occurrence.polarity = expected
      occurrence.polarityDivergent = false
    }
  }
}
