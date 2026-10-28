import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Classroom from '#models/classroom'
import AuditService from '#services/audit_service'
import {
  createUserValidator,
  syncClassroomsValidator,
  updateUserValidator,
} from '#validators/admin'
import { boolParam, pageParams } from '#support/query'

export default class UsersController {
  async index({ request }: HttpContext) {
    const { page, perPage } = pageParams(request)
    const q = request.input('q')
    const query = User.query().preload('classrooms').orderBy('full_name')
    if (request.input('role')) query.where('role', request.input('role'))
    const active = boolParam(request.input('is_active'))
    if (active !== undefined) query.where('is_active', active)
    if (q) query.where((b) => b.whereLike('full_name', `%${q}%`).orWhereLike('email', `%${q}%`))
    return query.paginate(page, perPage)
  }

  async show({ params }: HttpContext) {
    const user = await User.findOrFail(params.id)
    await user.load('classrooms')
    return { user }
  }

  async store({ request, response }: HttpContext) {
    const { classroom_ids, ...data } = await request.validateUsing(createUserValidator)
    const user = await db.transaction(async (trx) => {
      const created = await User.create(
        {
          fullName: data.full_name,
          email: data.email,
          password: data.password,
          role: data.role,
          isActive: data.is_active ?? true,
        },
        { client: trx }
      )
      if (classroom_ids?.length) {
        const found = await Classroom.query({ client: trx })
          .whereIn('id', classroom_ids)
          .select('id')
        await created.related('classrooms').attach(found.map((c) => c.id))
      }
      return created
    })
    await AuditService.record('users', user.id, 'create', {
      full_name: { old: null, new: user.fullName },
      email: { old: null, new: user.email },
      role: { old: null, new: user.role },
    })
    await user.load('classrooms')
    return response.created({ user })
  }

  async update({ params, request, response }: HttpContext) {
    const user = await User.findOrFail(params.id)
    const data = await request.validateUsing(updateUserValidator)
    const before = {
      full_name: user.fullName,
      email: user.email,
      role: user.role,
      is_active: user.isActive,
    }

    if (data.email && data.email !== user.email) {
      const taken = await User.query().where('email', data.email).whereNot('id', user.id).first()
      if (taken) {
        return response.unprocessableEntity({
          errors: [
            { field: 'email', message: 'Já existe um usuário com este e-mail.', code: 'E_UNIQUE' },
          ],
        })
      }
    }
    user.merge({
      ...(data.full_name !== undefined && { fullName: data.full_name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.is_active !== undefined && { isActive: data.is_active }),
      ...(data.password !== undefined && { password: data.password }),
    })
    await user.save()

    const after = {
      full_name: user.fullName,
      email: user.email,
      role: user.role,
      is_active: user.isActive,
    }
    const changes: Record<string, { old: unknown; new: unknown }> = {}
    for (const k of Object.keys(after) as (keyof typeof after)[]) {
      if (before[k] !== after[k]) changes[k] = { old: before[k], new: after[k] }
    }
    if (data.password !== undefined) changes.password = { old: '***', new: '*** (redefinida)' }
    if (Object.keys(changes).length) await AuditService.record('users', user.id, 'update', changes)

    await user.load('classrooms')
    return { user }
  }

  /** Define quais turmas o usuário atende (preceptor) ou gere (coordenação). Substitui a lista atual. */
  async syncClassrooms({ params, request }: HttpContext) {
    const user = await User.findOrFail(params.id)
    const { classroom_ids } = await request.validateUsing(syncClassroomsValidator)
    const found = await Classroom.query().whereIn('id', classroom_ids).select('id')
    const previous = (await user.related('classrooms').query().select('classrooms.id'))
      .map((c) => c.id)
      .sort()
    await user.related('classrooms').sync(found.map((c) => c.id))
    const next = found.map((c) => c.id).sort()
    await AuditService.record('users', user.id, 'update', {
      classroom_ids: { old: previous, new: next },
    })
    await user.load('classrooms')
    return { user }
  }
}
