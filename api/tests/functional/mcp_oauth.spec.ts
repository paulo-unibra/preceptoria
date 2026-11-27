import { createHash, randomBytes } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import env from '#start/env'
import { makeUser } from '#tests/helpers'

test.group('OAuth próprio do MCP', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('exige consentimento e PKCE, valida o cliente, rotaciona e revoga o acesso', async ({
    client,
    assert,
  }) => {
    const admin = await makeUser('admin')
    const unlisted = await makeUser('admin')
    const issuer = 'https://mcp-autorizacao.exemplo.test'
    const resource = `${issuer}/mcp`
    const url = '/admin/acesso-personalizado'
    const before = env.get('MCP_PUBLIC_URL')
    env.set('MCP_PUBLIC_URL', resource)
    env.set('MCP_FIRST_PARTY_USERS', String(admin.id))
    try {
      const verifier = randomBytes(32).toString('base64url')
      const query = {
        client_id: 'https://chatgpt.com/oauth/client.json',
        redirect_uri: 'https://chatgpt.com/connector_platform_oauth_redirect',
        state: 'estado-do-chatgpt',
        scope: 'preceptoria:read preceptoria:write',
        resource,
        response_type: 'code',
        code_challenge_method: 'S256',
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      }
      const discovery = await client.get('/.well-known/oauth-authorization-server')
      discovery.assertBodyContains({ issuer, code_challenge_methods_supported: ['S256'] })
      const metadata = await client.get('/.well-known/oauth-protected-resource/mcp')
      metadata.assertStatus(200)
      metadata.assertBodyContains({ resource, authorization_servers: [issuer] })
      const fallback = await client.get('/.well-known/oauth-protected-resource')
      fallback.assertStatus(200)
      fallback.assertBody(metadata.body())
      const invalid = await client
        .get(url)
        .qs({ ...query, redirect_uri: 'https://exemplo.test/redirect' })
      invalid.assertStatus(400)
      assert.notProperty(invalid.headers(), 'location')
      const browser = async () => {
        const page = await client.get(url).qs(query)
        page.assertStatus(200)
        assert.include(page.text(), 'Aceitar e continuar')
        return {
          ticket: page.text().match(/name="ticket" value="([^"]+)"/)![1],
          cookie: String([page.headers()['set-cookie']].flat()[0]).split(';')[0],
        }
      }
      const approve = (
        session: Awaited<ReturnType<typeof browser>>,
        email: string,
        decision = 'allow'
      ) =>
        client
          .post(url)
          .redirects(0)
          .header('Origin', issuer)
          .header('Cookie', session.cookie)
          .form({ ticket: session.ticket, decision, email, password: 'senha-segura-123' })
      const session = await browser()
      const csrf = await client
        .post(url)
        .header('Origin', issuer)
        .form({ ticket: session.ticket, decision: 'allow' })
      csrf.assertStatus(400)
      const refused = await approve(session, unlisted.email)
      refused.assertStatus(401)
      const cancelled = await approve(await browser(), admin.email, 'deny')
      cancelled.assertStatus(303)
      assert.equal(new URL(cancelled.headers().location).searchParams.get('error'), 'access_denied')
      const consent = await approve(session, admin.email)
      consent.assertStatus(303)
      const callback = new URL(consent.headers().location)
      assert.equal(callback.searchParams.get('state'), query.state)
      assert.equal(callback.searchParams.get('iss'), issuer)
      const code = callback.searchParams.get('code')!
      assert.isTrue(Boolean(code))
      ;(await approve(session, admin.email)).assertStatus(400)
      const tokenArgs = {
        client_id: query.client_id,
        redirect_uri: query.redirect_uri,
        resource,
        code,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }
      ;(
        await client
          .post('/oauth/token')
          .form({ ...tokenArgs, code_verifier: randomBytes(32).toString('base64url') })
      ).assertStatus(400)
      ;(
        await client
          .post('/oauth/token')
          .form({ ...tokenArgs, resource: 'https://exemplo.test/mcp' })
      ).assertStatus(400)
      const token = await client.post('/oauth/token').form(tokenArgs)
      token.assertStatus(200)
      ;(await client.post('/oauth/token').form(tokenArgs)).assertStatus(400)
      const call = (value: string) =>
        client
          .post('/mcp')
          .bearerToken(value)
          .header('Accept', 'application/json, text/event-stream')
          .json({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'listar_turmas', arguments: { school_year: 2026 } },
          })
      assert.property((await call(token.body().access_token)).body().result, 'structuredContent')
      const refreshArgs = {
        client_id: query.client_id,
        grant_type: 'refresh_token',
        refresh_token: token.body().refresh_token,
        resource,
      }
      const refreshed = await client.post('/oauth/token').form(refreshArgs)
      refreshed.assertStatus(200)
      ;(await client.post('/oauth/token').form(refreshArgs)).assertStatus(400)
      ;(await call(token.body().access_token)).assertStatus(401)
      ;(
        await client
          .post('/oauth/revoke')
          .form({ client_id: query.client_id, token: refreshed.body().refresh_token })
      ).assertStatus(200)
      ;(await call(refreshed.body().access_token)).assertStatus(401)
    } finally {
      env.set('MCP_FIRST_PARTY_USERS', '')
      env.set('MCP_PUBLIC_URL', before ?? '')
    }
  })
})
