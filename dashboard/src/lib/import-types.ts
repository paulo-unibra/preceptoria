export type {
  ImportedProfile,
  ImportedSection,
  ImportedField,
  StudentImportResult,
} from "../../../api/app/types/student_import";

export interface ImportListEntry {
  id: number;
  filename: string;
  school_year: number;
  students_count: number;
  created_at: string;
}
