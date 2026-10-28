import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { API, makeClassroom, makeStudent, makeUser, seedRaCodes, today } from '#tests/helpers'

async function setup() {
  const classroom = await makeClassroom('6º A')
  const preceptor = await makeUser('preceptor', [classroom])
  const star = await makeStudent(classroom, 'Estudante Destaque')
  const good = await makeStudent(classroom, 'Estudante Bom')
  const struggling = await makeStudent(classroom, 'Estudante Em Dificuldade')
  const nothing = await makeStudent(classroom, 'Estudante Sem Registro')
  return { classroom, preceptor, star, good, struggling, nothing }
}

const occ = (student_id: number, ra_code: number) => ({
  student_id,
  occurred_on: today(),
  ra_code,
  description: 'Registro para ranking',
})

test.group('Ranking (RF-03)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => seedRaCodes())

  test('destaca quem tem registros positivos e não expõe quem está com dificuldades', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, star, good, struggling } = await setup()
    for (const code of [1, 2, 3])
      await client.post(`${API}/occurrences`).loginAs(preceptor).json(occ(star.id, code))
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(occ(good.id, 4))
    for (const code of [12, 13, 14])
      await client.post(`${API}/occurrences`).loginAs(preceptor).json(occ(struggling.id, code))
    await client
      .put(`${API}/attendances/bulk`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: today(),
        records: [
          { student_id: star.id, status: 'present' },
          { student_id: good.id, status: 'present' },
          { student_id: struggling.id, status: 'absent' },
        ],
      })

    const res = await client
      .get(`${API}/ranking?kind=weekly&classroom_id=${classroom.id}`)
      .loginAs(preceptor)
    res.assertStatus(200)
    const names = res.body().data.map((e: any) => e.student.full_name)
    assert.deepEqual(names, ['Estudante Destaque', 'Estudante Bom'])
    assert.notInclude(names, 'Estudante Em Dificuldade')
    assert.notInclude(names, 'Estudante Sem Registro')
    assert.deepEqual(
      res.body().data.map((e: any) => e.position),
      [1, 2]
    )
    assert.isAbove(res.body().data[0].score, res.body().data[1].score)
  })

  test('os critérios usados e a composição da nota são transparentes', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, star } = await setup()
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(occ(star.id, 1))
    const res = await client.get(`${API}/ranking?classroom_id=${classroom.id}`).loginAs(preceptor)
    const body = res.body()
    assert.property(body.criteria.weights, 'positive_ra')
    assert.property(body.criteria.weights, 'progress')
    assert.deepEqual(Object.keys(body.period), ['from', 'to'])
    const entry = body.data[0]
    assert.equal(entry.breakdown.positive_ras, 1)
    const sum = Object.values(entry.breakdown.points as Record<string, number>).reduce(
      (a, b) => a + b,
      0
    )
    assert.closeTo(sum, entry.score, 0.02, 'a soma dos pontos explica a nota')
  })

  test('período quinzenal enxerga registros mais antigos que o semanal', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, star } = await setup()
    const tenDaysAgo = (await import('luxon')).DateTime.now().minus({ days: 10 }).toISODate()!
    await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json({ ...occ(star.id, 1), occurred_on: tenDaysAgo })
    const weekly = await client
      .get(`${API}/ranking?kind=weekly&classroom_id=${classroom.id}`)
      .loginAs(preceptor)
    const biweekly = await client
      .get(`${API}/ranking?kind=biweekly&classroom_id=${classroom.id}`)
      .loginAs(preceptor)
    assert.lengthOf(weekly.body().data, 0)
    assert.lengthOf(biweekly.body().data, 1)
  })

  test('administrador configura pesos e quantidade de destaques', async ({ client, assert }) => {
    const { classroom, preceptor, star, good } = await setup()
    const admin = await makeUser('admin')
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(occ(star.id, 1))
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(occ(good.id, 2))

    const update = await client
      .put(`${API}/settings/ranking`)
      .loginAs(admin)
      .json({
        period_days: { weekly: 7, biweekly: 14 },
        top_n: 1,
        weights: {
          positive_ra: 10,
          negative_ra: -1,
          attendance_rate: 0,
          uniform_rate: 0,
          progress: 0,
        },
      })
    update.assertStatus(200)

    const res = await client.get(`${API}/ranking?classroom_id=${classroom.id}`).loginAs(preceptor)
    assert.lengthOf(res.body().data, 1)
    assert.equal(res.body().data[0].score, 10)
    assert.equal(res.body().criteria.top_n, 1)

    ;(await client.put(`${API}/settings/ranking`).loginAs(admin).json({ top_n: 0 })).assertStatus(
      422
    )
  })

  test('preceptor não vê ranking de turma que não é sua', async ({ client }) => {
    const { preceptor } = await setup()
    const other = await makeClassroom('Outra')
    ;(await client.get(`${API}/ranking?classroom_id=${other.id}`).loginAs(preceptor)).assertStatus(
      403
    )
  })
})
