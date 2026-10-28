import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import { errors as authErrors } from '@adonisjs/auth'
import { errors as limiterErrors } from '@adonisjs/limiter'
import { errors as lucidErrors } from '@adonisjs/lucid'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  /**
   * Todas as respostas de erro seguem o formato `{ errors: [{ message, code?, field? }] }`,
   * em português, para o app exibir sem tratar caso a caso.
   */
  async handle(error: unknown, ctx: HttpContext) {
    const send = (status: number, message: string, code: string) =>
      ctx.response.status(status).send({ errors: [{ message, code }] })

    if (error instanceof lucidErrors.E_ROW_NOT_FOUND)
      return send(404, 'Registro não encontrado.', 'E_NOT_FOUND')
    if (error instanceof authErrors.E_INVALID_CREDENTIALS)
      return send(401, 'E-mail ou senha inválidos.', 'E_INVALID_CREDENTIALS')
    if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS)
      return send(401, 'Autenticação necessária.', 'E_UNAUTHORIZED')
    if (error instanceof limiterErrors.E_TOO_MANY_REQUESTS) {
      return send(
        429,
        'Muitas tentativas. Aguarde um pouco e tente novamente.',
        'E_TOO_MANY_REQUESTS'
      )
    }
    if (
      error instanceof Exception &&
      error.status &&
      error.status < 500 &&
      error.code?.startsWith('E_') &&
      error.code !== 'E_VALIDATION_ERROR'
    ) {
      return send(error.status, error.message, error.code)
    }
    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
