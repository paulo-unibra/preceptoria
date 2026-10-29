import { test } from '@japa/runner'

test.group('Páginas públicas', () => {
  test('política de privacidade é pública, em HTML e menciona a LGPD', async ({
    client,
    assert,
  }) => {
    const res = await client.get('/privacidade')
    res.assertStatus(200)
    assert.include(res.header('content-type'), 'text/html')
    assert.include(res.text(), 'Política de Privacidade')
    assert.include(res.text(), 'LGPD')
  })

  test('página de exclusão de conta é pública e explica como pedir a exclusão', async ({
    client,
    assert,
  }) => {
    const res = await client.get('/exclusao-de-conta')
    res.assertStatus(200)
    assert.include(res.header('content-type'), 'text/html')
    assert.include(res.text(), 'Exclusão de conta e dados')
    assert.include(res.text(), 'Preceptoria')
    assert.include(res.text(), 'mailto:')
    assert.include(res.text(), '15 dias')
  })

  test('política de privacidade aponta para a página de exclusão', async ({ client, assert }) => {
    const res = await client.get('/privacidade')
    assert.include(res.text(), '/exclusao-de-conta')
  })
})
