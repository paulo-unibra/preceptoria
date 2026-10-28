import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Classroom from '#models/classroom'
import Student from '#models/student'
import type User from '#models/user'
import ClassroomAccess, { forbidden } from '#services/classroom_access'
import { invalid } from '#support/errors'
import { parseDate } from '#support/dates'

/** Carrega uma turma ativa em que o usuário pode lançar registros (preceptor da turma ou admin). */
export async function writableClassroom(user: User, classroomId: number): Promise<Classroom> {
  if (user.role === 'coordenacao')
    throw forbidden('A coordenação tem acesso somente de consulta a estes registros.')
  const classroom = await Classroom.findOrFail(classroomId)
  await ClassroomAccess.assert(user, classroom.id)
  if (!classroom.isActive) throw invalid('Esta turma está inativa e não aceita novos registros.')
  return classroom
}

/**
 * Estudante ativo, com turma, em que o usuário pode lançar registros.
 */
export async function writableStudent(user: User, studentId: number): Promise<Student> {
  if (user.role === 'coordenacao')
    throw forbidden('A coordenação tem acesso somente de consulta a estes registros.')
  const student = await Student.findOrFail(studentId)
  if (!student.classroomId) throw invalid('O estudante não está enturmado.')
  await ClassroomAccess.assert(user, student.classroomId)
  if (!student.isActive) throw invalid('O estudante está inativo e não aceita novos registros.')
  return student
}

/**
 * Grava, em uma transação, um registro por estudante para a data (frequência, checklist).
 * Se já existir registro do estudante na data, ele é corrigido (e a alteração fica no histórico de auditoria).
 */
export async function bulkUpsertDaily(
  Model: any,
  user: User,
  classroomId: number,
  date: string,
  records: { student_id: number }[],
  toAttributes: (record: any) => Record<string, unknown>,
  /** Executado na mesma transação (ex.: gravar a hora de início da aula). */
  inTransaction?: (trx: TransactionClientContract, classroom: Classroom) => Promise<void>
) {
  const classroom = await writableClassroom(user, classroomId)
  const ids = records.map((r) => r.student_id)

  const students = await Student.query()
    .where('classroom_id', classroom.id)
    .where('is_active', true)
    .whereIn('id', ids)
    .select('id')
  const valid = new Set(students.map((s) => s.id))
  const notInClassroom = ids.filter((id) => !valid.has(id))
  if (notInClassroom.length) {
    throw invalid(
      `Estudantes que não pertencem (ou não estão ativos) nesta turma: ${notInClassroom.join(', ')}.`
    )
  }

  await db.transaction(async (trx) => {
    if (inTransaction) await inTransaction(trx, classroom)
    const existing = await Model.query({ client: trx })
      .where('date', date)
      .whereIn('student_id', ids)
    const byStudent = new Map<number, any>(existing.map((row: any) => [row.studentId, row]))
    for (const record of records) {
      const attributes = toAttributes(record)
      const row = byStudent.get(record.student_id)
      if (row) {
        row.merge({ classroomId: classroom.id, ...attributes })
        await row.save()
      } else {
        await Model.create(
          {
            studentId: record.student_id,
            classroomId: classroom.id,
            date: parseDate(date),
            ...attributes,
          },
          { client: trx }
        )
      }
    }
  })

  return Model.query().where('date', date).whereIn('student_id', ids).orderBy('student_id')
}

/** Alunos ativos da turma + registro do dia (ou null): base da tela de chamada/checklist. */
export async function rosterFor(Model: any, classroomId: number, date: string) {
  const students = await Student.query()
    .where('classroom_id', classroomId)
    .where('is_active', true)
    .orderBy('full_name')
  const rows = await Model.query().where('classroom_id', classroomId).where('date', date)
  const byStudent = new Map<number, any>(rows.map((r: any) => [r.studentId, r]))
  return students.map((s) => ({
    student: { id: s.id, full_name: s.fullName, registration: s.registration },
    record: byStudent.get(s.id) ?? null,
  }))
}
