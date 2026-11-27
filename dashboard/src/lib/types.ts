// Contratos da API compartilhados por importação de tipos, sem dependências do Expo.
export type {
  User,
  Classroom,
  Student,
  Occurrence,
  ClassroomReport,
  StudentHistory,
  RankingResponse,
  Totals,
  Paginated as Page,
} from "../../../src/lib/types";

import type { AuditLog } from "../../../src/lib/types";

export interface AuditEntry extends AuditLog {
  entity: string;
  entity_id: number;
  classroom_id: number | null;
  user_id: number | null;
}
