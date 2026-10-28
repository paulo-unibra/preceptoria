import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Occurrence from '#models/occurrence'
import RaCode from '#models/ra_code'
import AuditLog from '#models/audit_log'
import {
  API,
  countRows,
  daysAgo,
  makeClassroom,
  makeStudent,
  makeUser,
  seedRaCodes,
  today,
} from '#tests/helpers'

async function scenario() {
  const classroom = await makeClassroom()
  const preceptor = await makeUser('preceptor', [classroom])
  const student = await makeStudent(classroom)
  return { classroom, preceptor, student }
}

const payload = (studentId: number, raCode: number, extra: Record<string, unknown> = {}) => ({
  student_id: studentId,
  occurred_on: today(),
  ra_code: raCode,
  description: 'Descrição objetiva do fato',
  ...extra,
})

test.group('RAs: polaridade (RN01, RN02, RN03, CA01, CA02)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => seedRaCodes())

  test('CA01: ao cadastrar um RA 09 o sistema o classifica como positivo', async ({
    client,
    assert,
  }) => {
    const { preceptor, student } = await scenario()
    const res = await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(payload(student.id, 9))
    res.assertStatus(201)
    assert.equal(res.body().occurrence.polarity, 'positive')
    assert.isFalse(res.body().occurrence.polarity_divergent)
  })

  test('RN01: 01-09 positivos e 10-21 negativos', async ({ client, assert }) => {
    const { preceptor, student } = await scenario()
    for (const [code, expected] of [
      [1, 'positive'],
      [5, 'positive'],
      [9, 'positive'],
      [10, 'negative'],
      [15, 'negative'],
      [21, 'negative'],
    ] as const) {
      const res = await client
        .post(`${API}/occurrences`)
        .loginAs(preceptor)
        .json(payload(student.id, code, { description: `Fato do código ${code}` }))
      res.assertStatus(201)
      assert.equal(res.body().occurrence.polarity, expected, `código ${code}`)
    }
  })

  test('RN01: a polaridade enviada pelo cliente é ignorada', async ({ client, assert }) => {
    const { preceptor, student } = await scenario()
    const res = await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(payload(student.id, 9, { polarity: 'negative' }))
    // O campo desconhecido não muda nada: o servidor deriva a polaridade do código.
    assert.equal(res.body().occurrence?.polarity, 'positive')
  })

  test('código fora da faixa 01-21 é recusado', async ({ client }) => {
    const { preceptor, student } = await scenario()
    ;(
      await client.post(`${API}/occurrences`).loginAs(preceptor).json(payload(student.id, 22))
    ).assertStatus(422)
    ;(
      await client.post(`${API}/occurrences`).loginAs(preceptor).json(payload(student.id, 0))
    ).assertStatus(422)
  })

  test('código RA desativado pelo administrador não pode ser usado', async ({ client }) => {
    const { preceptor, student } = await scenario()
    await RaCode.query().where('code', 4).update({ is_active: false })
    const res = await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(payload(student.id, 4))
    res.assertStatus(422)
  })

  test('CA02/RN03: registro antigo com RA 09 negativo é sinalizado e o dado original é preservado', async ({
    client,
    assert,
  }) => {
    const { classroom, student } = await scenario()
    const admin = await makeUser('admin')
    const legacy = await Occurrence.create({
      studentId: student.id,
      classroomId: classroom.id,
      occurredOn: (await import('luxon')).DateTime.fromISO(daysAgo(30)),
      raCode: 9,
      polarity: 'negative',
      source: 'legacy',
      description: 'Registro importado do caderno',
      status: 'active',
    })

    await legacy.refresh()
    assert.isTrue(legacy.polarityDivergent, 'deve ser sinalizado')
    assert.equal(legacy.polarity, 'negative', 'o valor original não pode ser alterado em silêncio')
    assert.equal(legacy.raCode, 9)

    // aparece na fila de conferência
    const list = await client.get(`${API}/occurrences?needs_review=true`).loginAs(admin)
    list.assertStatus(200)
    assert.deepEqual(
      list.body().data.map((o: any) => o.id),
      [legacy.id]
    )
    assert.equal(list.body().data[0].expected_polarity, 'positive')
    assert.isTrue(list.body().data[0].needs_review)

    // editar outro campo não "conserta" a polaridade nem apaga o sinal
    const edit = await client
      .patch(`${API}/occurrences/${legacy.id}`)
      .loginAs(admin)
      .json({ description: 'Descrição conferida' })
    edit.assertStatus(200)
    assert.equal(edit.body().occurrence.polarity, 'negative')
    assert.isTrue(edit.body().occurrence.polarity_divergent)
    assert.equal(edit.body().warnings[0].code, 'polarity_divergent')
  })

  test('RN03: após conferência o administrador resolve e o valor anterior fica na auditoria', async ({
    client,
    assert,
  }) => {
    const { classroom, student, preceptor } = await scenario()
    const admin = await makeUser('admin')
    const legacy = await Occurrence.create({
      studentId: student.id,
      classroomId: classroom.id,
      occurredOn: (await import('luxon')).DateTime.fromISO(daysAgo(30)),
      raCode: 9,
      polarity: 'negative',
      source: 'legacy',
      description: 'Registro importado',
      status: 'active',
    })

    ;(
      await client.post(`${API}/occurrences/${legacy.id}/resolve-divergence`).loginAs(preceptor)
    ).assertStatus(403)
    const res = await client
      .post(`${API}/occurrences/${legacy.id}/resolve-divergence`)
      .loginAs(admin)
    res.assertStatus(200)
    assert.equal(res.body().occurrence.polarity, 'positive')
    assert.isFalse(res.body().occurrence.polarity_divergent)

    const log = await AuditLog.query()
      .where({ entity: 'occurrences', entity_id: legacy.id, action: 'update' })
      .firstOrFail()
    assert.deepEqual(log.changes.polarity, { old: 'negative', new: 'positive' })
    assert.equal(log.userId, admin.id)
  })
})

