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
})
