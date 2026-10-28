import Attendance from '#models/attendance'
import Occurrence from '#models/occurrence'
import Student from '#models/student'
import UniformCheck from '#models/uniform_check'
import type User from '#models/user'
import ClassroomAccess from '#services/classroom_access'
import SettingsService, { type RankingSettings } from '#services/settings_service'
import { addDays } from '#support/dates'

export type RankingKind = 'weekly' | 'biweekly'

interface Components {
  positives: number
  negatives: number
  attendance_rate: number | null
  uniform_rate: number | null
}

export interface RankingEntry {
  position: number
  student: { id: number; full_name: string; classroom_id: number | null }
  score: number
  breakdown: {
    positive_ras: number
    attendance_rate: number | null
    uniform_rate: number | null
    progress: number
    points: {
      positive_ras: number
      negative_ras: number
      attendance: number
      uniform: number
      progress: number
    }
    negative_ras: number
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

async function componentsFor(
  studentIds: number[],
  from: string,
  to: string
): Promise<Map<number, Components>> {
  const map = new Map<number, Components>()
  if (!studentIds.length) return map
  const [occurrences, attendances, uniforms] = await Promise.all([
    Occurrence.query()
      .whereIn('student_id', studentIds)
      .where('status', 'active')
      .whereBetween('occurred_on', [from, to]),
    Attendance.query().whereIn('student_id', studentIds).whereBetween('date', [from, to]),
    UniformCheck.query().whereIn('student_id', studentIds).whereBetween('date', [from, to]),
  ])
  const get = (id: number) => {
    let c = map.get(id)
    if (!c) {
      c = { positives: 0, negatives: 0, attendance_rate: null, uniform_rate: null }
      map.set(id, c)
    }
    return c
  }
  occurrences.forEach((o) =>
    o.polarity === 'positive' ? get(o.studentId).positives++ : get(o.studentId).negatives++
  )

  const att = new Map<number, { total: number; ok: number }>()
  attendances.forEach((a) => {
    const x = att.get(a.studentId) ?? { total: 0, ok: 0 }
    // Falta justificada não pesa contra o estudante.
    if (a.status === 'absent' && a.isJustified) return void att.set(a.studentId, x)
    x.total++
    if (a.status !== 'absent') x.ok++
    att.set(a.studentId, x)
  })
  att.forEach((v, id) => {
    if (v.total) get(id).attendance_rate = v.ok / v.total
  })

  const uni = new Map<number, { total: number; ok: number }>()
  uniforms.forEach((u) => {
    // Só conta dias em que algo foi realmente observado (não inventa dado).
    if (u.uniformStatus === 'not_observed' && u.footwearStatus === 'not_observed') return
    const x = uni.get(u.studentId) ?? { total: 0, ok: 0 }
    x.total++
    if (u.uniformStatus !== 'inadequate' && u.footwearStatus !== 'inadequate') x.ok++
    uni.set(u.studentId, x)
  })
  uni.forEach((v, id) => {
    if (v.total) get(id).uniform_rate = v.ok / v.total
  })
  return map
}

/**
 * RF-03 — critérios transparentes e configuráveis (settings 'ranking').
 * Valoriza progresso (melhora em relação ao período anterior) e só exibe os destaques: estudantes sem
 * pontuação positiva não aparecem, evitando expor indevidamente quem está com dificuldades.
 */
export default class RankingService {
  static async build(user: User, opts: { kind: RankingKind; end: string; classroomId?: number }) {
    const settings: RankingSettings = await SettingsService.get('ranking')
    const days = settings.period_days[opts.kind]
    const to = opts.end
    const from = addDays(to, -(days - 1))
    const prevTo = addDays(from, -1)
    const prevFrom = addDays(prevTo, -(days - 1))

    const studentsQuery = Student.query().where('is_active', true).whereNotNull('classroom_id')
    await ClassroomAccess.scope(studentsQuery, user, 'classroom_id')
    if (opts.classroomId) studentsQuery.where('classroom_id', opts.classroomId)
    const students = await studentsQuery
    const ids = students.map((s) => s.id)

    const [current, previous] = await Promise.all([
      componentsFor(ids, from, to),
      componentsFor(ids, prevFrom, prevTo),
    ])
    const w = settings.weights

    const entries = students
      .map((s) => {
        const c = current.get(s.id)
        if (!c) return null
        const prev = previous.get(s.id)
        const netNow = c.positives - c.negatives
        const netBefore = prev ? prev.positives - prev.negatives : 0
        const progress = Math.max(0, netNow - netBefore)
        const points = {
          positive_ras: c.positives * w.positive_ra,
          negative_ras: c.negatives * w.negative_ra,
          attendance: (c.attendance_rate ?? 0) * w.attendance_rate,
          uniform: (c.uniform_rate ?? 0) * w.uniform_rate,
          progress: progress * w.progress,
        }
        const score = round2(
          points.positive_ras +
            points.negative_ras +
            points.attendance +
            points.uniform +
            points.progress
        )
        return { student: s, c, progress, points, score }
      })
      // Só quem tem ao menos um registro positivo e pontuação positiva é destacado.
      .filter((e): e is NonNullable<typeof e> => !!e && e.c.positives > 0 && e.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.student.fullName.localeCompare(b.student.fullName, 'pt-BR')
      )
      .slice(0, settings.top_n)

    let lastScore: number | null = null
    let lastPosition = 0
    const ranking: RankingEntry[] = entries.map((e, i) => {
      if (e.score !== lastScore) {
        lastPosition = i + 1
        lastScore = e.score
      }
      return {
        position: lastPosition,
        student: {
          id: e.student.id,
          full_name: e.student.fullName,
          classroom_id: e.student.classroomId,
        },
        score: e.score,
        breakdown: {
          positive_ras: e.c.positives,
          negative_ras: e.c.negatives,
          attendance_rate: e.c.attendance_rate === null ? null : round2(e.c.attendance_rate),
          uniform_rate: e.c.uniform_rate === null ? null : round2(e.c.uniform_rate),
          progress: e.progress,
          points: Object.fromEntries(
            Object.entries(e.points).map(([k, v]) => [k, round2(v)])
          ) as RankingEntry['breakdown']['points'],
        },
      }
    })

    return {
      kind: opts.kind,
      period: { from, to },
      previous_period: { from: prevFrom, to: prevTo },
      criteria: settings,
      data: ranking,
    }
  }
}
