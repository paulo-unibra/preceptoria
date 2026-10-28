import Attendance from '#models/attendance'
import Notification from '#models/notification'
import Occurrence from '#models/occurrence'
import Referral from '#models/referral'
import Student from '#models/student'
import StudentObservation from '#models/student_observation'
import UniformCheck from '#models/uniform_check'
import LessonDay from '#models/lesson_day'
import type User from '#models/user'
import { visibleReferralsScope } from '#services/referral_access'

export const RECORD_TYPES = [
  'attendance',
  'uniform_check',
  'occurrence',
  'notification',
  'referral',
  'observation',
] as const
export type RecordType = (typeof RECORD_TYPES)[number]

export interface Period {
  from: string | null
  to: string | null
}

export interface HistoryFilters {
  studentId?: number
  classroomId?: number
  period: Period
  types?: RecordType[]
  includeCancelled?: boolean
}

export interface Records {
  attendances: Attendance[]
  uniforms: UniformCheck[]
  occurrences: Occurrence[]
  notifications: Notification[]
  referrals: Referral[]
  observations: StudentObservation[]
}

export interface Totals {
  attendance: {
    records: number
    present: number
    absent: number
    absent_justified: number
    late: number
    minutes_late: number
  }
  uniform: {
    records: number
    uniform_adequate: number
    uniform_inadequate: number
    footwear_adequate: number
    footwear_inadequate: number
  }
  occurrences: { total: number; positive: number; negative: number; needs_review: number }
  notifications: { total: number; linked_to_occurrence: number; guardian_informed: number }
  referrals: { total: number; open: number; in_progress: number; resolved: number }
  observations: { total: number }
  cancelled: { occurrences: number; notifications: number; referrals: number; observations: number }
}

export interface TimelineItem {
  type: RecordType
  id: number
  student_id: number
  date: string
  registered_at: string
  status: string
  label: string
  data: Record<string, any>
}

const iso = (d: any) => d?.toISODate?.() ?? String(d)

/**
 * Busca TODOS os registros do escopo/período/filtros uma única vez. Totais e detalhes de relatórios e
 * históricos são derivados desta mesma coleção (RN05, RNF04, CA03, CA05), então nunca divergem.
 */
export async function fetchRecords(user: User, filters: HistoryFilters): Promise<Records> {
  const { studentId, classroomId, period, includeCancelled } = filters
  const wants = (t: RecordType) => !filters.types || filters.types.includes(t)

  const scoped = (query: any, dateColumn: string, withStatus: boolean): any => {
    if (studentId) query.where('student_id', studentId)
    if (classroomId) query.where('classroom_id', classroomId)
    if (period.from) query.where(dateColumn, '>=', period.from)
    if (period.to) query.where(dateColumn, '<=', period.to)
    if (withStatus && !includeCancelled) query.where('status', 'active')
    query.orderBy(dateColumn, 'asc').orderBy('id', 'asc')
    return query
  }

  const none = Promise.resolve([] as any[])
  const [attendances, uniforms, occurrences, notifications, referrals, observations] =
    await Promise.all([
      wants('attendance') ? scoped(Attendance.query(), 'date', false) : none,
      wants('uniform_check') ? scoped(UniformCheck.query(), 'date', false) : none,
      wants('occurrence') ? scoped(Occurrence.query(), 'occurred_on', true) : none,
      wants('notification') ? scoped(Notification.query(), 'notified_on', true) : none,
      wants('referral')
        ? (() => {
            const q = scoped(Referral.query(), 'referred_on', false)
            if (!includeCancelled) q.whereNot('status', 'cancelled')
            return visibleReferralsScope(q, user)
          })()
        : none,
      wants('observation') ? scoped(StudentObservation.query(), 'observed_on', true) : none,
    ])
  return { attendances, uniforms, occurrences, notifications, referrals, observations }
}

export function emptyTotals(): Totals {
  return {
    attendance: {
      records: 0,
      present: 0,
      absent: 0,
      absent_justified: 0,
      late: 0,
      minutes_late: 0,
    },
    uniform: {
      records: 0,
      uniform_adequate: 0,
      uniform_inadequate: 0,
      footwear_adequate: 0,
      footwear_inadequate: 0,
    },
    occurrences: { total: 0, positive: 0, negative: 0, needs_review: 0 },
    notifications: { total: 0, linked_to_occurrence: 0, guardian_informed: 0 },
    referrals: { total: 0, open: 0, in_progress: 0, resolved: 0 },
    observations: { total: 0 },
    cancelled: { occurrences: 0, notifications: 0, referrals: 0, observations: 0 },
  }
}

