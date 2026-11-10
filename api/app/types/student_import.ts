export interface ImportedField {
  key: string
  label: string
  value: string | boolean | null
  raw_value: string | null
}

export interface ImportedSection {
  key: string
  title: string
  fields: ImportedField[]
}

export interface ImportedProfile {
  version: 1
  school_year: number
  school_name: string | null
  source: { filename: string; pages: number[]; text: string[] }
  sections: ImportedSection[]
  warnings: string[]
}

export interface StudentImportRow {
  student_id: number | null
  full_name: string
  registration: string
  action: 'created' | 'updated' | 'unchanged' | 'conflict'
  has_photo: boolean
  warnings: string[]
}

export interface StudentImportResult {
  id: number
  filename: string
  classroom: { id: number; name: string; school_year: number }
  classroom_created: boolean
  pages: number
  total: number
  created: number
  updated: number
  unchanged: number
  conflicts: number
  photos_saved: number
  photos_found: number
  already_imported: boolean
  rows: StudentImportRow[]
}
