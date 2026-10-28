import type { HttpContext } from '@adonisjs/core/http'
import { errors } from '@adonisjs/auth'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import { changePasswordValidator, loginValidator } from '#validators/auth'

export default class AuthController {
  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    const user = await User.verifyCredentials(email, password)
    if (!user.isActive) throw new errors.E_INVALID_CREDENTIALS('Usuário desativado.')

    const token = await User.accessTokens.create(user)
    await user.load('classrooms')
    return response.ok({
      type: 'bearer',
      token: token.value!.release(),
      expires_at: token.expiresAt,
      user,
    })
  }

  async logout({ auth, response }: HttpContext) {
    const user = auth.user!
    const token = user.currentAccessToken
    await User.accessTokens.delete(user, token.identifier)
    return response.noContent()
  }

  async me({ auth }: HttpContext) {
    const user = auth.user!
    await user.load('classrooms')
    return { user }
  }

  async changePassword({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { current_password, password } = await request.validateUsing(changePasswordValidator)
    if (!(await hash.verify(user.password, current_password))) {
      return response.unprocessableEntity({
        errors: [
          {
            field: 'current_password',
            message: 'A senha atual está incorreta.',
            code: 'E_WRONG_PASSWORD',
          },
        ],
      })
    }
    user.password = password
    await user.save()
    // Encerra as demais sessões; mantém a atual.
    const tokens = await User.accessTokens.all(user)
    for (const t of tokens)
      if (t.identifier !== user.currentAccessToken.identifier)
        await User.accessTokens.delete(user, t.identifier)
    return response.ok({ message: 'Senha alterada com sucesso.' })
  }
}