/**
 * RN07: faltas (frequência), notificações e RAs são contados separadamente.
 * RN06: a notificação vinculada a uma ocorrência continua sendo só notificação (não soma em RAs).
 * Registros cancelados não entram nos totais; aparecem em `cancelled`.
 */
export function summarize(records: Records): Totals {
  const t = emptyTotals()

  for (const a of records.attendances) {
    t.attendance.records++
    if (a.status === 'present') t.attendance.present++
    else if (a.status === 'absent') {
      t.attendance.absent++
      if (a.isJustified) t.attendance.absent_justified++
    } else if (a.status === 'late') {
      t.attendance.late++
      t.attendance.minutes_late += a.minutesLate ?? 0
    }
  }

  for (const u of records.uniforms) {
    t.uniform.records++
    if (u.uniformStatus === 'adequate') t.uniform.uniform_adequate++
    if (u.uniformStatus === 'inadequate') t.uniform.uniform_inadequate++
    if (u.footwearStatus === 'adequate') t.uniform.footwear_adequate++
    if (u.footwearStatus === 'inadequate') t.uniform.footwear_inadequate++
  }

  for (const o of records.occurrences) {
    if (o.status === 'cancelled') {
      t.cancelled.occurrences++
      continue
    }
    t.occurrences.total++
    if (o.polarity === 'positive') t.occurrences.positive++
    else t.occurrences.negative++
    if (o.needsReview) t.occurrences.needs_review++
  }

  for (const n of records.notifications) {
    if (n.status === 'cancelled') {
      t.cancelled.notifications++
      continue
    }
    t.notifications.total++
    if (n.occurrenceId) t.notifications.linked_to_occurrence++
    if (n.guardianInformed) t.notifications.guardian_informed++
  }

  for (const r of records.referrals) {
    if (r.status === 'cancelled') {
      t.cancelled.referrals++
      continue
    }
    t.referrals.total++
    if (r.status === 'open') t.referrals.open++
    if (r.status === 'in_progress') t.referrals.in_progress++
    if (r.status === 'resolved') t.referrals.resolved++
  }

  for (const o of records.observations) {
    if (o.status === 'cancelled') t.cancelled.observations++
    else t.observations.total++
  }

  return t
}

/** Linha do tempo (mais recente primeiro) com os mesmos registros usados nos totais. */
export function timeline(records: Records): TimelineItem[] {
  const items: TimelineItem[] = []
  const push = (type: RecordType, row: any, date: any, label: string) =>
    items.push({
      type,
      id: row.id,
      student_id: row.studentId,
      date: iso(date),
      registered_at: row.createdAt?.toISO?.() ?? '',
      status: row.status ?? 'active',
      label,
      data: row.serialize(),
    })

  const attendanceLabel: Record<string, string> = {
    present: 'Presença',
    absent: 'Falta',
    late: 'Atraso',
  }
  for (const a of records.attendances)
    push('attendance', a, a.date, attendanceLabel[a.status] ?? a.status)
  for (const u of records.uniforms)
    push('uniform_check', u, u.date, 'Checklist de fardamento e calçado')
  for (const o of records.occurrences) {
    push(
      'occurrence',
      o,
      o.occurredOn,
      `RA ${String(o.raCode).padStart(2, '0')} (${o.polarity === 'positive' ? 'positivo' : 'negativo'})`
    )
  }
  for (const n of records.notifications) push('notification', n, n.notifiedOn, 'Notificação')
  for (const r of records.referrals) push('referral', r, r.referredOn, 'Encaminhamento')
  for (const o of records.observations) push('observation', o, o.observedOn, 'Observação')

  return items.sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.registered_at.localeCompare(a.registered_at) || b.id - a.id
  )
}

export function groupByStudent(records: Records): Map<number, Records> {
  const groups = new Map<number, Records>()
  const bucket = (id: number) => {
    let g = groups.get(id)
    if (!g) {
      g = {
        attendances: [],
        uniforms: [],
        occurrences: [],
        notifications: [],
        referrals: [],
        observations: [],
      }
      groups.set(id, g)
    }
    return g
  }
  records.attendances.forEach((r) => bucket(r.studentId).attendances.push(r))
  records.uniforms.forEach((r) => bucket(r.studentId).uniforms.push(r))
  records.occurrences.forEach((r) => bucket(r.studentId).occurrences.push(r))
  records.notifications.forEach((r) => bucket(r.studentId).notifications.push(r))
  records.referrals.forEach((r) => bucket(r.studentId).referrals.push(r))
  records.observations.forEach((r) => bucket(r.studentId).observations.push(r))
  return groups
}

