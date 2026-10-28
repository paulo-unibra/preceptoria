import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { API, makeClassroom, makeUser } from '#tests/helpers'

test.group('Autenticação e perfis (RF-01)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('login válido devolve token e usuário (sem senha)', async ({ client, assert }) => {
    const user = await makeUser('preceptor')
    const res = await client
      .post(`${API}/auth/login`)
      .json({ email: user.email, password: 'senha-segura-123' })
    res.assertStatus(200)
    assert.isString(res.body().token)
    assert.equal(res.body().user.email, user.email)
    assert.notProperty(res.body().user, 'password')
  })

  test('senha errada retorna 401 em português', async ({ client, assert }) => {
    const user = await makeUser('preceptor')
    const res = await client
      .post(`${API}/auth/login`)
      .json({ email: user.email, password: 'errada' })
    res.assertStatus(401)
    assert.equal(res.body().errors[0].message, 'E-mail ou senha inválidos.')
  })

  test('usuário desativado não consegue entrar', async ({ client }) => {
    const user = await makeUser('preceptor', [], { isActive: false })
    const res = await client
      .post(`${API}/auth/login`)
      .json({ email: user.email, password: 'senha-segura-123' })
    res.assertStatus(401)
  })

  test('rotas protegidas exigem token', async ({ client }) => {
    const res = await client.get(`${API}/students`)
    res.assertStatus(401)
  })

  test('usuário desativado depois do login perde o acesso imediatamente', async ({ client }) => {
    const user = await makeUser('preceptor')
    user.isActive = false
    await user.save()
    const res = await client.get(`${API}/auth/me`).loginAs(user)
    res.assertStatus(401)
  })

  test('preceptor não acessa rotas de administração', async ({ client }) => {
    const preceptor = await makeUser('preceptor')
    const res = await client.get(`${API}/users`).loginAs(preceptor)
    res.assertStatus(403)
  })

  test('administrador cria usuário e vincula turmas', async ({ client, assert }) => {
    const admin = await makeUser('admin')
    const classroom = await makeClassroom()
    const res = await client
      .post(`${API}/users`)
      .loginAs(admin)
      .json({
        full_name: 'Maria Preceptora',
        email: 'Maria@Escola.com',
        password: 'senha-segura-123',
        role: 'preceptor',
        classroom_ids: [classroom.id],
      })
    res.assertStatus(201)
    assert.equal(res.body().user.email, 'maria@escola.com')
    assert.lengthOf(res.body().user.classrooms, 1)
  })

  test('e-mail duplicado é recusado', async ({ client }) => {
    const admin = await makeUser('admin')
    const other = await makeUser('preceptor')
    const res = await client.post(`${API}/users`).loginAs(admin).json({
      full_name: 'Duplicado',
      email: other.email,
      password: 'senha-segura-123',
      role: 'preceptor',
    })
    res.assertStatus(422)
  })

  test('troca de senha exige a senha atual', async ({ client }) => {
    const user = await makeUser('preceptor')
    const wrong = await client.put(`${API}/auth/password`).loginAs(user).json({
      current_password: 'errada',
      password: 'nova-senha-123',
      password_confirmation: 'nova-senha-123',
    })
    wrong.assertStatus(422)
    const ok = await client.put(`${API}/auth/password`).loginAs(user).json({
      current_password: 'senha-segura-123',
      password: 'nova-senha-123',
      password_confirmation: 'nova-senha-123',
    })
    ok.assertStatus(200)
  })
})
