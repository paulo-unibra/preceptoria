import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import { errors } from '@adonisjs/auth'

/**
 * Autentica a requisição (token de acesso) e bloqueia usuários desativados.
 */
export default class AuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    await ctx.auth.authenticateUsing(options.guards)
    if (!ctx.auth.user!.isActive) {
      throw new errors.E_UNAUTHORIZED_ACCESS('Usuário desativado.', {
        guardDriverName: 'access_tokens',
      })
    }
    return next()
  }
}