test.group('RAs: datas, duplicidade e cancelamento (RN04, RN08, DP04)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => seedRaCodes())

  test('RN04: data do acontecimento e data de cadastro são armazenadas separadamente', async ({
    client,
    assert,
  }) => {
    const { preceptor, student } = await scenario()
    const res = await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(payload(student.id, 3, { occurred_on: daysAgo(5) }))
    res.assertStatus(201)
    const o = res.body().occurrence
    assert.equal(o.occurred_on, daysAgo(5))
    assert.equal(o.created_at.slice(0, 10), today())
    assert.notEqual(o.occurred_on, o.created_at.slice(0, 10))
  })

  test('data futura não é aceita', async ({ client }) => {
    const { preceptor, student } = await scenario()
    const res = await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(payload(student.id, 3, { occurred_on: '2999-01-01' }))
    res.assertStatus(422)
  })

  test('RN08: possível duplicidade é sinalizada, sem exclusão automática', async ({
    client,
    assert,
  }) => {
    const { preceptor, student } = await scenario()
    const first = await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(payload(student.id, 12))
    first.assertStatus(201)
    assert.lengthOf(first.body().warnings, 0)

    const second = await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(payload(student.id, 12))
    second.assertStatus(201)
    assert.equal(second.body().warnings[0].code, 'possible_duplicate')
    assert.equal(second.body().warnings[0].related_id, first.body().occurrence.id)
    assert.isTrue(second.body().occurrence.needs_review)

    // nada foi apagado
    assert.equal(await countRows(Occurrence.query().where('student_id', student.id)), 2)
  })

  test('RN08: coordenação marca a duplicidade como revisada', async ({ client, assert }) => {
    const { classroom, preceptor, student } = await scenario()
    const coord = await makeUser('coordenacao', [classroom])
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(payload(student.id, 12))
    const dup = await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(payload(student.id, 12))
    const id = dup.body().occurrence.id

    ;(
      await client.post(`${API}/occurrences/${id}/review-duplicate`).loginAs(preceptor)
    ).assertStatus(403)
    const res = await client.post(`${API}/occurrences/${id}/review-duplicate`).loginAs(coord)
    res.assertStatus(200)
    assert.isFalse(res.body().occurrence.needs_review)
  })

  test('cancelamento exige motivo, preserva o registro e o tira das listagens padrão', async ({
    client,
    assert,
  }) => {
    const { preceptor, student } = await scenario()
    const created = await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(payload(student.id, 12))
    const id = created.body().occurrence.id

    ;(
      await client.post(`${API}/occurrences/${id}/cancel`).loginAs(preceptor).json({})
    ).assertStatus(422)
    const res = await client
      .post(`${API}/occurrences/${id}/cancel`)
      .loginAs(preceptor)
      .json({ reason: 'Lançado para o aluno errado' })
    res.assertStatus(200)
    assert.equal(res.body().occurrence.status, 'cancelled')
    assert.equal(res.body().occurrence.cancel_reason, 'Lançado para o aluno errado')

    assert.isNotNull(await Occurrence.find(id), 'o registro continua no banco')
    const active = await client.get(`${API}/occurrences`).loginAs(preceptor)
    assert.lengthOf(active.body().data, 0)
    const all = await client.get(`${API}/occurrences?status=all`).loginAs(preceptor)
    assert.lengthOf(all.body().data, 1)

    ;(
      await client
        .patch(`${API}/occurrences/${id}`)
        .loginAs(preceptor)
        .json({ description: 'Tentando editar' })
    ).assertStatus(409)
    ;(
      await client
        .post(`${API}/occurrences/${id}/cancel`)
        .loginAs(preceptor)
        .json({ reason: 'De novo' })
    ).assertStatus(409)

    const log = await AuditLog.query()
      .where({ entity: 'occurrences', entity_id: id, action: 'cancel' })
      .firstOrFail()
    assert.equal(log.changes.status.new, 'cancelled')
  })

  test('outro preceptor não altera nem cancela registro de colega; administrador pode', async ({
    client,
  }) => {
    const { classroom, preceptor, student } = await scenario()
    const colleague = await makeUser('preceptor', [classroom])
    const admin = await makeUser('admin')
    const created = await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(payload(student.id, 12))
    const id = created.body().occurrence.id

    ;(
      await client
        .patch(`${API}/occurrences/${id}`)
        .loginAs(colleague)
        .json({ description: 'Alterado por colega' })
    ).assertStatus(403)
    ;(
      await client
        .post(`${API}/occurrences/${id}/cancel`)
        .loginAs(colleague)
        .json({ reason: 'Quero cancelar' })
    ).assertStatus(403)
    ;(
      await client
        .patch(`${API}/occurrences/${id}`)
        .loginAs(admin)
        .json({ description: 'Corrigido pela gestão' })
    ).assertStatus(200)
  })

  test('filtros por polaridade, código, período e estudante (RF-12)', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, student } = await scenario()
    const other = await makeStudent(classroom)
    await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(payload(student.id, 3, { occurred_on: daysAgo(10) }))
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(payload(student.id, 12))
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(payload(other.id, 12))

    const count = async (qs: string) =>
      (await client.get(`${API}/occurrences?${qs}`).loginAs(preceptor)).body().data.length
    assert.equal(await count(''), 3)
    assert.equal(await count('polarity=negative'), 2)
    assert.equal(await count('polarity=positive'), 1)
    assert.equal(await count('ra_code=12'), 2)
    assert.equal(await count(`student_id=${student.id}`), 2)
    assert.equal(await count(`from=${daysAgo(2)}`), 2)
    assert.equal(await count(`to=${daysAgo(5)}`), 1)
    assert.equal(
      await count(`classroom_id=${classroom.id}&polarity=negative&student_id=${other.id}`),
      1
    )
  })
})
