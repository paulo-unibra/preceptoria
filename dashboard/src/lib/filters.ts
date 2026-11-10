import { useOutletContext } from "react-router";
import type { Classroom } from "@/lib/types";

export interface DashboardContext {
  classroomId: string;
  from: string;
  to: string;
  classrooms: Classroom[];
}
export function useFilters() {
  return useOutletContext<DashboardContext>();
}
