import { createHash, randomBytes } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Student from '#models/student'
import Classroom from '#models/classroom'
import StudentNfcCard from '#models/student_nfc_card'
import Attendance from '#models/attendance'
import AttendanceSession from '#models/attendance_session'
import AuditLog from '#models/audit_log'
import { writableClassroom, writableStudent } from '#services/daily_records'
import { invalid } from '#support/errors'
import { parseDate } from '#support/dates'
import { activateNfcValidator, nfcAttendanceValidator } from '#validators/nfc'

const digest = (token: string) => createHash('sha256').update(token).digest('hex')
const status = (card: StudentNfcCard | null) => ({
  active: !!card?.tokenHash,
  activated_at: card?.tokenHash ? (card.activatedAt?.toISO() ?? null) : null,
})

export default class StudentNfcCardsController {
  async show({ auth, params }: HttpContext) {
    const student = await writableStudent(auth.user!, Number(params.id))
    return { card: status(await StudentNfcCard.findBy('studentId', student.id)) }
  }

  /** O cartão anterior só é invalidado após confirmação da gravação do novo. */
  async prepare({ auth, params, response }: HttpContext) {
    const student = await writableStudent(auth.user!, Number(params.id))
    await writableClassroom(auth.user!, student.classroomId!)
    const token = randomBytes(32).toString('hex')
    await db.transaction(async (trx) => {
      await Student.query({ client: trx }).where('id', student.id).forUpdate().firstOrFail()
      const card = await StudentNfcCard.firstOrCreate(
        { studentId: student.id },
        {},
        { client: trx }
      )
      card.merge({
        pendingHash: digest(token),
        pendingExpiresAt: DateTime.now().plus({ minutes: 10 }),
        pendingUserId: auth.user!.id,
      })
      await card.save()
    })
    response.header('Cache-Control', 'no-store')
    return { token, expires_in: 600 }
  }

  async activate({ auth, params, request }: HttpContext) {
    const { token } = await request.validateUsing(activateNfcValidator)
    const student = await writableStudent(auth.user!, Number(params.id))
    await writableClassroom(auth.user!, student.classroomId!)
    return db.transaction(async (trx) => {
      await Student.query({ client: trx }).where('id', student.id).forUpdate().firstOrFail()
      const card = await StudentNfcCard.query({ client: trx })
        .where('student_id', student.id)
        .first()
      const hash = digest(token)
      if (card?.tokenHash === hash) return { card: status(card) }
      if (
        !card ||
        card.pendingHash !== hash ||
        card.pendingUserId !== auth.user!.id ||
        !card.pendingExpiresAt ||
        card.pendingExpiresAt <= DateTime.now()
      ) {
        throw invalid(
          'A gravação expirou ou foi substituída. Cadastre o cartão novamente.',
          'E_NFC_ENROLLMENT'
        )
      }
      const replacing = !!card.tokenHash
      card.merge({
        tokenHash: hash,
        activatedAt: DateTime.now(),
        pendingHash: null,
        pendingExpiresAt: null,
        pendingUserId: null,
      })
      await card.save()
      await AuditLog.create(
        {
          userId: auth.user!.id,
          entity: 'student_nfc_cards',
          entityId: card.id,
          classroomId: student.classroomId,
          action: 'update',
          changes: {
            operation: { old: null, new: replacing ? 'replace' : 'activate' },
            student_id: { old: null, new: student.id },
          },
        },
        { client: trx }
      )
      return { card: status(card) }
    })
  }

  async revoke({ auth, params }: HttpContext) {
    const student = await writableStudent(auth.user!, Number(params.id))
    return db.transaction(async (trx) => {
      await Student.query({ client: trx }).where('id', student.id).forUpdate().firstOrFail()
      const card = await StudentNfcCard.query({ client: trx })
        .where('student_id', student.id)
        .first()
      if (card) {
        card.merge({
          tokenHash: null,
          activatedAt: null,
          pendingHash: null,
          pendingExpiresAt: null,
          pendingUserId: null,
        })
        await card.save()
        await AuditLog.create(
          {
            userId: auth.user!.id,
            entity: 'student_nfc_cards',
            entityId: card.id,
            classroomId: student.classroomId,
            action: 'update',
            changes: {
              operation: { old: null, new: 'revoke' },
              student_id: { old: null, new: student.id },
            },
          },
          { client: trx }
        )
      }
      return { card: status(null) }
    })
  }

  async attendance({ auth, request }: HttpContext) {
    const {
      token,
      classroom_id: classroomId,
      date,
      start_time: startTime,
    } = await request.validateUsing(nfcAttendanceValidator)
    await writableClassroom(auth.user!, classroomId)
    const card = await StudentNfcCard.findBy('tokenHash', digest(token))
    if (!card) throw invalid('Cartão não cadastrado, substituído ou desvinculado.', 'E_NFC_UNKNOWN')
    return db.transaction(async (trx) => {
      // Serializa leituras simultâneas e a troca/revogação do cartão para este aluno.
      // A turma também é bloqueada para criar a sessão diária uma única vez.
      const classroom = await Classroom.query({ client: trx })
        .where('id', classroomId)
        .forUpdate()
        .firstOrFail()
      if (!classroom.isActive)
        throw invalid('Esta turma está inativa e não aceita novos registros.')
      const student = await Student.query({ client: trx })
        .where('id', card.studentId)
        .forUpdate()
        .firstOrFail()
      const current = await StudentNfcCard.query({ client: trx }).where('id', card.id).firstOrFail()
      if (current.tokenHash !== digest(token))
        throw invalid('Cartão não cadastrado, substituído ou desvinculado.', 'E_NFC_UNKNOWN')
      if (!student.isActive || student.classroomId !== classroomId)
        throw invalid(
          'O cartão não pertence a um estudante ativo da turma selecionada.',
          'E_NFC_CLASSROOM'
        )
      let attendance = await Attendance.query({ client: trx })
        .where('student_id', student.id)
        .where('date', date)
        .first()
      const alreadyRecorded = !!attendance && attendance.status !== 'absent'
      if (!alreadyRecorded) {
        const session = await AttendanceSession.query({ client: trx })
          .where('classroom_id', classroomId)
          .where('date', date)
          .first()
        if (!session)
          await AttendanceSession.create(
            { classroomId, date: parseDate(date), startTime },
            { client: trx }
          )
        if (attendance) {
          attendance.merge({
            classroomId,
            status: 'present',
            arrivalTime: null,
            isJustified: false,
            note: null,
          })
          await attendance.save()
        } else {
          attendance = await Attendance.create(
            {
              studentId: student.id,
              classroomId,
              date: parseDate(date),
              status: 'present',
              arrivalTime: null,
              isJustified: false,
              note: null,
            },
            { client: trx }
          )
        }
        await AuditLog.create(
          {
            userId: auth.user!.id,
            entity: 'attendances',
            entityId: attendance.id,
            classroomId,
            action: 'update',
            changes: { source: { old: null, new: 'nfc' } },
          },
          { client: trx }
        )
      }
      return {
        student: { id: student.id, full_name: student.fullName },
        attendance,
        already_recorded: alreadyRecorded,
      }
    })
  }
}
