import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Attendance from '#models/attendance'
import AuditLog from '#models/audit_log'
import Lesson from '#models/lesson'
import {
  API,
  countRows,
  daysAgo,
  makeClassroom,
  makeStudent,
  makeUser,
  today,
} from '#tests/helpers'

async function setup() {
  const classroom = await makeClassroom('6º A')
  const preceptor = await makeUser('preceptor', [classroom])
  const a = await makeStudent(classroom, 'Ana')
  const b = await makeStudent(classroom, 'Bruno')
  const c = await makeStudent(classroom, 'Carla')
  return { classroom, preceptor, a, b, c }
}

test.group('Frequência (RF-05)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('registra presença, falta e atraso da turma de uma vez e a chamada devolve o resultado', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, a, b, c } = await setup()
    const res = await client
      .put(`${API}/attendances/bulk`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: today(),
        records: [
          { student_id: a.id, status: 'present' },
          { student_id: b.id, status: 'absent', is_justified: true, note: 'Atestado médico' },
          { student_id: c.id, status: 'late', minutes_late: 15 },
        ],
      })
    res.assertStatus(200)
    assert.lengthOf(res.body().data, 3)

    const roster = await client
      .get(`${API}/attendances/roster?classroom_id=${classroom.id}&date=${today()}`)
      .loginAs(preceptor)
    const byName = Object.fromEntries(
      roster.body().data.map((r: any) => [r.student.full_name, r.attendance])
    )
    assert.equal(byName.Ana.status, 'present')
    assert.isTrue(byName.Bruno.is_justified)
    assert.equal(byName.Carla.minutes_late, 15)
  })

  test('minutos de atraso só valem para atraso e justificativa só para falta', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, a, b } = await setup()
    await client
      .put(`${API}/attendances/bulk`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: today(),
        records: [
          { student_id: a.id, status: 'present', minutes_late: 30, is_justified: true },
          { student_id: b.id, status: 'absent', minutes_late: 30 },
        ],
      })
    const rows = await Attendance.query().orderBy('student_id')
    assert.isNull(rows[0].minutesLate)
    assert.isFalse(rows[0].isJustified)
    assert.isNull(rows[1].minutesLate)
  })

  test('reenviar a chamada corrige o registro (sem duplicar) e guarda o valor anterior na auditoria', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, a } = await setup()
    const send = (status: string) =>
      client
        .put(`${API}/attendances/bulk`)
        .loginAs(preceptor)
        .json({
          classroom_id: classroom.id,
          date: today(),
          records: [{ student_id: a.id, status }],
        })
    ;(await send('absent')).assertStatus(200)
    ;(await send('absent')).assertStatus(200)
    ;(await send('present')).assertStatus(200)

    assert.equal(await countRows(Attendance.query()), 1)
    const logs = await AuditLog.query().where({ entity: 'attendances', action: 'update' })
    assert.lengthOf(logs, 1, 'reenvio idêntico não gera log')
    assert.deepEqual(logs[0].changes.status, { old: 'absent', new: 'present' })
  })

  test('estudante de outra turma, data futura, coordenação e lista vazia são recusados', async ({
    client,
  }) => {
    const { classroom, preceptor, a } = await setup()
    const otherClass = await makeClassroom()
    const stranger = await makeStudent(otherClass)
    const base = { classroom_id: classroom.id, date: today() }

    ;(
      await client
        .put(`${API}/attendances/bulk`)
        .loginAs(preceptor)
        .json({ ...base, records: [{ student_id: stranger.id, status: 'present' }] })
    ).assertStatus(422)
    ;(
      await client
        .put(`${API}/attendances/bulk`)
        .loginAs(preceptor)
        .json({ ...base, date: '2999-01-01', records: [{ student_id: a.id, status: 'present' }] })
    ).assertStatus(422)
    ;(
      await client
        .put(`${API}/attendances/bulk`)
        .loginAs(preceptor)
        .json({ ...base, records: [] })
    ).assertStatus(422)
    ;(
      await client
        .put(`${API}/attendances/bulk`)
        .loginAs(preceptor)
        .json({
          ...base,
          records: [
            { student_id: a.id, status: 'present' },
            { student_id: a.id, status: 'absent' },
          ],
        })
    ).assertStatus(422)
    ;(
      await client
        .put(`${API}/attendances/bulk`)
        .loginAs(preceptor)
        .json({ ...base, records: [{ student_id: a.id, status: 'banana' }] })
    ).assertStatus(422)
  })

  test('turma sem acesso ou inativa não aceita registros', async ({ client }) => {
    const { classroom, preceptor, a } = await setup()
    const other = await makeClassroom()
    const outsider = await makeUser('preceptor', [other])
    ;(
      await client
        .put(`${API}/attendances/bulk`)
        .loginAs(outsider)
        .json({
          classroom_id: classroom.id,
          date: today(),
          records: [{ student_id: a.id, status: 'present' }],
        })
    ).assertStatus(403)
    classroom.isActive = false
    await classroom.save()
    ;(
      await client
        .put(`${API}/attendances/bulk`)
        .loginAs(preceptor)
        .json({
          classroom_id: classroom.id,
          date: today(),
          records: [{ student_id: a.id, status: 'present' }],
        })
    ).assertStatus(422)
  })

  test('consulta do histórico com filtros por situação e período (RF-12)', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, a, b } = await setup()
    for (const [date, status] of [
      [daysAgo(3), 'absent'],
      [daysAgo(2), 'present'],
      [daysAgo(1), 'absent'],
    ] as const) {
      await client
        .put(`${API}/attendances/bulk`)
        .loginAs(preceptor)
        .json({
          classroom_id: classroom.id,
          date,
          records: [
            { student_id: a.id, status },
            { student_id: b.id, status: 'present' },
          ],
        })
    }
    const count = async (qs: string) =>
      (await client.get(`${API}/attendances?${qs}`).loginAs(preceptor)).body().data.length
    assert.equal(await count(`student_id=${a.id}&status=absent`), 2)
    assert.equal(await count(`student_id=${a.id}&status=absent&from=${daysAgo(2)}`), 1)
    assert.equal(await count(`classroom_id=${classroom.id}`), 6)
    assert.equal(await count(`classroom_id=${classroom.id}&from=${daysAgo(1)}&to=${daysAgo(1)}`), 2)
  })
})

