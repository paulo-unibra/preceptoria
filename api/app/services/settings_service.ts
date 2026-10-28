import Setting from '#models/setting'

export interface RankingSettings {
  /** Tamanho da janela por período do ranking. */
  period_days: { weekly: number; biweekly: number }
  /** Quantos estudantes são destacados. Apenas os melhores aparecem: ninguém é exposto por baixo desempenho. */
  top_n: number
  weights: {
    /** Pontos por RA positivo. */
    positive_ra: number
    /** Pontos (normalmente negativos) por RA negativo. */
    negative_ra: number
    /** Pontos multiplicados pela taxa de presença (0 a 1). */
    attendance_rate: number
    /** Pontos multiplicados pela taxa de fardamento/calçado adequados (0 a 1). */
    uniform_rate: number
    /** Pontos por unidade de melhora (RAs positivos - negativos) em relação ao período anterior. */
    progress: number
  }
}

export interface PrivacySettings {
  guardian_phone_roles: string[]
  photo_roles: string[]
}

export const DEFAULT_SETTINGS = {
  ranking: {
    period_days: { weekly: 7, biweekly: 14 },
    top_n: 5,
    weights: { positive_ra: 3, negative_ra: -1, attendance_rate: 5, uniform_rate: 2, progress: 2 },
  } satisfies RankingSettings,
  privacy: {
    guardian_phone_roles: ['admin', 'coordenacao', 'preceptor'],
    photo_roles: ['admin', 'coordenacao', 'preceptor'],
  } satisfies PrivacySettings,
}

export type SettingKey = keyof typeof DEFAULT_SETTINGS

export default class SettingsService {
  static async get<K extends SettingKey>(key: K): Promise<(typeof DEFAULT_SETTINGS)[K]> {
    const row = await Setting.findBy('key', key)
    return (
      row ? { ...DEFAULT_SETTINGS[key], ...row.value } : DEFAULT_SETTINGS[key]
    ) as (typeof DEFAULT_SETTINGS)[K]
  }

  static async set<K extends SettingKey>(key: K, value: (typeof DEFAULT_SETTINGS)[K]) {
    const row = await Setting.findBy('key', key)
    if (row) {
      row.value = value
      await row.save()
    } else {
      await Setting.create({ key, value })
    }
    return value
  }
}
