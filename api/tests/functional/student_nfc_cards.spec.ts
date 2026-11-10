import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Attendance from '#models/attendance'
import AttendanceSession from '#models/attendance_session'
import StudentNfcCard from '#models/student_nfc_card'
import AuditLog from '#models/audit_log'
import { API, makeClassroom, makeStudent, makeUser, today } from '#tests/helpers'

test.group('Cartão NFC e frequência', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('autenticação, perfil e vínculo com a turma são obrigatórios', async ({ client }) => {
    const classroom = await makeClassroom()
    const student = await makeStudent(classroom)
    const coordinator = await makeUser('coordenacao', [classroom])
    const outsider = await makeUser('preceptor')
    ;(await client.post(`${API}/students/${student.id}/nfc-card/prepare`)).assertStatus(401)
    for (const user of [coordinator, outsider]) {
      ;(await client.get(`${API}/students/${student.id}/nfc-card`).loginAs(user)).assertStatus(403)
      ;(
        await client.post(`${API}/students/${student.id}/nfc-card/prepare`).loginAs(user)
      ).assertStatus(403)
      ;(
        await client
          .post(`${API}/students/${student.id}/nfc-card/activate`)
          .loginAs(user)
          .json({ token: 'a'.repeat(64) })
      ).assertStatus(403)
      ;(await client.delete(`${API}/students/${student.id}/nfc-card`).loginAs(user)).assertStatus(
        403
      )
      ;(
        await client
          .post(`${API}/attendances/nfc`)
          .loginAs(user)
          .json({
            token: 'a'.repeat(64),
            classroom_id: classroom.id,
            date: today(),
            start_time: '07:30',
          })
      ).assertStatus(403)
    }
  })

  test('prepara sem ativar; confirma a gravação e não expõe o token ou hash nas consultas/auditoria', async ({
    client,
    assert,
  }) => {
    const classroom = await makeClassroom()
    const student = await makeStudent(classroom)
    const user = await makeUser('preceptor', [classroom])
    const prepared = await client
      .post(`${API}/students/${student.id}/nfc-card/prepare`)
      .loginAs(user)
    prepared.assertStatus(200)
    const token = prepared.body().token
    assert.match(token, /^[a-f0-9]{64}$/)
    const pending = await StudentNfcCard.findByOrFail('studentId', student.id)
    assert.notEqual(pending.pendingHash, token)
    assert.isNull(pending.tokenHash)
    ;(
      await client
        .post(`${API}/attendances/nfc`)
        .loginAs(user)
        .json({ token, classroom_id: classroom.id, date: today(), start_time: '07:30' })
    ).assertStatus(422)
    const activated = await client
      .post(`${API}/students/${student.id}/nfc-card/activate`)
      .loginAs(user)
      .json({ token })
    activated.assertStatus(200)
    assert.isTrue(activated.body().card.active)
    // Repetir a confirmação após perda da resposta não muda o vínculo.
    ;(
      await client
        .post(`${API}/students/${student.id}/nfc-card/activate`)
        .loginAs(user)
        .json({ token })
    ).assertStatus(200)
    const shown = await client.get(`${API}/students/${student.id}/nfc-card`).loginAs(user)
    assert.deepEqual(Object.keys(shown.body().card).sort(), ['activated_at', 'active'])
    const audits = JSON.stringify(
      (await AuditLog.query().where('entity', 'student_nfc_cards')).map((row) => row.serialize())
    )
    assert.notInclude(audits, token)
    assert.notInclude(audits, pending.pendingHash!)
  })

  test('recusa ativação expirada, de outro profissional e de outro aluno', async ({ client }) => {
    const classroom = await makeClassroom()
    const student = await makeStudent(classroom)
    const otherStudent = await makeStudent(classroom)
    const user = await makeUser('preceptor', [classroom])
    const otherUser = await makeUser('admin')
    const prepared = await client
      .post(`${API}/students/${student.id}/nfc-card/prepare`)
      .loginAs(user)
    const token = prepared.body().token
    ;(
      await client
        .post(`${API}/students/${student.id}/nfc-card/activate`)
        .loginAs(otherUser)
        .json({ token })
    ).assertStatus(422)
    ;(
      await client
        .post(`${API}/students/${otherStudent.id}/nfc-card/activate`)
        .loginAs(user)
        .json({ token })
    ).assertStatus(422)
    const card = await StudentNfcCard.findByOrFail('studentId', student.id)
    card.pendingExpiresAt = DateTime.now().minus({ minutes: 1 })
    await card.save()
    ;(
      await client
        .post(`${API}/students/${student.id}/nfc-card/activate`)
        .loginAs(user)
        .json({ token })
    ).assertStatus(422)
  })

  test('salva presença imediatamente, com autor e origem auditados; releitura não duplica', async ({
    client,
    assert,
  }) => {
    const classroom = await makeClassroom()
    const student = await makeStudent(classroom)
    const user = await makeUser('preceptor', [classroom])
    const prepared = await client
      .post(`${API}/students/${student.id}/nfc-card/prepare`)
      .loginAs(user)
    const token = prepared.body().token
    ;(
      await client
        .post(`${API}/students/${student.id}/nfc-card/activate`)
        .loginAs(user)
        .json({ token })
    ).assertStatus(200)
    const payload = { token, classroom_id: classroom.id, date: today(), start_time: '07:30' }
    const first = await client.post(`${API}/attendances/nfc`).loginAs(user).json(payload)
    first.assertStatus(200)
    assert.equal(first.body().student.id, student.id)
    assert.equal(first.body().attendance.status, 'present')
    assert.equal(first.body().attendance.student_id, student.id)
    assert.isFalse(first.body().already_recorded)
    const repeated = await client.post(`${API}/attendances/nfc`).loginAs(user).json(payload)
    repeated.assertStatus(200)
    assert.isTrue(repeated.body().already_recorded)
    assert.lengthOf(await Attendance.all(), 1)
    assert.equal((await Attendance.firstOrFail()).createdBy, user.id)
    assert.equal((await AttendanceSession.firstOrFail()).startTime, '07:30')
    const audits = await AuditLog.query().where('entity', 'attendances')
    assert.lengthOf(
      audits.filter((row) => row.changes.source?.new === 'nfc'),
      1
    )
  })

  test('marca falta como presença, mantém outros alunos e preserva atraso/manual e horário da chamada', async ({
    client,
    assert,
  }) => {
    const classroom = await makeClassroom()
    const student = await makeStudent(classroom)
    const other = await makeStudent(classroom)
    const user = await makeUser('admin')
    const prepared = await client
      .post(`${API}/students/${student.id}/nfc-card/prepare`)
      .loginAs(user)
    const token = prepared.body().token
    await client
      .post(`${API}/students/${student.id}/nfc-card/activate`)
      .loginAs(user)
      .json({ token })
    ;(
      await client
        .put(`${API}/attendances/bulk`)
        .loginAs(user)
        .json({
          classroom_id: classroom.id,
          date: today(),
          start_time: '07:30',
          records: [
            {
              student_id: student.id,
              status: 'absent',
              is_justified: true,
              note: 'Registro anterior',
            },
            { student_id: other.id, status: 'absent' },
          ],
        })
    ).assertStatus(200)
    const payload = { token, classroom_id: classroom.id, date: today(), start_time: '08:00' }
    const result = await client.post(`${API}/attendances/nfc`).loginAs(user).json(payload)
    result.assertStatus(200)
    assert.equal(result.body().attendance.status, 'present')
    assert.isFalse(result.body().attendance.is_justified)
    assert.isNull(result.body().attendance.note)
    assert.equal((await Attendance.findByOrFail('studentId', other.id)).status, 'absent')
    assert.equal((await AttendanceSession.firstOrFail()).startTime, '07:30')
    ;(
      await client
        .put(`${API}/attendances/bulk`)
        .loginAs(user)
        .json({
          classroom_id: classroom.id,
          date: today(),
          start_time: '07:30',
          records: [
            { student_id: student.id, status: 'late', arrival_time: '07:45', note: 'Manual' },
          ],
        })
    ).assertStatus(200)
    const repeated = await client.post(`${API}/attendances/nfc`).loginAs(user).json(payload)
    assert.isTrue(repeated.body().already_recorded)
    assert.equal(repeated.body().attendance.status, 'late')
    assert.equal(repeated.body().attendance.arrival_time, '07:45')
    assert.equal(repeated.body().attendance.note, 'Manual')
  })

  test('substituição só invalida cartão antigo após ativar; revogação invalida ativo e pendente', async ({
    client,
    assert,
  }) => {
    const classroom = await makeClassroom()
    const student = await makeStudent(classroom)
    const user = await makeUser('admin')
    const url = `${API}/students/${student.id}/nfc-card`
    const first = (await client.post(`${url}/prepare`).loginAs(user)).body().token
    await client.post(`${url}/activate`).loginAs(user).json({ token: first })
    const second = (await client.post(`${url}/prepare`).loginAs(user)).body().token
    assert.notEqual(first, second)
    const payload = { classroom_id: classroom.id, date: today(), start_time: '07:30' }
    ;(
      await client
        .post(`${API}/attendances/nfc`)
        .loginAs(user)
        .json({ ...payload, token: first })
    ).assertStatus(200)
    ;(
      await client
        .post(`${API}/attendances/nfc`)
        .loginAs(user)
        .json({ ...payload, token: second })
    ).assertStatus(422)
    await client.post(`${url}/activate`).loginAs(user).json({ token: second })
    ;(
      await client
        .post(`${API}/attendances/nfc`)
        .loginAs(user)
        .json({ ...payload, token: first })
    ).assertStatus(422)
    const third = (await client.post(`${url}/prepare`).loginAs(user)).body().token
    ;(await client.delete(url).loginAs(user)).assertStatus(200)
    ;(
      await client
        .post(`${API}/attendances/nfc`)
        .loginAs(user)
        .json({ ...payload, token: second })
    ).assertStatus(422)
    ;(await client.post(`${url}/activate`).loginAs(user).json({ token: third })).assertStatus(422)
    assert.lengthOf(await Attendance.all(), 1)
  })

  test('não registra aluno de outra turma, inativo ou em turma inativa; valida token e data', async ({
    client,
    assert,
  }) => {
    const classroom = await makeClassroom()
    const other = await makeClassroom()
    const student = await makeStudent(classroom)
    const user = await makeUser('admin')
    const token = (
      await client.post(`${API}/students/${student.id}/nfc-card/prepare`).loginAs(user)
    ).body().token
    await client
      .post(`${API}/students/${student.id}/nfc-card/activate`)
      .loginAs(user)
      .json({ token })
    const payload = { token, classroom_id: classroom.id, date: today(), start_time: '07:30' }
    for (const change of [
      { classroom_id: other.id },
      { token: 'invalid' },
      { date: DateTime.now().plus({ days: 1 }).toISODate() },
      { start_time: '25:99' },
    ]) {
      ;(
        await client
          .post(`${API}/attendances/nfc`)
          .loginAs(user)
          .json({ ...payload, ...change })
      ).assertStatus(422)
    }
    student.isActive = false
    await student.save()
    ;(await client.post(`${API}/attendances/nfc`).loginAs(user).json(payload)).assertStatus(422)
    student.isActive = true
    await student.save()
    classroom.isActive = false
    await classroom.save()
    ;(await client.post(`${API}/attendances/nfc`).loginAs(user).json(payload)).assertStatus(422)
    ;(
      await client.post(`${API}/students/${student.id}/nfc-card/prepare`).loginAs(user)
    ).assertStatus(422)
    assert.lengthOf(await db.from('attendances'), 0)
  })
})
