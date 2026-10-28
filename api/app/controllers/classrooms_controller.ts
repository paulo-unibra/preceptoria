import type { HttpContext } from '@adonisjs/core/http'
import Classroom from '#models/classroom'
import Student from '#models/student'
import ClassroomAccess from '#services/classroom_access'
import { createClassroomValidator, updateClassroomValidator } from '#validators/admin'
import { boolParam, pageParams } from '#support/query'

export default class ClassroomsController {
  async index({ auth, request }: HttpContext) {
    const query = Classroom.query()
      .withCount('students', (q) => q.where('is_active', true))
      .orderBy('school_year', 'desc')
      .orderBy('name')
    await ClassroomAccess.scope(query, auth.user!, 'id')
    const active = boolParam(request.input('is_active'))
    if (active !== undefined) query.where('is_active', active)
    if (request.input('school_year'))
      query.where('school_year', Number(request.input('school_year')))
    const classrooms = await query
    return {
      data: classrooms.map((c) => ({
        ...c.serialize(),
        students_count: Number(c.$extras.students_count),
      })),
    }
  }

  async show({ auth, params }: HttpContext) {
    const classroom = await Classroom.findOrFail(params.id)
    await ClassroomAccess.assert(auth.user!, classroom.id)
    return { classroom }
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(createClassroomValidator)
    const exists = await Classroom.query()
      .where({ name: data.name, school_year: data.school_year })
      .first()
    if (exists) {
      return response.unprocessableEntity({
        errors: [
          {
            field: 'name',
            message: 'Já existe uma turma com este nome neste ano letivo.',
            code: 'E_UNIQUE',
          },
        ],
      })
    }
    const classroom = await Classroom.create({
      name: data.name,
      schoolYear: data.school_year,
      shift: data.shift ?? null,
      isActive: data.is_active ?? true,
    })
    return response.created({ classroom })
  }

  async update({ params, request }: HttpContext) {
    const classroom = await Classroom.findOrFail(params.id)
    const data = await request.validateUsing(updateClassroomValidator)
    classroom.merge({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.school_year !== undefined && { schoolYear: data.school_year }),
      ...(data.shift !== undefined && { shift: data.shift }),
      ...(data.is_active !== undefined && { isActive: data.is_active }),
    })
    await classroom.save()
    return { classroom }
  }

  /** RF-04 — aba "Enturmação": relação de estudantes da turma. */
  async students({ auth, params, request }: HttpContext) {
    const classroom = await Classroom.findOrFail(params.id)
    await ClassroomAccess.assert(auth.user!, classroom.id)
    const { page, perPage } = pageParams(request, 100)
    const query = Student.query().where('classroom_id', classroom.id).orderBy('full_name')
    const active = boolParam(request.input('is_active'))
    query.where('is_active', active ?? true)
    if (request.input('q')) query.whereLike('full_name', `%${request.input('q')}%`)
    return { classroom, students: await query.paginate(page, perPage) }
  }
}
