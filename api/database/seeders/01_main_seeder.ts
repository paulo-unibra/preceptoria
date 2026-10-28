import { randomBytes } from 'node:crypto'
import logger from '@adonisjs/core/services/logger'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import env from '#start/env'
import User from '#models/user'
import RaCode from '#models/ra_code'
import { polarityForCode, RA_MAX_CODE, RA_MIN_CODE } from '#support/ra'

/**
 * Dados mínimos para o sistema funcionar (idempotente): administrador inicial e tabela de códigos RA.
 */
export default class extends BaseSeeder {
  async run() {
    // Códigos RA 01–21. A descrição oficial (DP05) NÃO é inventada: fica vazia até a escola informar.
    for (let code = RA_MIN_CODE; code <= RA_MAX_CODE; code++) {
      await RaCode.updateOrCreate({ code }, { polarity: polarityForCode(code)! })
    }

    const email = (env.get('ADMIN_EMAIL') ?? 'admin@preceptoria.local').toLowerCase()
    if (await User.findBy('email', email)) return

    const inProduction = env.get('NODE_ENV') === 'production'
    const password =
      env.get('ADMIN_PASSWORD') ??
      (inProduction ? randomBytes(12).toString('base64url') : 'Preceptoria@2026')
    await User.create({ fullName: 'Administrador', email, password, role: 'admin', isActive: true })

    logger.info(`Administrador criado: ${email}`)
    if (!env.get('ADMIN_PASSWORD'))
      logger.warn(`Senha inicial: ${password}  (troque após o primeiro acesso)`)
  }
}
