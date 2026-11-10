import { test } from '@japa/runner'
import { mkdtemp, writeFile, rm, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Student from '#models/student'
import Guardian from '#models/guardian'
import { API, makeClassroom, makeStudent, makeUser } from '#tests/helpers'
import { makeStudentPdf } from '#tests/fixtures/student_pdf'

test.group('Importação de estudantes', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('exige autenticação e administração também para consultar fichas completas', async ({
    client,
  }) => {
    const preceptor = await makeUser('preceptor')
    ;(await client.post(`${API}/imports/students`)).assertStatus(401)
    ;(await client.post(`${API}/imports/students`).loginAs(preceptor)).assertStatus(403)
    ;(await client.get(`${API}/imports/students`).loginAs(preceptor)).assertStatus(403)
    ;(await client.get(`${API}/students/1/imported-profile`).loginAs(preceptor)).assertStatus(403)
  })

  test('cria turma, estudantes, responsáveis, fichas e fotos; reenvio não duplica', async ({
    client,
    assert,
    cleanup,
  }) => {
    const admin = await makeUser('admin')
    const dir = await mkdtemp(join(tmpdir(), 'preceptoria-test-'))
    cleanup(() => rm(dir, { recursive: true, force: true }))
    const file = join(dir, 'FICHAS_9° ANO A.pdf')
    await writeFile(file, await makeStudentPdf({ registration: '900000000001' }))
    const imported = await client.post(`${API}/imports/students`).loginAs(admin).file('file', file)
    imported.assertStatus(201)
    assert.equal(imported.body().created, 1)
    assert.isTrue(imported.body().classroom_created)
    assert.equal(imported.body().classroom.name, '9º ANO A')
    assert.equal(imported.body().photos_saved, 1)
    const student = await Student.findOrFail(imported.body().rows[0].student_id)
    cleanup(() =>
      unlink(
        app.makePath(env.get('STORAGE_PATH') ?? 'storage', 'photos', student.photoPath!)
      ).catch(() => {})
    )
    assert.isAbove((await Guardian.query().where('student_id', student.id)).length, 0)
    ;(await client.get(`${API}/students/${student.id}/photo`).loginAs(admin)).assertStatus(200)
    const profile = await client
      .get(`${API}/students/${student.id}/imported-profile`)
      .loginAs(admin)
    profile.assertStatus(200)
    assert.lengthOf(profile.body().profile.source.pages, 3)
    const repeated = await client.post(`${API}/imports/students`).loginAs(admin).file('file', file)
    repeated.assertStatus(200)
    assert.isTrue(repeated.body().already_imported)
    assert.equal(repeated.body().id, imported.body().id)
    assert.lengthOf(await Student.query().where('registration', '900000000001'), 1)
    assert.lengthOf(await db.from('student_import_entries'), 1)
    const list = await client.get(`${API}/students`).loginAs(admin)
    assert.notProperty(list.body().data[0], 'profile')
    assert.notProperty(list.body().data[0], 'imported_profile')
  })

  test('reutiliza turma equivalente e não sobrescreve matrícula de outra pessoa', async ({
    client,
    assert,
    cleanup,
  }) => {
    const admin = await makeUser('admin')
    const classroom = await makeClassroom('9° A')
    const student = await makeStudent(classroom, 'OUTRA PESSOA')
    student.registration = '900000000001'
    await student.save()
    const dir = await mkdtemp(join(tmpdir(), 'preceptoria-test-'))
    cleanup(() => rm(dir, { recursive: true, force: true }))
    const file = join(dir, 'FICHAS_9º ANO A.pdf')
    await writeFile(file, await makeStudentPdf({ registration: '900000000001' }))
    const imported = await client.post(`${API}/imports/students`).loginAs(admin).file('file', file)
    imported.assertStatus(201)
    assert.equal(imported.body().classroom.id, classroom.id)
    assert.isFalse(imported.body().classroom_created)
    assert.equal(imported.body().conflicts, 1)
    assert.equal(imported.body().photos_saved, 0)
    await student.refresh()
    assert.equal(student.fullName, 'OUTRA PESSOA')
    assert.isNull(student.photoPath)
  })

  test('arquivo incompleto falha antes de criar turma ou aluno', async ({
    client,
    assert,
    cleanup,
  }) => {
    const admin = await makeUser('admin')
    const dir = await mkdtemp(join(tmpdir(), 'preceptoria-test-'))
    cleanup(() => rm(dir, { recursive: true, force: true }))
    const file = join(dir, 'FICHAS_9º ANO A.pdf')
    await writeFile(file, await makeStudentPdf({ registration: '900000000001', complete: false }))
    ;(await client.post(`${API}/imports/students`).loginAs(admin).file('file', file)).assertStatus(
      422
    )
    assert.lengthOf(await db.from('student_imports'), 0)
    assert.lengthOf(await Student.all(), 0)
  })

  test('outro PDF da mesma matrícula preserva foto, anotações e responsáveis existentes', async ({
    client,
    assert,
    cleanup,
  }) => {
    const admin = await makeUser('admin')
    const dir = await mkdtemp(join(tmpdir(), 'preceptoria-test-'))
    cleanup(() => rm(dir, { recursive: true, force: true }))
    const file = join(dir, 'FICHAS_9º ANO A.pdf')
    await writeFile(file, await makeStudentPdf())
    const first = await client.post(`${API}/imports/students`).loginAs(admin).file('file', file)
    first.assertStatus(201)
    const student = await Student.findOrFail(first.body().rows[0].student_id)
    const photoPath = student.photoPath!
    cleanup(() =>
      unlink(app.makePath(env.get('STORAGE_PATH') ?? 'storage', 'photos', photoPath)).catch(
        () => {}
      )
    )
    student.trackingNotes = 'Anotação manual que deve ser preservada.'
    await student.save()
    const guardians = await Guardian.query().where('student_id', student.id)
    await writeFile(file, await makeStudentPdf({ photo: false }))
    const second = await client.post(`${API}/imports/students`).loginAs(admin).file('file', file)
    second.assertStatus(201)
    assert.isFalse(second.body().already_imported)
    assert.equal(second.body().created, 0)
    assert.equal(second.body().photos_saved, 0)
    assert.isTrue(second.body().rows[0].has_photo)
    await student.refresh()
    assert.equal(student.photoPath, photoPath)
    assert.equal(student.trackingNotes, 'Anotação manual que deve ser preservada.')
    assert.lengthOf(await Guardian.query().where('student_id', student.id), guardians.length)
    assert.lengthOf(await db.from('student_import_entries').where('student_id', student.id), 2)
  })
})
