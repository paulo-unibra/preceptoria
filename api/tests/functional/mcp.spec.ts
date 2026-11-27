import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import env from '#start/env'
import AuditLog from '#models/audit_log'
import StudentObservation from '#models/student_observation'
import { makeClassroom, makeStudent, makeUser, seedRaCodes, today } from '#tests/helpers'

test.group('MCP de preceptoria', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('negocia o protocolo e aplica OAuth, escopo por turma, perfil e auditoria', async ({
    client,
    assert,
  }) => {
    const turma = await makeClassroom()
    const outra = await makeClassroom()
    const aluno = await makeStudent(turma)
    const outro = await makeStudent(outra)
    const autor = await makeUser('preceptor', [turma])
    const coord = await makeUser('coordenacao', [turma])
    const colega = await makeUser('preceptor', [turma])
    const desativado = await makeUser('preceptor', [turma], { isActive: false })
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true })
    const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'RS256' }
    const keyServer = createServer((_req, res) =>
      res.setHeader('Content-Type', 'application/json').end(JSON.stringify({ keys: [jwk] }))
    )
    await new Promise<void>((resolve) => keyServer.listen(0, '127.0.0.1', resolve))
    try {
      const issuer = `http://127.0.0.1:${(keyServer.address() as AddressInfo).port}`
      const resource = 'https://mcp.exemplo.test/mcp'
      env.set('MCP_PUBLIC_URL', resource)
      env.set('MCP_OAUTH_ISSUER', issuer)
      env.set('MCP_OAUTH_JWKS_URL', `${issuer}/jwks`)
      env.set(
        'MCP_USER_LINKS',
        JSON.stringify({
          autor: autor.id,
          coord: coord.id,
          colega: colega.id,
          desativado: desativado.id,
        })
      )
      const token = (sub: string, scope: string, aud = resource, expiry = '5m', iss = issuer) =>
        new SignJWT({ scope })
          .setProtectedHeader({ alg: 'RS256', kid: 'test' })
          .setIssuer(iss)
          .setAudience(aud)
          .setSubject(sub)
          .setExpirationTime(expiry)
          .sign(privateKey)
      const reader = await token('autor', 'preceptoria:read')
      const writer = await token('autor', 'preceptoria:read preceptoria:write')
      const rpc = (method: string, params: object, auth?: string) => {
        const req = client
          .post('/mcp')
          .json({ jsonrpc: '2.0', id: 1, method, params })
          .header('Accept', 'application/json, text/event-stream')
        return auth ? req.bearerToken(auth) : req
      }
      const call = (name: string, args: object, auth?: string) =>
        rpc('tools/call', { name, arguments: args }, auth)

      const meta = await client.get('/.well-known/oauth-protected-resource/mcp')
      meta.assertStatus(200)
      assert.equal(meta.body().resource, resource)
      const init = await rpc('initialize', {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      })
      init.assertStatus(200)
      assert.equal(init.body().result.serverInfo.name, 'preceptoria')
      const listing = await rpc('tools/list', {})
      assert.isTrue(
        listing
          .body()
          .result.tools.some((tool: { name: string }) => tool.name === 'salvar_frequencia')
      )
      const anon = await call('listar_turmas', { school_year: 2026 })
      assert.isTrue(anon.body().result.isError)
      assert.include(anon.body().result._meta['mcp/www_authenticate'][0], 'resource_metadata=')
      for (const rejected of [
        await token('autor', 'preceptoria:read', 'https://outro.exemplo.test/mcp'),
        await token('autor', 'preceptoria:read', resource, '5m', 'https://outro.exemplo.test'),
        await token('autor', 'preceptoria:read', resource, '-5m'),
        await token('desativado', 'preceptoria:read'),
        await token('sem-vinculo', 'preceptoria:read'),
      ]) {
        const response = await call('listar_turmas', { school_year: 2026 }, rejected)
        response.assertStatus(401)
      }
      const ok = await call('buscar_estudantes', { classroom_id: turma.id }, reader)
      assert.deepEqual(ok.body().result.structuredContent.estudantes, [
        { id: aluno.id, nome: aluno.fullName },
      ])
      assert.isTrue(
        (await call('buscar_estudantes', { classroom_id: outra.id }, reader)).body().result.isError
      )

      const args = {
        student_id: aluno.id,
        observed_on: today(),
        content: 'Atividade realizada durante a aula.',
      }
      const wrongScope = await call('cadastrar_observacao', args, reader)
      assert.include(
        wrongScope.body().result._meta['mcp/www_authenticate'][0],
        'insufficient_scope'
      )
      const coordinator = await call(
        'cadastrar_observacao',
        args,
        await token('coord', 'preceptoria:write')
      )
      assert.isTrue(coordinator.body().result.isError)
      assert.isTrue(
        (await call('cadastrar_observacao', { ...args, student_id: outro.id }, writer)).body()
          .result.isError
      )
      const created = await call('cadastrar_observacao', args, writer)
      const observation = await StudentObservation.findOrFail(
        created.body().result.structuredContent.id
      )
      assert.equal(observation.createdBy, autor.id)
      const edit = { id: observation.id, content: 'Atividade concluída no final da aula.' }
      assert.isTrue(
        (await call('editar_observacao', edit, await token('colega', 'preceptoria:write'))).body()
          .result.isError
      )
      const updated = await call('editar_observacao', edit, writer)
      assert.equal(updated.body().result.structuredContent.id, observation.id)
      assert.equal(
        (
          await AuditLog.query()
            .where({ entity: 'student_observations', entity_id: observation.id, action: 'update' })
            .firstOrFail()
        ).userId,
        autor.id
      )

      const daily = { classroom_id: turma.id, date: today(), student_id: aluno.id }
      const missing = await call('consultar_registros_do_dia', daily, reader)
      assert.isNull(missing.body().result.structuredContent.frequencia)
      const { student_id, ...day } = daily
      const freq = { ...day, start_time: '07:30', records: [{ student_id, status: 'present' }] }
      const saved = await call('salvar_frequencia', freq, writer)
      assert.equal(saved.body().result.structuredContent.data[0].status, 'present')
      const corrected = await call(
        'salvar_frequencia',
        { ...freq, records: [{ student_id, status: 'late' }] },
        writer
      )
      assert.equal(corrected.body().result.structuredContent.data[0].status, 'late')
      const checklist = await call(
        'salvar_fardamento',
        {
          ...day,
          records: [{ student_id, uniform_status: 'not_observed', footwear_status: 'inadequate' }],
        },
        writer
      )
      assert.equal(checklist.body().result.structuredContent.data[0].footwear_status, 'inadequate')
      const history = await call(
        'consultar_historico',
        { classroom_id: turma.id, student_id, from: today(), to: today() },
        reader
      )
      assert.equal(history.body().result.structuredContent.totals.attendance.late, 1)
      assert.equal(history.body().result.structuredContent.totals.uniform.footwear_inadequate, 1)
      assert.equal(history.body().result.structuredContent.totals.occurrences.total, 0)

      await seedRaCodes()
      const createdRa = await call(
        'cadastrar_ra',
        { student_id, occurred_on: today(), description: 'Realizou a atividade.', ra_code: 2 },
        writer
      )
      const raId = createdRa.body().result.structuredContent.id
      const editedRa = await call(
        'editar_ra',
        { id: raId, changes: { description: 'Realizou a atividade de Artes.' } },
        writer
      )
      assert.equal(editedRa.body().result.structuredContent.id, raId)
      const historyRa = await call(
        'consultar_historico',
        { classroom_id: turma.id, student_id, from: today(), to: today(), tipo: 'occurrence' },
        reader
      )
      assert.equal(historyRa.body().result.structuredContent.totals.occurrences.positive, 1)
      assert.equal(
        historyRa.body().result.structuredContent.items[0].data.description,
        'Realizou a atividade de Artes.'
      )
    } finally {
      await new Promise<void>((resolve) => keyServer.close(() => resolve()))
    }
  })
})
