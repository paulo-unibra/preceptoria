import type { HttpContext } from '@adonisjs/core/http'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { loadMcpAuth, MCP_READ } from '#services/mcp_auth'
import { createPreceptoriaMcp } from '#services/preceptoria_mcp'
import env from '#start/env'

let auth: ReturnType<typeof loadMcpAuth>
let key: string | undefined
function mcpAuth() {
  const next = JSON.stringify([env.get('MCP_PUBLIC_URL'), env.get('MCP_FIRST_PARTY_USERS')])
  if (key !== next) {
    auth = loadMcpAuth()
    key = next
  }
  return auth
}

export default class McpController {
  metadata({ response }: HttpContext) {
    const config = mcpAuth()
    if (!config) return response.notFound()
    return config.metadata
  }

  async handle(ctx: HttpContext) {
    const { request, response } = ctx
    const config = mcpAuth()
    if (!config) return response.notFound()

    response.header('Cache-Control', 'no-store')
    const origin = request.header('origin')
    if (origin && ![config.url.origin, 'https://chatgpt.com'].includes(origin)) {
      return response.forbidden()
    }
    if (request.method() !== 'POST') {
      return response.header('Allow', 'POST').status(405).send(null)
    }

    const authorization = request.header('authorization')
    const identity = await config.authenticate(authorization)
    if (authorization && !identity) {
      return response
        .header('WWW-Authenticate', config.challenge(MCP_READ, 'invalid_token'))
        .unauthorized()
    }
    ctx.mcpActorId = identity?.user.id

    const server = createPreceptoriaMcp(identity, config.challenge)
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true })
    try {
      await server.connect(transport)
      const headers = new Headers()
      for (const name of ['accept', 'content-type', 'mcp-protocol-version']) {
        const value = request.header(name)
        if (value) headers.set(name, value)
      }
      const result = await transport.handleRequest(
        new Request(config.url, { method: 'POST', headers }),
        {
          parsedBody: request.body(),
        }
      )
      result.headers.forEach((value, name) => response.header(name, value))
      response.status(result.status)
      return response.send(result.body ? Buffer.from(await result.arrayBuffer()) : null)
    } finally {
      await server.close()
    }
  }
}
