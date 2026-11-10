import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import type { ClassroomReport } from "@/lib/types";

export function useReports() {
  const { classroomId, classrooms, from, to } = useFilters();
  const selected = classrooms.filter(
    (item) => !classroomId || String(item.id) === classroomId,
  );
  const queries = useQueries({
    queries: selected.map((classroom) => ({
      queryKey: ["report", classroom.id, from, to],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api<ClassroomReport>(`/reports/classrooms/${classroom.id}`, {
          query: { from, to, include_items: true },
          signal,
        }),
      staleTime: 60_000,
    })),
  });
  return {
    reports: queries.flatMap((query) => (query.data ? [query.data] : [])),
    loading: queries.some((query) => query.isPending),
    error: queries.find((query) => query.error)?.error,
    retry: () => {
      queries.forEach((query) => {
        void query.refetch();
      });
    },
  };
}
