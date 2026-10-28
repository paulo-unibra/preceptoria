import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import AuditLog from '#models/audit_log'
import Occurrence from '#models/occurrence'
import PdfService, { itemDescription, totalsLines } from '#services/pdf_service'
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

/** Extrai o texto de um PDF não comprimido (compress=false em ambiente de teste). */
function pdfText(buffer: Buffer): string {
  return [...buffer.toString('latin1').matchAll(/<([0-9a-fA-F]+)>/g)]
    .map((m) => Buffer.from(m[1], 'hex').toString('latin1'))
    .join('')
}
const br = (iso: string) => iso.split('-').reverse().join('/')

async function setup() {
  const classroom = await makeClassroom('7º A')
  const preceptor = await makeUser('preceptor', [classroom])
  const student = await makeStudent(classroom, 'Ana Beatriz')
  const other = await makeStudent(classroom, 'Bruno Lima')
  return { classroom, preceptor, student, other }
}

const ra = (
  studentId: number,
  code: number,
  occurredOn = today(),
  description = `Fato do código ${code}`
) => ({
  student_id: studentId,
  occurred_on: occurredOn,
  ra_code: code,
  description,
})

test.group('Histórico e relatórios (CA03, CA04, CA05, RN05, RN06, RN07)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => seedRaCodes())

  test('CA03: consulta por período mostra os registros e os totais correspondentes', async ({
    client,
    assert,
  }) => {
    const { preceptor, student } = await setup()
    await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(ra(student.id, 3, daysAgo(20)))
    await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(ra(student.id, 5, daysAgo(3)))
    await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(ra(student.id, 12, daysAgo(1)))

    const all = await client.get(`${API}/students/${student.id}/history`).loginAs(preceptor)
    all.assertStatus(200)
    assert.equal(all.body().totals.occurrences.total, 3)
    assert.lengthOf(
      all.body().items.filter((i: any) => i.type === 'occurrence'),
      3
    )

    const period = await client
      .get(`${API}/students/${student.id}/history?from=${daysAgo(5)}&to=${today()}`)
      .loginAs(preceptor)
    const body = period.body()
    assert.equal(body.totals.occurrences.total, 2, 'o RA de 20 dias atrás fica de fora dos totais')
    assert.equal(body.totals.occurrences.positive, 1)
    assert.equal(body.totals.occurrences.negative, 1)
    // Detalhes e totais saem do mesmo conjunto de registros e do mesmo período (RN05).
    const occurrenceItems = body.items.filter((i: any) => i.type === 'occurrence')
    assert.lengthOf(occurrenceItems, body.totals.occurrences.total)
    assert.isTrue(occurrenceItems.every((i: any) => i.date >= daysAgo(5) && i.date <= today()))
  })

  test('histórico é cronológico (mais recente primeiro) e mistura todos os tipos (RF-09)', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, student } = await setup()
    await client
      .put(`${API}/attendances/bulk`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: daysAgo(2),
        records: [{ student_id: student.id, status: 'absent' }],
      })
    await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(ra(student.id, 3, daysAgo(1)))
    await client
      .post(`${API}/observations`)
      .loginAs(preceptor)
      .json({ student_id: student.id, observed_on: today(), content: 'Conversa com a família.' })

    const res = await client.get(`${API}/students/${student.id}/history`).loginAs(preceptor)
    const items = res.body().items
    assert.deepEqual(
      items.map((i: any) => i.type),
      ['observation', 'occurrence', 'attendance']
    )
    assert.deepEqual(
      items.map((i: any) => i.date),
      [...items.map((i: any) => i.date)].sort().reverse()
    )
  })

  test('CA04/RN06: notificação vinculada a uma ocorrência conta 1 ocorrência e 1 notificação', async ({
    client,
    assert,
  }) => {
    const { preceptor, student } = await setup()
    const occ = await client.post(`${API}/occurrences`).loginAs(preceptor).json(ra(student.id, 14))
    const occurrenceId = occ.body().occurrence.id

    const notif = await client.post(`${API}/notifications`).loginAs(preceptor).json({
      student_id: student.id,
      notified_on: today(),
      reason: 'Comunicado à família sobre o fato',
      occurrence_id: occurrenceId,
    })
    notif.assertStatus(201)

    const res = await client.get(`${API}/students/${student.id}/history`).loginAs(preceptor)
    const totals = res.body().totals
    assert.equal(totals.occurrences.total, 1)
    assert.equal(totals.notifications.total, 1)
    assert.equal(totals.notifications.linked_to_occurrence, 1)
    // A notificação continua sendo notificação: não gerou outra ocorrência.
    assert.equal(await countRows(Occurrence.query().where('student_id', student.id)), 1)
    assert.deepEqual(
      res
        .body()
        .items.map((i: any) => i.type)
        .sort(),
      ['notification', 'occurrence']
    )
  })

  test('notificação só pode vincular ocorrência do mesmo estudante e não cancelada', async ({
    client,
  }) => {
    const { preceptor, student, other } = await setup()
    const occ = await client.post(`${API}/occurrences`).loginAs(preceptor).json(ra(other.id, 14))
    const res = await client.post(`${API}/notifications`).loginAs(preceptor).json({
      student_id: student.id,
      notified_on: today(),
      reason: 'Tentativa inválida',
      occurrence_id: occ.body().occurrence.id,
    })
    res.assertStatus(422)
  })

  test('RN07: faltas, notificações e RAs têm contagens separadas', async ({ client, assert }) => {
    const { classroom, preceptor, student } = await setup()
    await client
      .put(`${API}/attendances/bulk`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: today(),
        records: [{ student_id: student.id, status: 'absent' }],
      })
    await client
      .put(`${API}/attendances/bulk`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: daysAgo(1),
        records: [{ student_id: student.id, status: 'late', minutes_late: 15 }],
      })
    await client
      .post(`${API}/notifications`)
      .loginAs(preceptor)
      .json({ student_id: student.id, notified_on: today(), reason: 'Faltas seguidas' })
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(ra(student.id, 12))

    const t = (await client.get(`${API}/students/${student.id}/history`).loginAs(preceptor)).body()
      .totals
    assert.equal(t.attendance.absent, 1)
    assert.equal(t.attendance.late, 1, 'atraso não é contado como falta')
    assert.equal(t.attendance.minutes_late, 15)
    assert.equal(t.notifications.total, 1)
    assert.equal(t.occurrences.total, 1)
  })

  test('registros cancelados ficam fora dos totais e aparecem em "cancelled"', async ({
    client,
    assert,
  }) => {
    const { preceptor, student } = await setup()
    const a = await client.post(`${API}/occurrences`).loginAs(preceptor).json(ra(student.id, 3))
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(ra(student.id, 5))
    await client
      .post(`${API}/occurrences/${a.body().occurrence.id}/cancel`)
      .loginAs(preceptor)
      .json({ reason: 'Registro indevido' })

    const normal = (
      await client.get(`${API}/students/${student.id}/history`).loginAs(preceptor)
    ).body()
    assert.equal(normal.totals.occurrences.total, 1)
    assert.lengthOf(normal.items, 1)

    const withCancelled = (
      await client
        .get(`${API}/students/${student.id}/history?include_cancelled=true`)
        .loginAs(preceptor)
    ).body()
    assert.equal(withCancelled.totals.occurrences.total, 1, 'cancelado nunca soma nos totais')
    assert.equal(withCancelled.totals.cancelled.occurrences, 1)
    assert.lengthOf(withCancelled.items, 2)
  })

  test('filtro por tipos limita totais e detalhes juntos (RN05)', async ({ client, assert }) => {
    const { classroom, preceptor, student } = await setup()
    await client
      .put(`${API}/attendances/bulk`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: today(),
        records: [{ student_id: student.id, status: 'absent' }],
      })
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(ra(student.id, 3))

    const body = (
      await client.get(`${API}/students/${student.id}/history?types=occurrence`).loginAs(preceptor)
    ).body()
    assert.equal(body.totals.occurrences.total, 1)
    assert.equal(body.totals.attendance.records, 0)
    assert.deepEqual(
      body.items.map((i: any) => i.type),
      ['occurrence']
    )

    ;(
      await client.get(`${API}/students/${student.id}/history?types=banana`).loginAs(preceptor)
    ).assertStatus(422)
    ;(
      await client
        .get(`${API}/students/${student.id}/history?from=${today()}&to=${daysAgo(3)}`)
        .loginAs(preceptor)
    ).assertStatus(422)
  })

  test('CA05: o PDF exportado traz os mesmos totais e detalhes da consulta', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, student } = await setup()
    await client
      .put(`${API}/attendances/bulk`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: daysAgo(1),
        records: [{ student_id: student.id, status: 'absent', is_justified: true }],
      })
    await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(ra(student.id, 3, daysAgo(2), 'Ajudou os colegas na atividade'))
    await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(ra(student.id, 12, daysAgo(1), 'Uso de celular em aula'))
    await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(ra(student.id, 5, daysAgo(40), 'Fora do período consultado'))

    const qs = `from=${daysAgo(10)}&to=${today()}`
    const json = (
      await client.get(`${API}/reports/students/${student.id}?${qs}`).loginAs(preceptor)
    ).body()
    const pdfRes = await client
      .get(`${API}/reports/students/${student.id}?${qs}&format=pdf`)
      .loginAs(preceptor)
    pdfRes.assertStatus(200)
    assert.include(pdfRes.header('content-type'), 'application/pdf')
    assert.include(pdfRes.header('content-disposition'), 'relatorio-ana-beatriz.pdf')

    const buffer = await PdfService.studentReport(json)
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-')
    const text = pdfText(buffer)

    for (const [label, value] of totalsLines(json.totals)) {
      assert.include(
        text,
        `${label}${value}`,
        `total "${label}" deve aparecer no PDF com valor ${value}`
      )
    }
    assert.equal(json.totals.occurrences.total, 2)
    assert.lengthOf(json.items, 3, '2 RAs + 1 frequência no período')
    for (const item of json.items)
      assert.include(text, `${br(item.date)}  -  ${itemDescription(item)}`)
    assert.notInclude(text, 'Fora do período consultado')
    assert.include(text, 'Ana Beatriz')
  })

  test('relatório da turma: totais = soma dos estudantes e aulas "Não identificado" aparecem à parte (RN05, RF-10)', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, student, other } = await setup()
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(ra(student.id, 3))
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(ra(student.id, 12))
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(ra(other.id, 12))
    await client
      .put(`${API}/attendances/bulk`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: today(),
        records: [
          { student_id: student.id, status: 'absent' },
          { student_id: other.id, status: 'present' },
        ],
      })
    await client
      .put(`${API}/lesson-days`)
      .loginAs(preceptor)
      .json({
        classroom_id: classroom.id,
        date: today(),
        planned_lessons: 3,
        lessons: [
          { period: 1, teacher_name: 'Prof. Carlos', subject: 'Matemática', content: 'Frações' },
          { period: 2, not_identified: true, not_identified_reason: 'Substituindo colega' },
        ],
      })

    const res = await client.get(`${API}/reports/classrooms/${classroom.id}`).loginAs(preceptor)
    res.assertStatus(200)
    const r = res.body()
    assert.equal(r.totals.occurrences.total, 3)
    assert.equal(r.totals.occurrences.negative, 2)
    const sum = (pick: (t: any) => number) =>
      r.students.reduce((n: number, s: any) => n + pick(s.totals), 0)
    assert.equal(
      sum((t) => t.occurrences.total),
      r.totals.occurrences.total
    )
    assert.equal(
      sum((t) => t.attendance.absent),
      r.totals.attendance.absent
    )
    assert.equal(r.lessons.registered_lessons, 2)
    assert.equal(r.lessons.not_identified_lessons, 1)
    assert.equal(r.lessons.planned_lessons, 3)

    const pdf = await client
      .get(`${API}/reports/classrooms/${classroom.id}?format=pdf`)
      .loginAs(preceptor)
    pdf.assertStatus(200)
    assert.include(pdf.header('content-type'), 'application/pdf')
    const text = pdfText(await PdfService.classroomReport(r))
    assert.include(text, 'Não identificado (Substituindo colega)')
  })

  test('RNF04: estudante que mudou de turma não perde registros no relatório da turma antiga', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, student } = await setup()
    const newClass = await makeClassroom('8º A')
    const admin = await makeUser('admin')
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(ra(student.id, 3))
    ;(
      await client
        .patch(`${API}/students/${student.id}`)
        .loginAs(admin)
        .json({ classroom_id: newClass.id })
    ).assertStatus(200)

    const r = (
      await client.get(`${API}/reports/classrooms/${classroom.id}`).loginAs(preceptor)
    ).body()
    assert.equal(r.totals.occurrences.total, 1)
    assert.isTrue(r.students.some((s: any) => s.student.id === student.id))
  })
})

