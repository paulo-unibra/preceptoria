import { createHash, randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import Classroom from '#models/classroom'
import Student from '#models/student'
import Guardian from '#models/guardian'
import AuditLog from '#models/audit_log'
import { conflict } from '#support/errors'
import {
  classroomFromFilename,
  classroomKey,
  normalizeText,
  parseStudentPdf,
  profileValue,
} from '#services/student_pdf_parser'
import type {
  ImportedProfile,
  StudentImportResult,
  StudentImportRow,
} from '../types/student_import.js'

let importing = false
const photosDirectory = () => app.makePath(env.get('STORAGE_PATH') ?? 'storage', 'photos')
const stringValue = (value: unknown) => (typeof value === 'string' ? value : null)

/** Cria vínculos simples de responsáveis; os dados completos ficam na ficha de origem. */
function guardiansFromProfile(profile: ImportedProfile) {
  const people: {
    fullName: string
    relationship: string | null
    phone: string | null
    primary: boolean
    cpf: string | null
  }[] = []
  for (const key of ['student_guardian', 'enrollment_guardian', 'mother', 'father', 'benefit']) {
    const name = stringValue(
      profileValue(
        profile,
        key,
        ['mother', 'father'].includes(key)
          ? 'nome'
          : key === 'benefit'
            ? 'responsavel'
            : 'nome_completo'
      )
    )
    if (!name || /^(NAO|NAO DECLARAD[OA]|DESCONHECID[OA])$/.test(normalizeText(name))) continue
    const phone = stringValue(profileValue(profile, key, 'celular'))
    const cpf = stringValue(profileValue(profile, key, 'cpf'))
    const relationship =
      stringValue(profileValue(profile, key, 'grau_de_parentesco')) ??
      (key === 'mother' ? 'Mãe' : key === 'father' ? 'Pai' : null)
    const previous = people.find(
      (person) =>
        normalizeText(person.fullName) === normalizeText(name) || (cpf && person.cpf === cpf)
    )
    if (previous) {
      previous.phone ??= phone
      previous.relationship ??= relationship
      continue
    }
    people.push({ fullName: name, relationship, phone, cpf, primary: key === 'student_guardian' })
  }
  if (people.length && !people.some((person) => person.primary)) people[0].primary = true
  return people
}

export default class StudentImportService {
  static async run(buffer: Buffer, filename: string, userId: number): Promise<StudentImportResult> {
    if (importing)
      throw conflict(
        'Uma importação está sendo processada. Aguarde a conclusão e tente novamente.',
        'E_IMPORT_BUSY'
      )
    importing = true
    const writtenPhotos: string[] = []
    try {
      const classroomName = classroomFromFilename(filename)
      const fileHash = createHash('sha256').update(buffer).digest('hex')
      const previousImport = await db.from('student_imports').where('file_hash', fileHash).first()
      if (previousImport) {
        const result = JSON.parse(previousImport.summary) as StudentImportResult
        if (classroomKey(result.classroom.name) !== classroomKey(classroomName))
          throw conflict(
            'Este PDF já foi importado para outra turma. Confira o nome do arquivo.',
            'E_IMPORT_ALREADY_ASSIGNED'
          )
        return { ...result, already_imported: true }
      }
      const parsed = await parseStudentPdf(buffer, filename)
      await mkdir(photosDirectory(), { recursive: true })

      return await db.transaction(async (trx) => {
        const classrooms = await Classroom.query({ client: trx }).where(
          'school_year',
          parsed.schoolYear
        )
        const matches = classrooms.filter(
          (classroom) => classroomKey(classroom.name) === classroomKey(parsed.classroomName)
        )
        if (matches.length > 1)
          throw conflict(
            'Há mais de uma turma equivalente neste ano letivo. Regularize os cadastros antes de importar.',
            'E_IMPORT_AMBIGUOUS_CLASSROOM'
          )
        const classroomCreated = matches.length === 0
        const classroom =
          matches[0] ??
          (await Classroom.create(
            { name: parsed.classroomName, schoolYear: parsed.schoolYear, isActive: true },
            { client: trx }
          ))
        if (!classroom.isActive)
          throw conflict(
            'A turma encontrada está inativa. Reative-a antes de importar estudantes.',
            'E_IMPORT_INACTIVE_CLASSROOM'
          )
        const [inserted] = await trx
          .table('student_imports')
          .insert({
            file_hash: fileHash,
            filename,
            classroom_id: classroom.id,
            user_id: userId,
            school_year: parsed.schoolYear,
            students_count: parsed.students.length,
            summary: '{}',
            created_at: DateTime.utc().toSQL(),
          })
          .returning('id')
        const importId = Number(typeof inserted === 'object' ? inserted.id : inserted)
        const rows: StudentImportRow[] = []
        let photosSaved = 0

        for (const item of parsed.students) {
          let student = await Student.query({ client: trx })
            .where('registration', item.registration)
            .first()
          const warnings = [...item.profile.warnings]
          let action: StudentImportRow['action'] = 'unchanged'
          const incompatible =
            student &&
            (normalizeText(student.fullName) !== normalizeText(item.fullName) ||
              (student.classroomId !== null && student.classroomId !== classroom.id))
          if (incompatible) {
            warnings.push(
              'Matrícula existente com outro nome ou outra turma. O cadastro existente foi preservado; confira a matrícula e a enturmação.'
            )
            action = 'conflict'
          } else {
            if (!student) {
              student = await Student.create(
                {
                  fullName: item.fullName,
                  registration: item.registration,
                  birthDate: item.birthDate ? DateTime.fromISO(item.birthDate) : null,
                  classroomId: classroom.id,
                  isActive: true,
                },
                { client: trx }
              )
              action = 'created'
            } else {
              if (!student.birthDate && item.birthDate)
                student.birthDate = DateTime.fromISO(item.birthDate)
              if (
                student.birthDate &&
                item.birthDate &&
                student.birthDate.toISODate() !== item.birthDate
              )
                warnings.push(
                  'Nascimento diferente do cadastro existente; a data cadastrada foi preservada.'
                )
              if (!student.classroomId) student.classroomId = classroom.id
              if (!student.isActive)
                warnings.push('O estudante já estava inativo e não foi reativado automaticamente.')
            }

            if (item.photo && !student.photoPath) {
              const photoName = `student-${student.id}-${randomUUID()}.jpg`
              const path = app.makePath(env.get('STORAGE_PATH') ?? 'storage', 'photos', photoName)
              await writeFile(path, item.photo, { flag: 'wx', mode: 0o600 })
              writtenPhotos.push(path)
              student.photoPath = photoName
              photosSaved++
            }
            if (student.$isDirty) {
              await student.save()
              if (action !== 'created') action = 'updated'
            }

            const existingGuardians = await Guardian.query({ client: trx }).where(
              'student_id',
              student.id
            )
            for (const person of guardiansFromProfile(item.profile)) {
              const guardian = existingGuardians.find(
                (existing) => normalizeText(existing.fullName) === normalizeText(person.fullName)
              )
              if (guardian) {
                if (!guardian.phone && person.phone) guardian.phone = person.phone
                if (!guardian.relationship && person.relationship)
                  guardian.relationship = person.relationship
                if (guardian.$isDirty) {
                  await guardian.save()
                  if (action !== 'created') action = 'updated'
                }
              } else {
                const created = await Guardian.create(
                  {
                    studentId: student.id,
                    fullName: person.fullName,
                    relationship: person.relationship,
                    phone: person.phone,
                    isPrimary:
                      person.primary && !existingGuardians.some((existing) => existing.isPrimary),
                    isActive: true,
                  },
                  { client: trx }
                )
                existingGuardians.push(created)
                if (action !== 'created') action = 'updated'
              }
            }
            const previous = await trx
              .from('student_import_entries')
              .where('student_id', student.id)
              .orderBy('id', 'desc')
              .first()
            if (
              action === 'unchanged' &&
              (!previous ||
                JSON.stringify((JSON.parse(previous.profile) as ImportedProfile).sections) !==
                  JSON.stringify(item.profile.sections))
            )
              action = 'updated'
          }
          const profile = { ...item.profile, warnings }
          await trx.table('student_import_entries').insert({
            import_id: importId,
            student_id: action === 'conflict' ? null : student!.id,
            registration: item.registration,
            profile: JSON.stringify(profile),
          })
          rows.push({
            student_id: action === 'conflict' ? null : student!.id,
            full_name: item.fullName,
            registration: item.registration,
            action,
            has_photo: !incompatible && !!student?.photoPath,
            warnings,
          })
        }

        const result: StudentImportResult = {
          id: importId,
          filename,
          classroom: { id: classroom.id, name: classroom.name, school_year: classroom.schoolYear },
          classroom_created: classroomCreated,
          pages: parsed.pages,
          total: rows.length,
          created: rows.filter((row) => row.action === 'created').length,
          updated: rows.filter((row) => row.action === 'updated').length,
          unchanged: rows.filter((row) => row.action === 'unchanged').length,
          conflicts: rows.filter((row) => row.action === 'conflict').length,
          photos_saved: photosSaved,
          photos_found: parsed.students.filter((student) => student.photo).length,
          already_imported: false,
          rows,
        }
        await trx
          .from('student_imports')
          .where('id', importId)
          .update({ summary: JSON.stringify(result) })
        // A auditoria registra autoria e contagens, sem copiar documentos/saúde para logs gerais.
        await AuditLog.create(
          {
            userId,
            entity: 'student_imports',
            entityId: importId,
            classroomId: classroom.id,
            action: 'create',
            changes: {
              students_created: { old: null, new: result.created },
              photos_saved: { old: null, new: photosSaved },
              source_filename: { old: null, new: filename },
            },
          },
          { client: trx }
        )
        return result
      })
    } catch (error) {
      await Promise.all(writtenPhotos.map((path) => unlink(path).catch(() => {})))
      throw error
    } finally {
      importing = false
    }
  }
}
