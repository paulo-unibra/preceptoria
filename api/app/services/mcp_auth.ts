import { createRemoteJWKSet, jwtVerify } from 'jose'
import env from '#start/env'
import User from '#models/user'

export const MCP_READ = 'preceptoria:read'
export const MCP_WRITE = 'preceptoria:write'

function secureUrl(value: string) {
  const url = new URL(value)
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(env.get('NODE_ENV') === 'test' && url.protocol === 'http:' && url.hostname === '127.0.0.1'))
  )
    throw new Error('Use URLs HTTPS canônicas na configuração do MCP.')
  return url
}

export function makeMcpAuth(config: {
  resource: string
  issuer: string
  jwks: string
  links: string
}) {
  const url = secureUrl(config.resource)
  if (url.href !== config.resource || url.pathname !== '/mcp') {
    throw new Error('MCP_PUBLIC_URL deve ser a URL canônica do endpoint /mcp.')
  }
  secureUrl(config.issuer)
  const keys = createRemoteJWKSet(secureUrl(config.jwks))
  const input: unknown = JSON.parse(config.links)
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('MCP_USER_LINKS deve mapear cada sub OAuth ao ID de um usuário.')
  }
  const links = new Map<string, number>()
  for (const [subject, id] of Object.entries(input)) {
    if (!subject.trim() || !Number.isSafeInteger(id) || id <= 0) {
      throw new Error('Vínculo inválido em MCP_USER_LINKS.')
    }
    links.set(subject, id)
  }
  const metadataUrl = new URL('/.well-known/oauth-protected-resource/mcp', url).href
  return {
    url,
    metadata: {
      resource: url.href,
      authorization_servers: [config.issuer],
      scopes_supported: [MCP_READ, MCP_WRITE],
      bearer_methods_supported: ['header'],
    },
    challenge(scope: string, error?: 'invalid_token' | 'insufficient_scope') {
      return `Bearer resource_metadata="${metadataUrl}", scope="${scope}"${error ? `, error="${error}"` : ''}`
    },
    async authenticate(header?: string) {
      const token = header?.match(/^Bearer ([^\s,]+)$/i)?.[1]
      if (!token || token.length > 16384) return null
      let verified
      try {
        verified = await jwtVerify(token, keys, {
          issuer: config.issuer,
          audience: url.href,
          algorithms: ['RS256', 'ES256'],
          requiredClaims: ['sub', 'exp'],
        })
      } catch {
        return null
      }
      const { payload } = verified
      const id = typeof payload.sub === 'string' ? links.get(payload.sub) : undefined
      if (!id) return null
      const user = await User.find(id)
      if (!user?.isActive) return null
      const scopes = new Set(typeof payload.scope === 'string' ? payload.scope.split(/\s+/) : [])
      return { user, scopes }
    },
  }
}

export function loadMcpAuth() {
  const resource = env.get('MCP_PUBLIC_URL')
  if (!resource) return null
  const issuer = env.get('MCP_OAUTH_ISSUER')
  const jwks = env.get('MCP_OAUTH_JWKS_URL')
  const links = env.get('MCP_USER_LINKS')
  if (!issuer || !jwks || !links) throw new Error('Configuração OAuth do MCP incompleta.')
  return makeMcpAuth({ resource, issuer, jwks, links })
}
