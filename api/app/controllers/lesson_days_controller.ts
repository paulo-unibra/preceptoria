import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import LessonDay from '#models/lesson_day'
import Lesson from '#models/lesson'
import ClassroomAccess from '#services/classroom_access'
import { writableClassroom } from '#services/daily_records'
import { upsertLessonDayValidator, patchLessonDayValidator } from '#validators/daily'
import type User from '#models/user'
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
    const { lessonDay, created } = await saveLessonDay(auth.user!, payload)
    return response.status(created ? 201 : 200).send({ lesson_day: lessonDay })
  }
}

export async function saveLessonDay(
  user: User,
  payload: Awaited<ReturnType<typeof patchLessonDayValidator.validate>>,
  patch = false
) {
  const classroom = await writableClassroom(user, payload.classroom_id)
  const lessons = payload.lessons ?? []

  const { lessonDay: savedDay, created } = await db.transaction(async (trx) => {
    let lessonDay = await LessonDay.query({ client: trx })
      .where({ classroom_id: classroom.id, date: payload.date })
      .first()
    const isNew = !lessonDay
    const planned = payload.planned_lessons ?? lessonDay?.plannedLessons
    if (planned === undefined)
      throw invalid('Na criação do diário, informe a quantidade verificada de aulas previstas.')
    for (const l of lessons) {
      if (l.period > planned)
        throw invalid(`A ${l.period}ª aula excede a quantidade de aulas previstas (${planned}).`)
    }
    if (lessonDay) {
      const maxExisting = await Lesson.query({ client: trx })
        .where('lesson_day_id', lessonDay.id)
        .max('period as max')
        .first()
      const max = Number(maxExisting?.$extras.max ?? 0)
      if (planned < max) {
        throw invalid(
          `Já existem aulas registradas até a ${max}ª; a quantidade prevista não pode ser menor.`
        )
      }
      lessonDay.merge({
        plannedLessons: planned,
        note: patch && payload.note === null ? null : (payload.note ?? lessonDay.note),
      })
      await lessonDay.save()
    } else {
      lessonDay = await LessonDay.create(
        {
          classroomId: classroom.id,
          date: parseDate(payload.date),
          plannedLessons: planned,
          note: payload.note ?? null,
        },
        { client: trx }
      )
    }

    const existing = await Lesson.query({ client: trx }).where('lesson_day_id', lessonDay.id)
    const byPeriod = new Map(existing.map((l) => [l.period, l]))
    for (const l of lessons) {
      const row = byPeriod.get(l.period)
      const keep = patch ? row : undefined
      const value = <T>(input: T | undefined, previous: T | undefined, fallback: T) =>
        input === undefined ? (previous ?? fallback) : input
      const notIdentified = l.not_identified ?? keep?.notIdentified ?? false
      const attrs = {
        teacherName: value(l.teacher_name, keep?.teacherName, null),
        subject: value(l.subject, keep?.subject, null),
        content: value(l.content, keep?.content, null),
        progress: value(l.progress, keep?.progress, null),
        notes: value(l.notes, keep?.notes, null),
        notIdentified,
        notIdentifiedReason: notIdentified
          ? value(l.not_identified_reason, keep?.notIdentifiedReason, null)
          : null,
      }
      if (attrs.notIdentified && (attrs.content || attrs.progress)) {
        throw invalid(
          `A ${l.period}ª aula está marcada como "Não identificado": remova o conteúdo/andamento ou desmarque a opção.`
        )
      }
      if (row) {
        row.useTransaction(trx)
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
  return { lessonDay: savedDay, created }
}
