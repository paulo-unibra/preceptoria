import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAsync } from '@/hooks/use-async';
import { api } from '@/lib/api';
import { addDays, todayISO } from '@/lib/format';
import type { Classroom } from '@/lib/types';

interface WorkContextValue {
  classrooms: Classroom[];
  loadingClassrooms: boolean;
  classroomsError: Error | null;
  classroom: Classroom | null;
  classroomId: number | null;
  setClassroomId: (id: number) => void;
  date: string;
  setDate: (iso: string) => void;
  shiftDate: (days: number) => void;
  isToday: boolean;
  reloadClassrooms: () => Promise<void>;
}

const WorkContext = createContext<WorkContextValue | null>(null);

/**
 * Turma e data de trabalho compartilhadas entre as telas: o fluxo diário do preceptor começa
 * sempre por "selecionar a turma e a data do acompanhamento".
 */
export function WorkProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, reload } = useAsync(
    () => api<{ data: Classroom[] }>('/classrooms', { query: { is_active: true } }).then((r) => r.data),
    []
  );
  const [classroomId, setClassroomIdState] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const classrooms = data ?? [];

  useEffect(() => {
    if (classroomId === null && classrooms.length) setClassroomIdState(classrooms[0].id);
  }, [classrooms, classroomId]);

  const shiftDate = useCallback((days: number) => setDate((d) => addDays(d, days)), []);

  const value = useMemo<WorkContextValue>(
    () => ({
      classrooms,
      loadingClassrooms: loading,
      classroomsError: error,
      classroom: classrooms.find((c) => c.id === classroomId) ?? null,
      classroomId,
      setClassroomId: setClassroomIdState,
      date,
      setDate,
      shiftDate,
      isToday: date === todayISO(),
      reloadClassrooms: reload,
    }),
    [classrooms, loading, error, classroomId, date, shiftDate, reload]
  );
  return <WorkContext value={value}>{children}</WorkContext>;
}

export function useWork(): WorkContextValue {
  const ctx = use(WorkContext);
  if (!ctx) throw new Error('useWork deve ser usado dentro de <WorkProvider>.');
  return ctx;
}
