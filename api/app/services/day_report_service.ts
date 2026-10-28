import AttendanceSession from '#models/attendance_session'
import RaCode from '#models/ra_code'
import type User from '#models/user'
import { buildClassroomReport, type ClassroomReport } from '#services/history_service'

/** Tudo o que foi registrado para uma turma em um único dia (base do painel "Registros do dia" e do PDF). */
export interface DayReport {
  kind: 'day'
  generated_at: string
  classroom: { id: number; name: string; school_year: number }
  date: string
  /** Hora de início da aula informada na chamada (HH:mm), se houver. */
  start_time: string | null
  totals: ClassroomReport['totals']
  students: ClassroomReport['students']
  lessons: ClassroomReport['lessons']
  /** Nome oficial de cada código de RA (ex.: 13 -> "Uso de celular"). */
  ra_codes: Record<number, string | null>
}

export async function buildDayReport(
  user: User,
  classroom: { id: number; name: string; schoolYear: number },
  date: string
): Promise<DayReport> {
  const report = await buildClassroomReport(
    user,
    classroom,
    { period: { from: date, to: date }, includeCancelled: false },
    true
  )
  const session = await AttendanceSession.query()
    .where('classroom_id', classroom.id)
    .where('date', date)
    .first()
  const codes = await RaCode.query().orderBy('code')

  return {
    kind: 'day',
    generated_at: new Date().toISOString(),
    classroom: report.classroom,
    date,
    start_time: session?.startTime ?? null,
    totals: report.totals,
    students: report.students,
    lessons: report.lessons,
    ra_codes: Object.fromEntries(codes.map((c) => [c.code, c.description])),
  }
}
