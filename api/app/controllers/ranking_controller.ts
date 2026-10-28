import type { HttpContext } from '@adonisjs/core/http'
import ClassroomAccess from '#services/classroom_access'
import RankingService from '#services/ranking_service'
import SettingsService from '#services/settings_service'
import { rankingQueryValidator } from '#validators/queries'
import { todayISO } from '#support/dates'

export default class RankingController {
  async index({ auth, request }: HttpContext) {
    const q = await request.validateUsing(rankingQueryValidator, { data: request.qs() })
    if (q.classroom_id) await ClassroomAccess.assert(auth.user!, q.classroom_id)
    return RankingService.build(auth.user!, {
      kind: q.kind ?? 'weekly',
      end: q.end ?? todayISO(),
      classroomId: q.classroom_id,
    })
  }

  /** Critérios e pesos em uso, abertos a todos os perfis para manter a transparência. */
  async criteria() {
    return { criteria: await SettingsService.get('ranking') }
  }
}
