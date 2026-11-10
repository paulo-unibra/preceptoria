import { test } from '@japa/runner'
import {
  classroomFromFilename,
  classroomKey,
  normalizedDate,
  parseStudentPdf,
  profileValue,
} from '#services/student_pdf_parser'
import { makeStudentPdf } from '#tests/fixtures/student_pdf'

test.group('Leitura de fichas SGGE em PDF', () => {
  test('identifica a turma no sufixo e normaliza grafias equivalentes', ({ assert }) => {
    assert.equal(classroomFromFilename('FICHA DO ESTUDANTE_9° ANO A.pdf'), '9º ANO A')
    assert.equal(classroomFromFilename('fichas_9º ano a.pdf'), '9º ANO A')
    assert.equal(classroomKey('9º ANO A'), classroomKey('9° A'))
    assert.throws(() => classroomFromFilename('arquivo.pdf'), 'Não foi possível identificar')
  })
  test('não converte datas sentinela nem datas impossíveis', ({ assert }) => {
    assert.isNull(normalizedDate('01/01/0001'))
    assert.isNull(normalizedDate('31/02/2012'))
    assert.equal(normalizedDate('29/02/2012'), '2012-02-29')
  })
  test('separa campos por coluna, mantém vazios, identifica checkboxes e extrai somente retrato', async ({
    assert,
  }) => {
    const parsed = await parseStudentPdf(
      await makeStudentPdf({ registration: '900000000001' }),
      'FICHAS_9° ANO A.pdf'
    )
    assert.lengthOf(parsed.students, 1)
    const student = parsed.students[0]
    assert.equal(parsed.schoolYear, 2026)
    assert.equal(student.fullName, 'ALUNA DE TESTE')
    assert.equal(student.birthDate, '2012-05-15')
    assert.isNotNull(student.photo)
    assert.equal(student.photo!.subarray(0, 2).toString('hex'), 'ffd8')
    assert.isNull(profileValue(student.profile, 'identification', 'nome_social'))
    assert.isNull(profileValue(student.profile, 'documents', 'cpf'))
    assert.equal(profileValue(student.profile, 'documents', 'nis'), '12345678900')
    assert.equal(profileValue(student.profile, 'mother', 'nome'), 'RESPONSAVEL DE TESTE')
    assert.equal(profileValue(student.profile, 'father', 'nome'), 'PAI DE TESTE')
    assert.isTrue(
      profileValue(
        student.profile,
        'special_education',
        'o_estudante_e_publico_alvo_da_educacao_especial'
      )
    )
    assert.equal(profileValue(student.profile, 'additional', 'uniform_item'), 'CAMISA')
    assert.equal(
      profileValue(student.profile, 'schooling', 'previous_school'),
      'ESCOLA ANTERIOR DE TESTE'
    )
    assert.deepEqual(student.profile.source.pages, [1, 2, 3])
    assert.isAbove(student.profile.warnings.length, 0)
  }).timeout(15000)
  test('ficha sem retrato permanece sem foto e não usa brasões como substituto', async ({
    assert,
  }) => {
    const parsed = await parseStudentPdf(
      await makeStudentPdf({ registration: '900000000001', photo: false }),
      'FICHAS_9º ANO A.pdf'
    )
    assert.isNull(parsed.students[0].photo)
  }).timeout(15000)
  test('brasão de alta resolução é ignorado sem impedir a extração do retrato', async ({
    assert,
  }) => {
    const parsed = await parseStudentPdf(
      await makeStudentPdf({ largeLogo: true }),
      'FICHAS_9º ANO A.pdf'
    )
    assert.isNotNull(parsed.students[0].photo)
    assert.isFalse(parsed.students[0].profile.warnings.some((warning) => warning.includes('foto')))
  }).timeout(15000)
  test('rejeita ficha incompleta e matrículas repetidas', async ({ assert }) => {
    await assert.rejects(() => parseStudentPdf(Buffer.from('not a pdf'), 'FICHAS_9º ANO A.pdf'))
    const incomplete = await makeStudentPdf({ registration: '900000000001', complete: false })
    await assert.rejects(() => parseStudentPdf(incomplete, 'FICHAS_9º ANO A.pdf'), /incompleta/)
    const repeated = await makeStudentPdf({ registration: '900000000002', second: true })
    await assert.rejects(
      () => parseStudentPdf(repeated, 'FICHAS_9º ANO A.pdf'),
      /matrículas repetidas/
    )
  }).timeout(15000)
})
