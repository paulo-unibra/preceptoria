import { DateTime } from 'luxon'
import Classroom from '#models/classroom'
import RaCode from '#models/ra_code'
import Student from '#models/student'
import User, { type UserRole } from '#models/user'
import { polarityForCode } from '#support/ra'

let counter = 0
const next = () => ++counter

export async function makeUser(
  role: UserRole,
  classrooms: Classroom[] = [],
  extra: Partial<User> = {}
) {
  const n = next()
  const user = await User.create({
    fullName: `${role} ${n}`,
    email: `${role}${n}@teste.local`,
    password: 'senha-segura-123',
    role,
    isActive: true,
    ...extra,
  })
  if (classrooms.length) await user.related('classrooms').attach(classrooms.map((c) => c.id))
  return user
}

export async function makeClassroom(name = `Turma ${next()}`) {
  return Classroom.create({ name, schoolYear: 2026, shift: 'morning', isActive: true })
}

export async function makeStudent(classroom: Classroom | null, fullName = `Estudante ${next()}`) {
  return Student.create({ fullName, classroomId: classroom?.id ?? null, isActive: true })
}

export async function seedRaCodes() {
  for (let code = 1; code <= 21; code++) {
    await RaCode.create({ code, polarity: polarityForCode(code)! })
  }
}

export const daysAgo = (n: number) => DateTime.now().minus({ days: n }).toISODate()!
export const today = () => daysAgo(0)
export const API = '/api/v1'

/** Conta linhas de uma query do Lucid. */
export async function countRows(query: { count: (expr: string) => any }): Promise<number> {
  const rows = await query.count('* as total')
  return Number(rows[0].$extras.total)
}
