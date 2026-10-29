import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError } from '@/lib/api';

interface Options {
  /** Não busca enquanto for false (ex.: falta escolher a turma). */
  enabled?: boolean;
  /** Busca de novo ao voltar para a tela (ex.: depois de lançar um RA). */
  reloadOnFocus?: boolean;
}

/**
 * Busca de dados com estados de carregando/erro/atualizando e descarte de respostas atrasadas
 * (se os filtros mudam durante uma busca, só vale a mais recente).
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[], { enabled = true, reloadOnFocus = false }: Options = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const ticket = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async (mode: 'initial' | 'refresh') => {
    const mine = ++ticket.current;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (mine !== ticket.current) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (mine !== ticket.current) return;
      setError(e as Error);
    } finally {
      if (mine === ticket.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      ticket.current++;
      setData(null);
      setLoading(false);
      return;
    }
    void run('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (reloadOnFocus && enabled) void run('refresh');
    }, [reloadOnFocus, enabled, run])
  );

  return {
    data,
    error,
    loading,
    refreshing,
    reload: useCallback(() => run('refresh'), [run]),
    setData,
  };
}
