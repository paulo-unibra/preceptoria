import { Exception } from '@adonisjs/core/exceptions'

/** Regra de negócio violada (422), com mensagem em português para o usuário. */
export function invalid(message: string, code = 'E_INVALID_DATA') {
  return new Exception(message, { status: 422, code })
}

export function conflict(message: string, code = 'E_CONFLICT') {
  return new Exception(message, { status: 409, code })
}
