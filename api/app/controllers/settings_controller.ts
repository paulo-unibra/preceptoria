import type { HttpContext } from '@adonisjs/core/http'
import SettingsService from '#services/settings_service'
import { privacySettingsValidator, rankingSettingsValidator } from '#validators/admin'

export default class SettingsController {
  async index() {
    return {
      ranking: await SettingsService.get('ranking'),
      privacy: await SettingsService.get('privacy'),
    }
  }

  async updateRanking({ request }: HttpContext) {
    const data = await request.validateUsing(rankingSettingsValidator)
    return { ranking: await SettingsService.set('ranking', data) }
  }

  async updatePrivacy({ request }: HttpContext) {
    const data = await request.validateUsing(privacySettingsValidator)
    return { privacy: await SettingsService.set('privacy', data) }
  }
}