export interface StudentReport {
  kind: 'student'
  generated_at: string
  student: { id: number; full_name: string; registration: string | null; classroom: string | null }
  period: Period
  filters: { types: RecordType[]; include_cancelled: boolean }
  totals: Totals
  items: TimelineItem[]
}

export async function buildStudentReport(
  user: User,
  student: Student,
  filters: Omit<HistoryFilters, 'studentId' | 'classroomId'>
): Promise<StudentReport> {
  await student.load('classroom')
  const records = await fetchRecords(user, { ...filters, studentId: student.id })
  return {
    kind: 'student',
    generated_at: new Date().toISOString(),
    student: {
      id: student.id,
      full_name: student.fullName,
      registration: student.registration,
      classroom: student.classroom
        ? `${student.classroom.name} (${student.classroom.schoolYear})`
        : null,
    },
    period: filters.period,
    filters: {
      types: filters.types ?? [...RECORD_TYPES],
      include_cancelled: !!filters.includeCancelled,
    },
    totals: summarize(records),
    items: timeline(records),
  }
}

export interface ClassroomReport {
  kind: 'classroom'
  generated_at: string
  classroom: { id: number; name: string; school_year: number }
  period: Period
  filters: { types: RecordType[]; include_cancelled: boolean }
  totals: Totals
  students: {
    student: { id: number; full_name: string; registration: string | null }
    totals: Totals
    items?: TimelineItem[]
  }[]
  lessons: {
    days: number
    planned_lessons: number
    registered_lessons: number
    not_identified_lessons: number
    items: { id: number; date: string; planned_lessons: number; lessons: Record<string, any>[] }[]
  }
}

export async function buildClassroomReport(
  user: User,
  classroom: { id: number; name: string; schoolYear: number },
  filters: Omit<HistoryFilters, 'studentId' | 'classroomId'>,
  includeItems = false
): Promise<ClassroomReport> {
  const records = await fetchRecords(user, { ...filters, classroomId: classroom.id })
  const groups = groupByStudent(records)

  // Estudantes atuais da turma + qualquer um que tenha registro no período (nada é perdido ao trocar de turma).
  const current = await Student.query().where('classroom_id', classroom.id).where('is_active', true)
  const extraIds = [...groups.keys()].filter((id) => !current.some((s) => s.id === id))
  const extra = extraIds.length ? await Student.query().whereIn('id', extraIds) : []
  const students = [...current, ...extra].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, 'pt-BR')
  )

  const lessonQuery = LessonDay.query()
    .where('classroom_id', classroom.id)
    .preload('lessons', (q) => q.orderBy('period'))
    .orderBy('date', 'asc')
  if (filters.period.from) lessonQuery.where('date', '>=', filters.period.from)
  if (filters.period.to) lessonQuery.where('date', '<=', filters.period.to)
  const days = await lessonQuery

  return {
    kind: 'classroom',
    generated_at: new Date().toISOString(),
    classroom: { id: classroom.id, name: classroom.name, school_year: classroom.schoolYear },
    period: filters.period,
    filters: {
      types: filters.types ?? [...RECORD_TYPES],
      include_cancelled: !!filters.includeCancelled,
    },
    totals: summarize(records),
    students: students.map((s) => {
      const g = groups.get(s.id) ?? {
        attendances: [],
        uniforms: [],
        occurrences: [],
        notifications: [],
        referrals: [],
        observations: [],
      }
      return {
        student: { id: s.id, full_name: s.fullName, registration: s.registration },
        totals: summarize(g),
        ...(includeItems && { items: timeline(g) }),
      }
    }),
    lessons: {
      days: days.length,
      planned_lessons: days.reduce((n, d) => n + d.plannedLessons, 0),
      registered_lessons: days.reduce((n, d) => n + d.lessons.length, 0),
      // RF-10: aulas registradas como "Não identificado" aparecem à parte.
      not_identified_lessons: days.reduce(
        (n, d) => n + d.lessons.filter((l) => l.notIdentified).length,
        0
      ),
      items: days.map((d) => ({
        id: d.id,
        date: iso(d.date),
        planned_lessons: d.plannedLessons,
        lessons: d.lessons.map((l) => l.serialize()),
      })),
    },
  }
}
