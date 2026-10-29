export type Role = 'preceptor' | 'coordenacao' | 'admin';

export interface Classroom {
  id: number;
  name: string;
  school_year: number;
  shift: string | null;
  is_active: boolean;
  students_count?: number;
}

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  classrooms?: Classroom[];
}

export interface Guardian {
  id: number;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  is_primary: boolean;
}

export interface Student {
  id: number;
  full_name: string;
  registration: string | null;
  birth_date: string | null;
  classroom_id: number | null;
  tracking_notes: string | null;
  has_photo: boolean;
  is_active: boolean;
  classroom?: Classroom | null;
  guardians?: Guardian[];
}

export interface Paginated<T> {
  meta: { total: number; per_page: number; current_page: number; last_page: number };
  data: T[];
}

export interface RaCode {
  id: number;
  code: number;
  description: string | null;
  polarity: 'positive' | 'negative';
  is_active: boolean;
}

export interface Occurrence {
  id: number;
  student_id: number;
  classroom_id: number;
  occurred_on: string;
  ra_code: number;
  polarity: 'positive' | 'negative';
  polarity_divergent: boolean;
  expected_polarity: 'positive' | 'negative' | null;
  needs_review: boolean;
  source: 'app' | 'legacy';
  description: string;
  context: string | null;
  lesson_period: number | null;
  reported_by_name: string | null;
  status: 'active' | 'cancelled';
  cancel_reason: string | null;
  possible_duplicate_of_id: number | null;
  created_at: string;
  updated_at: string | null;
  student?: Student;
}

export interface Warning {
  code: string;
  message: string;
  related_id?: number;
}

export type AttendanceStatus = 'present' | 'absent' | 'late';
export type ChecklistStatus = 'adequate' | 'inadequate' | 'not_observed';

export interface AttendanceRecord {
  id: number;
  status: AttendanceStatus;
  arrival_time: string | null;
  is_justified: boolean;
  note: string | null;
}

export interface UniformRecord {
  id: number;
  uniform_status: ChecklistStatus;
  footwear_status: ChecklistStatus;
  note: string | null;
}

export interface RosterStudent {
  id: number;
  full_name: string;
  registration: string | null;
}

export interface Lesson {
  id?: number;
  period: number;
  teacher_name: string | null;
  subject: string | null;
  content: string | null;
  progress: string | null;
  notes: string | null;
  not_identified: boolean;
  not_identified_reason: string | null;
  is_complete?: boolean;
}

export interface LessonDay {
  id: number;
  classroom_id: number;
  date: string;
  planned_lessons: number;
  note: string | null;
  lessons: Lesson[];
}

export interface Totals {
  attendance: { records: number; present: number; absent: number; absent_justified: number; late: number };
  uniform: { records: number; uniform_adequate: number; uniform_inadequate: number; footwear_adequate: number; footwear_inadequate: number };
  occurrences: { total: number; positive: number; negative: number; needs_review: number };
  notifications: { total: number; linked_to_occurrence: number; guardian_informed: number };
  referrals: { total: number; open: number; in_progress: number; resolved: number };
  observations: { total: number };
  cancelled: { occurrences: number; notifications: number; referrals: number; observations: number };
}

export interface TimelineItem {
  type: 'attendance' | 'uniform_check' | 'occurrence' | 'notification' | 'referral' | 'observation';
  id: number;
  date: string;
  registered_at: string;
  status: string;
  label: string;
  data: Record<string, any>;
}

export interface StudentHistory {
  student: { id: number; full_name: string; registration: string | null; classroom: string | null };
  period: { from: string | null; to: string | null };
  totals: Totals;
  items: TimelineItem[];
}

export interface ClassroomReport {
  classroom: { id: number; name: string; school_year: number };
  totals: Totals;
  students: { student: RosterStudent; totals: Totals; items?: TimelineItem[] }[];
  lessons: {
    days: number;
    planned_lessons: number;
    registered_lessons: number;
    not_identified_lessons: number;
    items?: { id: number; date: string; planned_lessons: number; lessons: Lesson[] }[];
  };
}

export interface RankingEntry {
  position: number;
  student: { id: number; full_name: string; classroom_id: number | null };
  score: number;
  breakdown: {
    positive_ras: number;
    negative_ras: number;
    attendance_rate: number | null;
    uniform_rate: number | null;
    progress: number;
  };
}

export interface RankingResponse {
  kind: 'weekly' | 'biweekly';
  period: { from: string; to: string };
  criteria: {
    top_n: number;
    weights: { positive_ra: number; negative_ra: number; attendance_rate: number; uniform_rate: number; progress: number };
  };
  data: RankingEntry[];
}

export interface AuditLog {
  id: number;
  action: 'create' | 'update' | 'cancel';
  changes: Record<string, { old: unknown; new: unknown }>;
  created_at: string;
  user: { id: number; full_name: string } | null;
}
