import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { UserRole } from '#models/user'
import { forbidden } from '#services/classroom_access'

/** Uso: `.use(middleware.role({ roles: ['admin'] }))` — deve vir depois de `auth`. */
export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { roles: UserRole[] }) {
    if (!options.roles.includes(ctx.auth.user!.role)) throw forbidden()
    return next()
  }
}
