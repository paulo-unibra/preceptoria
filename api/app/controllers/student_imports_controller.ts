import { readFile, unlink } from 'node:fs/promises'
import { basename } from 'node:path'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Student from '#models/student'
import StudentImportService from '#services/student_import_service'
import { invalid } from '#support/errors'
import type { ImportedProfile, StudentImportResult } from '../types/student_import.js'

export default class StudentImportsController {
  async index() {
    const data = await db
      .from('student_imports')
      .select('id', 'filename', 'school_year', 'students_count', 'created_at')
      .orderBy('id', 'desc')
      .limit(20)
    return {
      data: data.map((row) => ({
        ...row,
        created_at:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : (DateTime.fromSQL(String(row.created_at)).toISO() ??
              DateTime.fromISO(String(row.created_at)).toISO()),
      })),
    }
  }

  async show({ params }: HttpContext) {
    const imported = await db.from('student_imports').where('id', params.id).firstOrFail()
    return JSON.parse(imported.summary) as StudentImportResult
  }

  async store({ request, auth, response }: HttpContext) {
    const file = request.file('file', { size: '20mb', extnames: ['pdf'] })
    try {
      if (!file || !file.isValid || !file.tmpPath)
        throw invalid('Envie um arquivo PDF de até 20 MB no campo "file".', 'E_IMPORT_FILE')
      const filename = basename(file.clientName)
      if (filename.length > 255)
        throw invalid('O nome do arquivo deve ter até 255 caracteres.', 'E_IMPORT_FILENAME')
      const buffer = await readFile(file.tmpPath)
      if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-')))
        throw invalid('O arquivo enviado não é um PDF válido.', 'E_IMPORT_FILE')
      const result = await StudentImportService.run(buffer, filename, auth.user!.id)
      return response.status(result.already_imported ? 200 : 201).send(result)
    } finally {
      if (file?.tmpPath) await unlink(file.tmpPath).catch(() => {})
    }
  }

  /** Ficha completa apenas na administração: não vaza dados de saúde/documentos nas listagens. */
  async profile({ params }: HttpContext) {
    await Student.findOrFail(params.id)
    const entry = await db
      .from('student_import_entries')
      .where('student_id', params.id)
      .orderBy('id', 'desc')
      .first()
    return { profile: entry ? (JSON.parse(entry.profile) as ImportedProfile) : null }
  }
}
