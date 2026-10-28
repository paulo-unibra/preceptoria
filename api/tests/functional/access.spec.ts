import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import Guardian from '#models/guardian'
import { API, makeClassroom, makeStudent, makeUser, seedRaCodes, today } from '#tests/helpers'

test.group('Acesso por turma e perfis (RNF02, RF-04)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => seedRaCodes())

  test('preceptor só enxerga estudantes e turmas autorizados', async ({ client, assert }) => {
    const mine = await makeClassroom('6º A')
    const theirs = await makeClassroom('6º B')
    const preceptor = await makeUser('preceptor', [mine])
    const myStudent = await makeStudent(mine, 'Meu Aluno')
    const otherStudent = await makeStudent(theirs, 'Aluno de Outra Turma')

    const list = await client.get(`${API}/students`).loginAs(preceptor)
    assert.deepEqual(
      list.body().data.map((s: any) => s.id),
      [myStudent.id]
    )
    ;(await client.get(`${API}/students/${myStudent.id}`).loginAs(preceptor)).assertStatus(200)
    ;(await client.get(`${API}/students/${otherStudent.id}`).loginAs(preceptor)).assertStatus(403)
    ;(
      await client.get(`${API}/students/${otherStudent.id}/history`).loginAs(preceptor)
    ).assertStatus(403)
    ;(await client.get(`${API}/classrooms/${theirs.id}/students`).loginAs(preceptor)).assertStatus(
      403
    )
    ;(await client.get(`${API}/reports/classrooms/${theirs.id}`).loginAs(preceptor)).assertStatus(
      403
    )

    const classes = await client.get(`${API}/classrooms`).loginAs(preceptor)
    assert.deepEqual(
      classes.body().data.map((c: any) => c.id),
      [mine.id]
    )
  })

  test('preceptor não lança registros para estudante de turma não autorizada', async ({
    client,
  }) => {
    const mine = await makeClassroom()
    const theirs = await makeClassroom()
    const preceptor = await makeUser('preceptor', [mine])
    const otherStudent = await makeStudent(theirs)
    const res = await client.post(`${API}/occurrences`).loginAs(preceptor).json({
      student_id: otherStudent.id,
      occurred_on: today(),
      ra_code: 3,
      description: 'Tentativa indevida',
    })
    res.assertStatus(403)
  })

  test('administrador enxerga todas as turmas', async ({ client, assert }) => {
    const a = await makeClassroom()
    const b = await makeClassroom()
    const admin = await makeUser('admin')
    await makeStudent(a)
    await makeStudent(b)
    const list = await client.get(`${API}/students`).loginAs(admin)
    assert.lengthOf(list.body().data, 2)
  })

  test('coordenação consulta as turmas sob sua gestão, mas não lança registros diários', async ({
    client,
  }) => {
    const classroom = await makeClassroom()
    const coord = await makeUser('coordenacao', [classroom])
    const student = await makeStudent(classroom)
    ;(await client.get(`${API}/students/${student.id}`).loginAs(coord)).assertStatus(200)
    ;(
      await client
        .put(`${API}/attendances/bulk`)
        .loginAs(coord)
        .json({
          classroom_id: classroom.id,
          date: today(),
          records: [{ student_id: student.id, status: 'present' }],
        })
    ).assertStatus(403)
    ;(
      await client
        .post(`${API}/observations`)
        .loginAs(coord)
        .json({ student_id: student.id, observed_on: today(), content: 'Tentativa' })
    ).assertStatus(403)
  })

  test('somente administrador gerencia turmas, estudantes e a tabela de RAs', async ({
    client,
  }) => {
    const classroom = await makeClassroom()
    const preceptor = await makeUser('preceptor', [classroom])
    ;(
      await client
        .post(`${API}/classrooms`)
        .loginAs(preceptor)
        .json({ name: 'X', school_year: 2026 })
    ).assertStatus(403)
    ;(
      await client.post(`${API}/students`).loginAs(preceptor).json({ full_name: 'Fulano de Tal' })
    ).assertStatus(403)
    ;(
      await client.patch(`${API}/ra-codes/3`).loginAs(preceptor).json({ description: 'x' })
    ).assertStatus(403)
  })

  test('administrador cadastra turma, estudante, responsável e enturma (RF-04)', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const classRes = await client
      .post(`${API}/classrooms`)
      .loginAs(admin)
      .json({ name: '5º C', school_year: 2026, shift: 'afternoon' })
    classRes.assertStatus(201)
    const classroomId = classRes.body().classroom.id

    const dup = await client
      .post(`${API}/classrooms`)
      .loginAs(admin)
      .json({ name: '5º C', school_year: 2026 })
    dup.assertStatus(422)

    const st = await client.post(`${API}/students`).loginAs(admin).json({
      full_name: 'Joana Silva',
      registration: '2026-0001',
      birth_date: '2014-03-10',
      classroom_id: classroomId,
      tracking_notes: 'Usa óculos.',
    })
    st.assertStatus(201)
    const id = st.body().student.id
    ;(
      await client
        .post(`${API}/students`)
        .loginAs(admin)
        .json({ full_name: 'Outra Pessoa', registration: '2026-0001' })
    ).assertStatus(422)

    const g = await client.post(`${API}/students/${id}/guardians`).loginAs(admin).json({
      full_name: 'Maria Silva',
      relationship: 'Mãe',
      phone: '(81) 99999-0000',
      is_primary: true,
    })
    g.assertStatus(201)

    const ficha = await client.get(`${API}/students/${id}`).loginAs(admin)
    assert.equal(ficha.body().student.guardians[0].phone, '(81) 99999-0000')
    assert.equal(ficha.body().student.classroom.name, '5º C')
    assert.equal(ficha.body().student.birth_date, '2014-03-10')

    const roster = await client.get(`${API}/classrooms/${classroomId}/students`).loginAs(admin)
    assert.deepEqual(
      roster.body().students.data.map((s: any) => s.id),
      [id]
    )
  })

  test('telefone dos responsáveis respeita a configuração de privacidade', async ({
    client,
    assert,
  }) => {
    const classroom = await makeClassroom()
    const admin = await makeUser('admin')
    const preceptor = await makeUser('preceptor', [classroom])
    const student = await makeStudent(classroom)
    await Guardian.create({
      studentId: student.id,
      fullName: 'Responsável',
      phone: '(81) 98888-7777',
      isPrimary: true,
    })

    const before = await client.get(`${API}/students/${student.id}`).loginAs(preceptor)
    assert.equal(before.body().student.guardians[0].phone, '(81) 98888-7777')

    const update = await client
      .put(`${API}/settings/privacy`)
      .loginAs(admin)
      .json({
        guardian_phone_roles: ['admin', 'coordenacao'],
        photo_roles: ['admin', 'coordenacao'],
      })
    update.assertStatus(200)

    const after = await client.get(`${API}/students/${student.id}`).loginAs(preceptor)
    after.assertStatus(200)
    assert.isNull(after.body().student.guardians[0].phone, 'preceptor deixa de ver o telefone')
    assert.equal(after.body().student.guardians[0].full_name, 'Responsável')
    const adminView = await client.get(`${API}/students/${student.id}`).loginAs(admin)
    assert.equal(adminView.body().student.guardians[0].phone, '(81) 98888-7777')
  })

  test('foto: upload pelo admin, entrega só por rota autenticada e sob regra de privacidade', async ({
    client,
    assert,
  }) => {
    const classroom = await makeClassroom()
    const admin = await makeUser('admin')
    const preceptor = await makeUser('preceptor', [classroom])
    const outsider = await makeUser('preceptor')
    const student = await makeStudent(classroom)

    const dir = app.tmpPath('test-upload')
    await mkdir(dir, { recursive: true })
    const file = join(dir, 'foto.png')
    // PNG 1x1 válido
    await writeFile(
      file,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      )
    )

    const up = await client
      .post(`${API}/students/${student.id}/photo`)
      .loginAs(admin)
      .file('photo', file)
    up.assertStatus(200)
    assert.isTrue(up.body().student.has_photo)
    assert.notProperty(up.body().student, 'photo_path', 'caminho interno nunca é exposto')

    ;(await client.get(`${API}/students/${student.id}/photo`).loginAs(preceptor)).assertStatus(200)
    ;(await client.get(`${API}/students/${student.id}/photo`).loginAs(outsider)).assertStatus(403)
    ;(await client.get(`${API}/students/${student.id}/photo`)).assertStatus(401)

    await client
      .put(`${API}/settings/privacy`)
      .loginAs(admin)
      .json({ guardian_phone_roles: ['admin'], photo_roles: ['admin'] })
    ;(await client.get(`${API}/students/${student.id}/photo`).loginAs(preceptor)).assertStatus(403)

    const bad = join(dir, 'arquivo.txt')
    await writeFile(bad, 'não é imagem')
    ;(
      await client.post(`${API}/students/${student.id}/photo`).loginAs(admin).file('photo', bad)
    ).assertStatus(422)
  })

  test('encaminhamento confidencial só é visto por quem criou, coordenação e administração (RF-11)', async ({
    client,
    assert,
  }) => {
    const classroom = await makeClassroom()
    const author = await makeUser('preceptor', [classroom])
    const colleague = await makeUser('preceptor', [classroom])
    const coord = await makeUser('coordenacao', [classroom])
    const student = await makeStudent(classroom)

    const created = await client.post(`${API}/referrals`).loginAs(author).json({
      student_id: student.id,
      referred_to: 'coordination',
      referred_on: today(),
      reason: 'Situação sigilosa',
      is_confidential: true,
    })
    created.assertStatus(201)
    const id = created.body().referral.id

    ;(await client.get(`${API}/referrals/${id}`).loginAs(colleague)).assertStatus(403)
    assert.lengthOf((await client.get(`${API}/referrals`).loginAs(colleague)).body().data, 0)
    ;(await client.get(`${API}/referrals/${id}`).loginAs(author)).assertStatus(200)
    ;(await client.get(`${API}/referrals/${id}`).loginAs(coord)).assertStatus(200)

    // totais do colega não incluem o confidencial
    const hist = await client.get(`${API}/students/${student.id}/history`).loginAs(colleague)
    assert.equal(hist.body().totals.referrals.total, 0)
    const histCoord = await client.get(`${API}/students/${student.id}/history`).loginAs(coord)
    assert.equal(histCoord.body().totals.referrals.total, 1)
  })

  test('ciclo do encaminhamento: coordenação registra providência, contato e resolve', async ({
    client,
    assert,
  }) => {
    const classroom = await makeClassroom()
    const preceptor = await makeUser('preceptor', [classroom])
    const coord = await makeUser('coordenacao', [classroom])
    const student = await makeStudent(classroom)
    const created = await client.post(`${API}/referrals`).loginAs(preceptor).json({
      student_id: student.id,
      referred_to: 'management',
      referred_on: today(),
      reason: 'Faltas recorrentes',
    })
    const id = created.body().referral.id
    assert.equal(created.body().referral.status, 'open')

    const step = await client.patch(`${API}/referrals/${id}`).loginAs(coord).json({
      status: 'in_progress',
      action_taken: 'Convocação dos responsáveis',
      guardian_contacted_on: today(),
      guardian_contact_result: 'Compareceram à escola',
    })
    step.assertStatus(200)
    assert.equal(step.body().referral.status, 'in_progress')

    const done = await client
      .patch(`${API}/referrals/${id}`)
      .loginAs(coord)
      .json({ status: 'resolved' })
    assert.equal(done.body().referral.status, 'resolved')
    assert.equal(done.body().referral.resolved_on, today())

    const cancel = await client
      .post(`${API}/referrals/${id}/cancel`)
      .loginAs(preceptor)
      .json({ reason: 'Aberto por engano' })
    cancel.assertStatus(200)
    ;(
      await client.patch(`${API}/referrals/${id}`).loginAs(coord).json({ status: 'open' })
    ).assertStatus(409)
  })

  test('configurações (ranking/privacidade) só pelo administrador, critérios abertos a todos', async ({
    client,
    assert,
  }) => {
    const preceptor = await makeUser('preceptor')
    ;(await client.get(`${API}/settings`).loginAs(preceptor)).assertStatus(403)
    ;(await client.put(`${API}/settings/ranking`).loginAs(preceptor).json({})).assertStatus(403)
    const criteria = await client.get(`${API}/ranking/criteria`).loginAs(preceptor)
    criteria.assertStatus(200)
    assert.property(criteria.body().criteria.weights, 'positive_ra')
  })

  test('tabela de RAs: descrição oficial é pendente (nula) até o administrador informar (DP05)', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const list = await client.get(`${API}/ra-codes`).loginAs(admin)
    assert.lengthOf(list.body().data, 21)
    assert.isTrue(
      list.body().data.every((c: any) => c.description === null),
      'nenhuma descrição é presumida'
    )
    assert.equal(list.body().data.find((c: any) => c.code === 9).polarity, 'positive')
    assert.equal(list.body().data.find((c: any) => c.code === 10).polarity, 'negative')

    const res = await client
      .patch(`${API}/ra-codes/9`)
      .loginAs(admin)
      .json({ description: 'Descrição oficial informada pela escola' })
    res.assertStatus(200)
    assert.equal(res.body().ra_code.description, 'Descrição oficial informada pela escola')
    assert.equal(res.body().ra_code.polarity, 'positive', 'a polaridade não é editável')
    ;(
      await client.patch(`${API}/ra-codes/99`).loginAs(admin).json({ description: 'x' })
    ).assertStatus(404)
  })
})
