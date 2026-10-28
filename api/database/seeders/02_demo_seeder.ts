import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Attendance from '#models/attendance'
import Classroom from '#models/classroom'
import Guardian from '#models/guardian'
import Occurrence from '#models/occurrence'
import Student from '#models/student'
import UniformCheck from '#models/uniform_check'
import User from '#models/user'
import { polarityForCode } from '#support/ra'

/** Dados fictícios para desenvolvimento. Nunca roda em produção. */
export default class extends BaseSeeder {
  static environment = ['development']

  async run() {
    if (await Classroom.findBy('name', '6º A')) return

    const classroom = await Classroom.create({
      name: '6º A',
      schoolYear: DateTime.now().year,
      shift: 'morning',
      isActive: true,
    })
    const classroom2 = await Classroom.create({
      name: '7º B',
      schoolYear: DateTime.now().year,
      shift: 'afternoon',
      isActive: true,
    })

    const preceptor = await User.create({
      fullName: 'Preceptora Demo',
      email: 'preceptor@preceptoria.local',
      password: 'Preceptoria@2026',
      role: 'preceptor',
    })
    const coord = await User.create({
      fullName: 'Coordenação Demo',
      email: 'coordenacao@preceptoria.local',
      password: 'Preceptoria@2026',
      role: 'coordenacao',
    })
    await preceptor.related('classrooms').attach([classroom.id])
    await coord.related('classrooms').attach([classroom.id, classroom2.id])

    const names = [
      'Ana Beatriz Souza',
      'Bruno Henrique Lima',
      'Carla Eduarda Santos',
      'Davi Lucas Pereira',
      'Elisa Maria Costa',
    ]
    const students: Student[] = []
    for (const [i, fullName] of names.entries()) {
      const s = await Student.create({
        fullName,
        registration: `2026${String(i + 1).padStart(3, '0')}`,
        classroomId: classroom.id,
        isActive: true,
      })
      await Guardian.create({
        studentId: s.id,
        fullName: `Responsável de ${fullName.split(' ')[0]}`,
        relationship: 'Mãe',
        phone: `(81) 90000-00${i}0`,
        isPrimary: true,
      })
      students.push(s)
    }
    await Student.create({
      fullName: 'Fábio Gabriel Alves',
      registration: '2026101',
      classroomId: classroom2.id,
      isActive: true,
    })

    const today = DateTime.now()
    for (let d = 0; d < 5; d++) {
      const date = today.minus({ days: d })
      if (date.weekday > 5) continue
      for (const [i, s] of students.entries()) {
        await Attendance.create({
          studentId: s.id,
          classroomId: classroom.id,
          date,
          status: (i + d) % 6 === 0 ? 'absent' : 'present',
          isJustified: false,
        })
        await UniformCheck.create({
          studentId: s.id,
          classroomId: classroom.id,
          date,
          uniformStatus: (i + d) % 4 === 0 ? 'inadequate' : 'adequate',
          footwearStatus: 'adequate',
        })
      }
    }
    for (const [i, code] of [3, 5, 9, 12, 2].entries()) {
      await Occurrence.create({
        studentId: students[i].id,
        classroomId: classroom.id,
        occurredOn: today.minus({ days: i }),
        raCode: code,
        polarity: polarityForCode(code)!,
        source: 'app',
        description: `Registro de demonstração (código ${code}).`,
        status: 'active',
      })
    }
    logger.info(
      'Dados de demonstração criados (preceptor@/coordenacao@preceptoria.local, senha Preceptoria@2026).'
    )
  }
}
