import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { cuid } from '@adonisjs/core/helpers'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import Student from '#models/student'
import Guardian from '#models/guardian'
import Classroom from '#models/classroom'
import type User from '#models/user'
import ClassroomAccess, { forbidden } from '#services/classroom_access'
import SettingsService from '#services/settings_service'
import {
  createGuardianValidator,
  createStudentValidator,
  updateGuardianValidator,
  updateStudentValidator,
} from '#validators/student'
import { boolParam, pageParams, toId } from '#support/query'
import { parseDate } from '#support/dates'

export function storageDir(...parts: string[]) {
  return join(app.makePath(env.get('STORAGE_PATH') ?? 'storage'), ...parts)
}

/** Regras de privacidade (RNF02): telefone de responsáveis e foto só para perfis autorizados. */
async function serializeStudent(student: Student, user: User) {
  const privacy = await SettingsService.get('privacy')
  const json = student.serialize()
  const canSeePhone = privacy.guardian_phone_roles.includes(user.role)
  const canSeePhoto = privacy.photo_roles.includes(user.role)
  json.has_photo = canSeePhoto && student.hasPhoto
  if (Array.isArray(json.guardians)) {
    json.guardians = json.guardians.map((g: any) => (canSeePhone ? g : { ...g, phone: null }))
  }
  return json
}

export default class StudentsController {
  async index({ auth, request }: HttpContext) {
    const user = auth.user!
    const { page, perPage } = pageParams(request)
    const query = Student.query().preload('classroom').orderBy('full_name')
    await ClassroomAccess.scope(query, user, 'classroom_id')

    const classroomId = toId(request.input('classroom_id'))
    if (classroomId) query.where('classroom_id', classroomId)
    const active = boolParam(request.input('is_active'))
    query.where('is_active', active ?? true)
    const q = String(request.input('q', '')).trim()
    if (q)
      query.where((b) => b.whereLike('full_name', `%${q}%`).orWhereLike('registration', `%${q}%`))

    const result = await query.paginate(page, perPage)
    const serialized = result.serialize()
    // A listagem não carrega responsáveis; só dados de identificação.
    return { meta: serialized.meta, data: serialized.data }
  }

  async show({ auth, params }: HttpContext) {
    const student = await Student.query()
      .where('id', params.id)
      .preload('classroom')
      .preload('guardians', (q) => q.orderBy('is_primary', 'desc'))
      .firstOrFail()
    await ClassroomAccess.assert(auth.user!, student.classroomId)
    return { student: await serializeStudent(student, auth.user!) }
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createStudentValidator)
    if (data.classroom_id) await Classroom.findOrFail(data.classroom_id)
    if (data.registration && (await Student.findBy('registration', data.registration))) {
      return response.unprocessableEntity({
        errors: [
          {
            field: 'registration',
            message: 'Já existe um estudante com esta matrícula.',
            code: 'E_UNIQUE',
          },
        ],
      })
    }
    const student = await Student.create({
      fullName: data.full_name,
      registration: data.registration ?? null,
      birthDate: data.birth_date ? parseDate(data.birth_date) : null,
      classroomId: data.classroom_id ?? null,
      trackingNotes: data.tracking_notes ?? null,
      isActive: data.is_active ?? true,
    })
    return response.created({ student })
  }

  /** Mudar `classroom_id` faz a (re)enturmação; o valor anterior fica no histórico de auditoria. */
  async update({ params, request, response }: HttpContext) {
    const student = await Student.findOrFail(params.id)
    const data = await request.validateUsing(updateStudentValidator)
    if (data.classroom_id) await Classroom.findOrFail(data.classroom_id)
    if (data.registration && data.registration !== student.registration) {
      const taken = await Student.query()
        .where('registration', data.registration)
        .whereNot('id', student.id)
        .first()
      if (taken) {
        return response.unprocessableEntity({
          errors: [
            {
              field: 'registration',
              message: 'Já existe um estudante com esta matrícula.',
              code: 'E_UNIQUE',
            },
          ],
        })
      }
    }
    student.merge({
      ...(data.full_name !== undefined && { fullName: data.full_name }),
      ...(data.registration !== undefined && { registration: data.registration }),
      ...(data.birth_date !== undefined && {
        birthDate: data.birth_date ? parseDate(data.birth_date) : null,
      }),
      ...(data.classroom_id !== undefined && { classroomId: data.classroom_id }),
      ...(data.tracking_notes !== undefined && { trackingNotes: data.tracking_notes }),
      ...(data.is_active !== undefined && { isActive: data.is_active }),
    })
    await student.save()
    return { student }
  }

  async uploadPhoto({ params, request, response }: HttpContext) {
    const student = await Student.findOrFail(params.id)
    const photo = request.file('photo', { size: '3mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] })
    if (!photo) {
      return response.unprocessableEntity({
        errors: [{ field: 'photo', message: 'Envie a foto no campo "photo".', code: 'E_REQUIRED' }],
      })
    }
    if (!photo.isValid) {
      return response.unprocessableEntity({
        errors: photo.errors.map((e) => ({
          field: 'photo',
          message: 'Foto inválida: use JPG, PNG ou WEBP de até 3 MB.',
          code: e.type,
        })),
      })
    }
    const fileName = `student-${student.id}-${cuid()}.${photo.extname}`
    await photo.move(storageDir('photos'), { name: fileName })
    const previous = student.photoPath
    student.photoPath = fileName
    await student.save()
    if (previous) await unlink(storageDir('photos', previous)).catch(() => {})
    return { student }
  }

  async photo({ auth, params, response }: HttpContext) {
    const user = auth.user!
    const student = await Student.findOrFail(params.id)
    await ClassroomAccess.assert(user, student.classroomId)
    const privacy = await SettingsService.get('privacy')
    if (!privacy.photo_roles.includes(user.role))
      throw forbidden('Seu perfil não pode ver fotos de estudantes.')
    if (!student.photoPath)
      return response.notFound({
        errors: [{ message: 'Estudante sem foto.', code: 'E_NOT_FOUND' }],
      })
    return response.download(storageDir('photos', student.photoPath))
  }

  async storeGuardian({ params, request, response }: HttpContext) {
    const student = await Student.findOrFail(params.id)
    const data = await request.validateUsing(createGuardianValidator)
    const guardian = await Guardian.create({
      studentId: student.id,
      fullName: data.full_name,
      relationship: data.relationship ?? null,
      phone: data.phone ?? null,
      isPrimary: data.is_primary ?? false,
    })
    return response.created({ guardian })
  }

  async updateGuardian({ params, request }: HttpContext) {
    const guardian = await Guardian.query()
      .where({ id: params.guardianId, student_id: params.id })
      .firstOrFail()
    const data = await request.validateUsing(updateGuardianValidator)
    guardian.merge({
      ...(data.full_name !== undefined && { fullName: data.full_name }),
      ...(data.relationship !== undefined && { relationship: data.relationship }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.is_primary !== undefined && { isPrimary: data.is_primary }),
      ...(data.is_active !== undefined && { isActive: data.is_active }),
    })
    await guardian.save()
    return { guardian }
  }
}