test.group('Rastreabilidade (CA06, RNF03)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => seedRaCodes())

  test('CA06: ao corrigir um registro dá para ver valor anterior, novo valor, autor e data', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, student } = await setup()
    const coord = await makeUser('coordenacao', [classroom])
    const created = await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(ra(student.id, 12, today(), 'Descrição original'))
    const id = created.body().occurrence.id

    const fix = await client
      .patch(`${API}/occurrences/${id}`)
      .loginAs(preceptor)
      .json({ description: 'Descrição corrigida', ra_code: 13 })
    fix.assertStatus(200)

    const res = await client
      .get(`${API}/audit-logs?entity=occurrences&entity_id=${id}`)
      .loginAs(coord)
    res.assertStatus(200)
    const logs = res.body().data
    assert.lengthOf(logs, 2)
    const update = logs.find((l: any) => l.action === 'update')
    assert.deepEqual(update.changes.description, {
      old: 'Descrição original',
      new: 'Descrição corrigida',
    })
    assert.deepEqual(update.changes.ra_code, { old: 12, new: 13 })
    assert.equal(update.user.id, preceptor.id)
    assert.match(update.created_at, /^\d{4}-\d{2}-\d{2}T/)
    assert.notProperty(update.changes, 'updated_at', 'ruído de timestamps não entra no diff')

    const create = logs.find((l: any) => l.action === 'create')
    assert.equal(create.user.id, preceptor.id)
    assert.equal(create.changes.description.new, 'Descrição original')
  })

  test('created_by/updated_by são preenchidos com o usuário autenticado', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, student } = await setup()
    const admin = await makeUser('admin')
    const created = await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(ra(student.id, 12))
    const id = created.body().occurrence.id
    await client
      .patch(`${API}/occurrences/${id}`)
      .loginAs(admin)
      .json({ description: 'Ajustado pela gestão' })
    const row = await Occurrence.findOrFail(id)
    assert.equal(row.createdBy, preceptor.id)
    assert.equal(row.updatedBy, admin.id)
    assert.equal(classroom.id, row.classroomId)
  })

  test('alteração sem mudança real não gera log nem ruído', async ({ client, assert }) => {
    const { preceptor, student } = await setup()
    const created = await client
      .post(`${API}/occurrences`)
      .loginAs(preceptor)
      .json(ra(student.id, 12, today(), 'Mesma descrição'))
    const id = created.body().occurrence.id
    await client
      .patch(`${API}/occurrences/${id}`)
      .loginAs(preceptor)
      .json({ description: 'Mesma descrição' })
    assert.equal(
      await countRows(AuditLog.query().where({ entity: 'occurrences', entity_id: id })),
      1
    )
  })

  test('preceptor não consulta o log de auditoria; coordenação só vê as próprias turmas', async ({
    client,
    assert,
  }) => {
    const { classroom, preceptor, student } = await setup()
    const otherClass = await makeClassroom()
    const coordOther = await makeUser('coordenacao', [otherClass])
    await client.post(`${API}/occurrences`).loginAs(preceptor).json(ra(student.id, 12))
    ;(await client.get(`${API}/audit-logs`).loginAs(preceptor)).assertStatus(403)
    const res = await client
      .get(`${API}/audit-logs?classroom_id=${classroom.id}`)
      .loginAs(coordOther)
    assert.lengthOf(res.body().data, 0)
  })

  test('mudança de turma do estudante fica registrada (enturmação)', async ({ client, assert }) => {
    const { classroom, student } = await setup()
    const admin = await makeUser('admin')
    const dest = await makeClassroom('9º A')
    await client
      .patch(`${API}/students/${student.id}`)
      .loginAs(admin)
      .json({ classroom_id: dest.id })
    const log = await AuditLog.query()
      .where({ entity: 'students', entity_id: student.id, action: 'update' })
      .firstOrFail()
    assert.deepEqual(log.changes.classroom_id, { old: classroom.id, new: dest.id })
  })
})
