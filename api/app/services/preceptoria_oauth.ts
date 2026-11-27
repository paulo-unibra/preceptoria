import { createHash, randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'

const CLIENT = 'https://chatgpt.com/oauth/client.json'
const REDIRECT = 'https://chatgpt.com/connector_platform_oauth_redirect'
export const MCP_READ = 'preceptoria:read'
export const MCP_WRITE = 'preceptoria:write'
const SCOPES = [MCP_READ, MCP_WRITE]
const ACCESS_SECONDS = 15 * 60
const GRANT_MS = 30 * 24 * 60 * 60 * 1000
const CODE_MS = 2 * 60 * 1000
const table = 'mcp_grants'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const secret = () => randomBytes(32).toString('base64url')
const validSecret = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)

interface RequestGrant {
  state: string
  challenge: string
  scope: string
}

export function makePreceptoriaOAuth(url: URL, users: string) {
  if (!/^\d+(?:,\d+)*$/.test(users))
    throw new Error('MCP_FIRST_PARTY_USERS deve listar IDs separados por vírgula.')
  const allowed = new Set(users.split(',').map(Number))
  if ([...allowed].some((id) => !Number.isSafeInteger(id) || id < 1))
    throw new Error('ID inválido em MCP_FIRST_PARTY_USERS.')
  const issuer = url.origin
  const permits = (user: User, scope: string) =>
    allowed.has(user.id) &&
    user.isActive &&
    (user.role !== 'coordenacao' || !scope.split(' ').includes(MCP_WRITE))

  async function currentUser(row: { user_id: number; credential_version: string; scope: string }) {
    if (!allowed.has(row.user_id)) return null
    const user = await User.find(row.user_id)
    if (!user || !permits(user, row.scope) || hash(user.password) !== row.credential_version)
      return null
    return user
  }

  return {
    url,
    issuer,
    permits,
    discovery: {
      issuer,
      authorization_endpoint: `${issuer}/admin/acesso-personalizado`,
      token_endpoint: `${issuer}/oauth/token`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      scopes_supported: SCOPES,
    },
    authorization(query: Record<string, unknown>): RequestGrant | null {
      const { state, code_challenge: challenge } = query
      if (
        query.client_id !== CLIENT ||
        query.redirect_uri !== REDIRECT ||
        query.resource !== url.href ||
        query.response_type !== 'code' ||
        query.code_challenge_method !== 'S256' ||
        !validSecret(challenge) ||
        typeof state !== 'string' ||
        !state ||
        state.length > 1024 ||
        (query.response_mode !== undefined && query.response_mode !== 'query')
      )
        return null
      const scope =
        typeof query.scope === 'string' ? [...new Set(query.scope.trim().split(/\s+/))] : SCOPES
      if (!scope.length || scope.some((s) => !SCOPES.includes(s))) return null
      return { state, challenge, scope: scope.join(' ') }
    },
    redirect(grant: RequestGrant, response: { code: string } | { error: 'access_denied' }) {
      const callback = new URL(REDIRECT)
      callback.search = new URLSearchParams({
        ...response,
        state: grant.state,
        iss: issuer,
      }).toString()
      return callback.href
    },
    async issueCode(grant: RequestGrant, nonce: string, user: User) {
      const code = secret()
      await db.from(table).where('grant_until', '<=', Date.now()).delete()
      const inserted = await db
        .connection()
        .getWriteClient()(table)
        .insert({
          id: hash(nonce),
          user_id: user.id,
          credential_version: hash(user.password),
          resource: url.href,
          scope: grant.scope,
          challenge: grant.challenge,
          code_hash: hash(code),
          grant_until: Date.now() + CODE_MS,
        })
        .onConflict('id')
        .ignore()
        .returning('id')
      return inserted.length ? code : null
    },
    async exchange(body: Record<string, unknown>) {
      if (
        body.client_id !== CLIENT ||
        body.client_secret !== undefined ||
        body.client_assertion !== undefined
      )
        return { error: 'invalid_client' }
      const first = body.grant_type === 'authorization_code'
      if (!first && body.grant_type !== 'refresh_token') return { error: 'unsupported_grant_type' }
      if ((first || body.resource !== undefined) && body.resource !== url.href)
        return { error: 'invalid_target' }
      const value = first ? body.code : body.refresh_token
      if (!validSecret(value)) return { error: 'invalid_grant' }
      const field = first ? 'code_hash' : 'refresh_hash'
      const now = Date.now()
      const filter = { resource: url.href, [field]: hash(value) }
      if (first) {
        if (
          body.redirect_uri !== REDIRECT ||
          typeof body.code_verifier !== 'string' ||
          !/^[A-Za-z0-9._~-]{43,128}$/.test(body.code_verifier)
        )
          return { error: 'invalid_grant' }
        filter.challenge = createHash('sha256').update(body.code_verifier).digest('base64url')
      }
      const row = await db.from(table).where(filter).where('grant_until', '>', now).first()
      if (!row || !(await currentUser(row))) return { error: 'invalid_grant' }
      if (body.scope !== undefined && body.scope !== row.scope) return { error: 'invalid_scope' }
      const access = secret()
      const refresh = secret()
      const until = first ? now + GRANT_MS : Number(row.grant_until)
      const updated = await db
        .connection()
        .getWriteClient()(table)
        .where({ ...filter, id: row.id })
        .where('grant_until', '>', now)
        .update({
          code_hash: null,
          access_hash: hash(access),
          refresh_hash: hash(refresh),
          access_until: Math.min(until, now + ACCESS_SECONDS * 1000),
          grant_until: until,
        })
        .returning('id')
      return updated.length === 1
        ? {
            access_token: access,
            refresh_token: refresh,
            token_type: 'Bearer',
            scope: row.scope as string,
            expires_in: Math.floor(Math.min(ACCESS_SECONDS, (until - now) / 1000)),
          }
        : { error: 'invalid_grant' }
    },
    async authenticate(header?: string) {
      const token = header?.match(/^Bearer (\S+)$/i)?.[1]
      if (!validSecret(token)) return null
      const now = Date.now()
      const row = await db
        .from(table)
        .where({ resource: url.href, access_hash: hash(token) })
        .where('access_until', '>', now)
        .where('grant_until', '>', now)
        .first()
      const user = row && (await currentUser(row))
      return user ? { user, scopes: new Set<string>(row.scope.split(' ')) } : null
    },
    async revoke(body: Record<string, unknown>) {
      if (
        body.client_id !== CLIENT ||
        body.client_secret !== undefined ||
        body.client_assertion !== undefined
      )
        return false
      if (validSecret(body.token)) {
        const hashed = hash(body.token)
        await db
          .from(table)
          .where('resource', url.href)
          .where((q) => q.where('access_hash', hashed).orWhere('refresh_hash', hashed))
          .delete()
      }
      return true
    },
    async revokeUser(id: number) {
      await db.from(table).where({ user_id: id, resource: url.href }).delete()
    },
  }
}
