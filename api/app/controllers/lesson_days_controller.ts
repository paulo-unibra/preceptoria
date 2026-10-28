import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import LessonDay from '#models/lesson_day'
import Lesson from '#models/lesson'
import ClassroomAccess from '#services/classroom_access'
import { writableClassroom } from '#services/daily_records'
import { upsertLessonDayValidator } from '#validators/daily'
import { invalid } from '#support/errors'
import { parseDate } from '#support/dates'
import { pageParams, toId } from '#support/query'

export default class LessonDaysController {
  async index({ auth, request }: HttpContext) {
    const { page, perPage } = pageParams(request, 31)
    const query = LessonDay.query()
      .preload('lessons', (q) => q.orderBy('period'))
      .orderBy('date', 'desc')
    await ClassroomAccess.scope(query, auth.user!)
    const classroomId = toId(request.input('classroom_id'))
    if (classroomId) query.where('classroom_id', classroomId)
    if (request.input('date')) query.where('date', request.input('date'))
    if (request.input('from')) query.where('date', '>=', request.input('from'))
    if (request.input('to')) query.where('date', '<=', request.input('to'))
    return query.paginate(page, perPage)
  }

  async show({ auth, params }: HttpContext) {
    const day = await LessonDay.query()
      .where('id', params.id)
      .preload('lessons', (q) => q.orderBy('period'))
      .firstOrFail()
    await ClassroomAccess.assert(auth.user!, day.classroomId)
    return { lesson_day: day }
  }

  /**
   * RF-06/RF-07 — cria ou atualiza o dia de aulas da turma (por data) e cada tempo informado.
   * Tempos não enviados são mantidos. Em "Não identificado" nenhum conteúdo pode ser informado:
   * o sistema não aceita dado inventado.
   */
  async upsert({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(upsertLessonDayValidator)
    const classroom = await writableClassroom(auth.user!, payload.classroom_id)
    const lessons = payload.lessons ?? []

    for (const l of lessons) {
      if (l.period > payload.planned_lessons) {
        throw invalid(
          `A ${l.period}ª aula excede a quantidade de aulas previstas (${payload.planned_lessons}).`
        )
      }
      if (l.not_identified && (l.content || l.progress)) {
        throw invalid(
          `A ${l.period}ª aula está marcada como "Não identificado": remova o conteúdo/andamento ou desmarque a opção.`
        )
      }
    }

    const { lessonDay: savedDay, created } = await db.transaction(async (trx) => {
      let lessonDay = await LessonDay.query({ client: trx })
        .where({ classroom_id: classroom.id, date: payload.date })
        .first()
      const isNew = !lessonDay
      if (lessonDay) {
        const maxExisting = await Lesson.query({ client: trx })
          .where('lesson_day_id', lessonDay.id)
          .max('period as max')
          .first()
        const max = Number(maxExisting?.$extras.max ?? 0)
        if (payload.planned_lessons < max) {
          throw invalid(
            `Já existem aulas registradas até a ${max}ª; a quantidade prevista não pode ser menor.`
          )
        }
        lessonDay.merge({
          plannedLessons: payload.planned_lessons,
          note: payload.note ?? lessonDay.note,
        })
        await lessonDay.save()
      } else {
        lessonDay = await LessonDay.create(
          {
            classroomId: classroom.id,
            date: parseDate(payload.date),
            plannedLessons: payload.planned_lessons,
            note: payload.note ?? null,
          },
          { client: trx }
        )
      }

      const existing = await Lesson.query({ client: trx }).where('lesson_day_id', lessonDay.id)
      const byPeriod = new Map(existing.map((l) => [l.period, l]))
      for (const l of lessons) {
        const attrs = {
          teacherName: l.teacher_name ?? null,
          subject: l.subject ?? null,
          content: l.content ?? null,
          progress: l.progress ?? null,
          notes: l.notes ?? null,
          notIdentified: l.not_identified ?? false,
          notIdentifiedReason: l.not_identified ? (l.not_identified_reason ?? null) : null,
        }
        const row = byPeriod.get(l.period)
        if (row) {
          row.merge(attrs)
          await row.save()
        } else {
          await Lesson.create(
            { lessonDayId: lessonDay.id, period: l.period, ...attrs },
            { client: trx }
          )
        }
      }
      return { lessonDay, created: isNew }
    })

    await savedDay.load('lessons', (q) => q.orderBy('period'))
    return response.status(created ? 201 : 200).send({ lesson_day: savedDay })
  }
}
