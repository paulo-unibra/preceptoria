import type { HttpContext } from '@adonisjs/core/http'
import encryption from '@adonisjs/core/services/encryption'
import { errors } from '@adonisjs/auth'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import User from '#models/user'
import { loadPreceptoriaOAuth, MCP_WRITE } from '#services/mcp_auth'

const path = '/admin/acesso-personalizado'
const cookie = '__Host-preceptoria-conexao'
const purpose = 'preceptoria-mcp-consent'
const cookieOptions = { path: '/', sameSite: 'lax' as const, httpOnly: true, secure: true }
const formSchema = z.object({
  nonce: z.string().length(43),
  state: z.string().max(1024),
  challenge: z.string().length(43),
  scope: z.string().max(80),
})
const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
})

function form(ctx: HttpContext, ticket: string, scope: string, message = '') {
  return ctx.response.type('html')
    .send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acesso personalizado · Preceptoria</title>
<style>body{margin:0;background:#f3f6fc;color:#141b47;font:1rem/1.5 system-ui,sans-serif}main{max-width:28rem;margin:4rem auto;padding:1.75rem;background:white;border-radius:1rem;box-shadow:0 4px 24px #141b4718}label{display:block;margin-top:1rem;font-weight:600}input:not([type=hidden]){box-sizing:border-box;width:100%;padding:.65rem;border:1px solid #a0a9c1;border-radius:.4rem;font:inherit}button{font:inherit;padding:.65rem .9rem;border-radius:.4rem;cursor:pointer;border:1px solid #141b47;background:white;color:#141b47}button:first-of-type{background:#141b47;color:white}footer{margin-top:1.25rem;display:flex;flex-wrap:wrap;gap:.5rem}aside{color:#861d20}</style>
<main><small>PRECEPTORIA · ACESSO PERSONALIZADO</small><h1>Conectar ao ChatGPT</h1><p>Entre com sua conta da Preceptoria para autorizar o ChatGPT a acessar os registros escolares permitidos pelo seu perfil e pelas suas turmas.</p><ul>${scope.includes('preceptoria:read') ? '<li>Consultar registros escolares.</li>' : ''}${scope.includes(MCP_WRITE) ? '<li>Cadastrar e corrigir registros em seu nome.</li>' : ''}</ul>
${message ? `<aside role="alert">${message}</aside>` : ''}<form method="post" action="${path}"><input type="hidden" name="ticket" value="${ticket}"><label for="email">E-mail da Preceptoria</label><input id="email" name="email" type="email" autocomplete="username" required maxlength="254"><label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><footer><button name="decision" value="allow">Aceitar e continuar</button><button name="decision" value="deny" formnovalidate>Cancelar</button></footer></form><p><a href="/privacidade" target="_blank" rel="noopener noreferrer">Política de privacidade</a></p></main></html>`)
}

function protect({ response }: HttpContext) {
  response.header('Cache-Control', 'no-store')
  response.header('Referrer-Policy', 'same-origin')
  response.header('X-Frame-Options', 'DENY')
  response.header('X-Content-Type-Options', 'nosniff')
  response.header(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://chatgpt.com; frame-ancestors 'none'; base-uri 'none'"
  )
}

function formEncoded(ctx: HttpContext) {
  return (
    ctx.request.header('content-type')?.split(';')[0].trim().toLowerCase() ===
    'application/x-www-form-urlencoded'
  )
}

export default class McpOauthController {
  metadata({ response }: HttpContext) {
    const oauth = loadPreceptoriaOAuth()
    return oauth?.discovery ?? response.notFound()
  }

  authorize(ctx: HttpContext) {
    const oauth = loadPreceptoriaOAuth()
    if (!oauth) return ctx.response.notFound()
    protect(ctx)
    const grant = oauth.authorization(ctx.request.qs())
    if (!grant)
      return ctx.response.badRequest(
        'Solicitação de conexão inválida. Inicie a conexão pelo ChatGPT.'
      )
    const nonce = randomBytes(32).toString('base64url')
    ctx.response.cookie(cookie, nonce, { ...cookieOptions, maxAge: '5 minutes' })
    const ticket = encryption.encrypt({ ...grant, nonce }, '5 minutes', purpose)
    return form(ctx, ticket, grant.scope)
  }

  async consent(ctx: HttpContext) {
    const { request, response } = ctx
    const oauth = loadPreceptoriaOAuth()
    if (!oauth) return response.notFound()
    protect(ctx)
    if (!formEncoded(ctx) || request.header('origin') !== oauth.issuer) return response.forbidden()
    const { ticket, decision } = request.body()
    if (
      typeof ticket !== 'string' ||
      ticket.length > 4096 ||
      !/^[A-Za-z0-9._~+\-/=]+$/.test(ticket)
    )
      return response.badRequest()
    const parsed = formSchema.safeParse(encryption.decrypt(ticket, purpose))
    if (!parsed.success || parsed.data.nonce !== request.cookie(cookie)) {
      return response.badRequest('A autorização expirou. Inicie a conexão pelo ChatGPT novamente.')
    }
    const grant = parsed.data
    function redirect(result: { code: string } | { error: 'access_denied' }) {
      response.clearCookie(cookie, cookieOptions)
      return response.header('Location', oauth!.redirect(grant, result)).status(303).send(null)
    }
    if (decision === 'deny') return redirect({ error: 'access_denied' })
    if (decision !== 'allow') return response.badRequest()
    const input = credentials.safeParse(request.body())
    if (input.success) {
      let user: User | undefined
      try {
        user = await User.verifyCredentials(input.data.email, input.data.password)
      } catch (error) {
        if (!(error instanceof errors.E_INVALID_CREDENTIALS)) throw error
      }
      if (user && oauth.permits(user, grant.scope)) {
        const code = await oauth.issueCode(grant, grant.nonce, user)
        if (code) return redirect({ code })
        return response.badRequest('Solicitação já usada. Inicie uma nova conexão pelo ChatGPT.')
      }
    }
    response.status(401)
    return form(
      ctx,
      ticket,
      grant.scope,
      'Login inválido ou conta sem permissão para conectar ao ChatGPT.'
    )
  }

  async token(ctx: HttpContext) {
    const oauth = loadPreceptoriaOAuth()
    if (!oauth) return ctx.response.notFound()
    protect(ctx)
    ctx.response.header('Pragma', 'no-cache')
    if (!formEncoded(ctx) || ctx.request.header('authorization'))
      return ctx.response.badRequest({ error: 'invalid_request' })
    const result = await oauth.exchange(ctx.request.body())
    return 'error' in result ? ctx.response.badRequest(result) : ctx.response.ok(result)
  }

  async revoke(ctx: HttpContext) {
    const oauth = loadPreceptoriaOAuth()
    if (!oauth) return ctx.response.notFound()
    protect(ctx)
    if (!formEncoded(ctx) || ctx.request.header('authorization'))
      return ctx.response.badRequest({ error: 'invalid_request' })
    if (!(await oauth.revoke(ctx.request.body())))
      return ctx.response.badRequest({ error: 'invalid_client' })
    return ctx.response.ok(null)
  }

  async disconnect({ auth, response }: HttpContext) {
    const oauth = loadPreceptoriaOAuth()
    if (!oauth) return response.notFound()
    await oauth.revokeUser(auth.user!.id)
    return response.noContent()
  }
}