test.group('Checklist de fardamento e calçado (RF-02)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('registra e corrige o checklist do dia, com opção "não observado"', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, a, b } = await setup()
    const first = await client
      .put(`${API}/uniform-checks/bulk`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: today(),
        records: [
          {
            student_id: a.id,
            uniform_status: 'adequate',
            footwear_status: 'inadequate',
            note: 'Chinelo',
          },
          { student_id: b.id, uniform_status: 'not_observed', footwear_status: 'not_observed' },
        ],
      })
    first.assertStatus(200)

    const fix = await client
      .put(`${API}/uniform-checks/bulk`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: today(),
        records: [{ student_id: a.id, uniform_status: 'adequate', footwear_status: 'adequate' }],
      })
    fix.assertStatus(200)

    const roster = await client
      .get(`${API}/uniform-checks/roster?classroom_id=${classroom.id}&date=${today()}`)
      .loginAs(preceptor)
    const ana = roster.body().data.find((r: any) => r.student.id === a.id)
    assert.equal(ana.check.footwear_status, 'adequate')
    const log = await AuditLog.query()
      .where({ entity: 'uniform_checks', action: 'update' })
      .firstOrFail()
    assert.deepEqual(log.changes.footwear_status, { old: 'inadequate', new: 'adequate' })

    ;(
      await client
        .put(`${API}/uniform-checks/bulk`)
        .loginAs(preceptor)
        .json({
          classroom_id: classroom.id,
          date: today(),
          records: [{ student_id: a.id, uniform_status: 'ótimo', footwear_status: 'adequate' }],
        })
    ).assertStatus(422)
  })
})

