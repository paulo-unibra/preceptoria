import type { HttpContext } from '@adonisjs/core/http'
import RaCode from '#models/ra_code'
import { updateRaCodeValidator } from '#validators/admin'
import { boolParam } from '#support/query'

export default class RaCodesController {
  /** Tabela de códigos RA (RN01). A descrição oficial pode estar vazia até a escola informar (DP05). */
  async index({ request }: HttpContext) {
    const query = RaCode.query().orderBy('code')
    if (request.input('polarity')) query.where('polarity', request.input('polarity'))
    const active = boolParam(request.input('is_active'))
    if (active !== undefined) query.where('is_active', active)
    return { data: await query }
  }

  /** O administrador informa a descrição oficial e ativa/desativa o código. A polaridade é fixa pela faixa (RN01/RN02). */
  async update({ params, request }: HttpContext) {
    const code = await RaCode.findByOrFail('code', params.code)
    const data = await request.validateUsing(updateRaCodeValidator)
    code.merge({
      ...(data.description !== undefined && { description: data.description }),
      ...(data.is_active !== undefined && { isActive: data.is_active }),
    })
    await code.save()
    return { ra_code: code }
  }
}