test.group('Registro diário das aulas (RF-06, RF-07)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('registra o dia com tempos próprios e "Não identificado" sem inventar conteúdo', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor } = await setup()
    const res = await client
      .put(`${API}/lesson-days`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: today(),
        planned_lessons: 3,
        lessons: [
          {
            period: 1,
            teacher_name: 'Profa. Lúcia',
            subject: 'Português',
            content: 'Interpretação de texto',
            progress: 'Concluiu a leitura',
            notes: 'Turma participativa',
          },
          {
            period: 2,
            not_identified: true,
            not_identified_reason: 'Substituindo colega na turma vizinha',
          },
        ],
      })
    res.assertStatus(201)
    const lessons = res.body().lesson_day.lessons
    assert.lengthOf(lessons, 2)
    assert.isTrue(lessons[0].is_complete)
    assert.isTrue(lessons[1].not_identified)
    assert.isNull(lessons[1].content)
    assert.equal(lessons[1].not_identified_reason, 'Substituindo colega na turma vizinha')
  })

  test('"Não identificado" com conteúdo informado é recusado (nada é inventado)', async ({
    client,
  }) => {
    const { classroom, preceptor } = await setup()
    const res = await client
      .put(`${API}/lesson-days`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: today(),
        planned_lessons: 2,
        lessons: [{ period: 1, not_identified: true, content: 'Inventado' }],
      })
    res.assertStatus(422)
  })

  test('campos vazios não impedem o registro, mas a aula é marcada como incompleta', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor } = await setup()
    const res = await client
      .put(`${API}/lesson-days`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: today(),
        planned_lessons: 2,
        lessons: [{ period: 1, subject: 'Ciências' }],
      })
    res.assertStatus(201)
    assert.isFalse(res.body().lesson_day.lessons[0].is_complete)
  })

  test('tempo acima do previsto é recusado e reenviar atualiza sem apagar os demais tempos', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor } = await setup()
    const base = { classroom_id: classroom.id, date: today() }
    ;(
      await client
        .put(`${API}/lesson-days`)
        .loginAs(preceptor)
        .json({ ...base, planned_lessons: 2, lessons: [{ period: 3, subject: 'Arte' }] })
    ).assertStatus(422)

    await client
      .put(`${API}/lesson-days`)
      .loginAs(preceptor)
      .json({
        ...base,
        planned_lessons: 3,
        lessons: [
          { period: 1, subject: 'Arte' },
          { period: 2, subject: 'História' },
        ],
      })
    const upd = await client
      .put(`${API}/lesson-days`)
      .loginAs(preceptor)
      .json({
        ...base,
        planned_lessons: 3,
        lessons: [
          { period: 2, subject: 'Geografia', teacher_name: 'Prof. Davi', content: 'Mapas' },
          { period: 3, subject: 'Inglês' },
        ],
      })
    upd.assertStatus(200)
    const lessons = upd.body().lesson_day.lessons
    assert.deepEqual(
      lessons.map((l: any) => [l.period, l.subject]),
      [
        [1, 'Arte'],
        [2, 'Geografia'],
        [3, 'Inglês'],
      ]
    )
    assert.equal(await countRows(Lesson.query()), 3)

    // não dá para reduzir as aulas previstas abaixo do que já foi registrado
    ;(
      await client
        .put(`${API}/lesson-days`)
        .loginAs(preceptor)
        .json({ ...base, planned_lessons: 2 })
    ).assertStatus(422)
  })

  test('consulta dos dias de aula por turma e período', async ({ client, assert }) => {
    const { classroom, preceptor } = await setup()
    for (const d of [daysAgo(5), daysAgo(1)]) {
      await client
        .put(`${API}/lesson-days`)
        .loginAs(preceptor)
        .json({
          classroom_id: classroom.id,
          date: d,
          planned_lessons: 1,
          lessons: [{ period: 1, subject: 'Matemática' }],
        })
    }
    const res = await client
      .get(`${API}/lesson-days?classroom_id=${classroom.id}&from=${daysAgo(2)}`)
      .loginAs(preceptor)
    assert.lengthOf(res.body().data, 1)
    assert.equal(res.body().data[0].lessons[0].subject, 'Matemática')
  })
})
