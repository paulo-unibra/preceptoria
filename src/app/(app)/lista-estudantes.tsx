import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StudentAvatar } from '@/components/domain';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Empty, ErrorView, Field, Loading, Screen } from '@/components/ui/kit';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import type { Paginated, Student } from '@/lib/types';

const PER_PAGE = 100;

/** Lista com todos os estudantes que o usuário pode consultar; ao tocar, abre a ficha completa. */
export default function AllStudentsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [meta, setMeta] = useState<Paginated<Student>['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const ticket = useRef(0);

  // Espera o usuário parar de digitar antes de buscar.
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(
    async (page: number, mode: 'initial' | 'more' | 'refresh') => {
      const mine = ++ticket.current;
      if (mode === 'initial') setLoading(true);
      if (mode === 'more') setLoadingMore(true);
      if (mode === 'refresh') setRefreshing(true);
      try {
        const res = await api<Paginated<Student>>('/students', {
          query: { q: query || undefined, per_page: PER_PAGE, page },
        });
        if (mine !== ticket.current) return;
        setStudents((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
        setMeta(res.meta);
        setError(null);
      } catch (e) {
        if (mine !== ticket.current) return;
        setError(e as Error);
      } finally {
        if (mine === ticket.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [query]
  );

  useEffect(() => {
    void load(1, 'initial');
  }, [load]);

  const hasMore = !!meta && meta.current_page < meta.last_page;

  return (
    <Screen edges={['bottom']} refreshing={refreshing} onRefresh={() => load(1, 'refresh')}>
      <Field label="Buscar estudante" value={search} onChangeText={setSearch} placeholder="Nome ou matrícula" autoCorrect={false} />

      {loading ? (
        <Loading />
      ) : error && !students.length ? (
        <ErrorView error={error} onRetry={() => load(1, 'initial')} />
      ) : !students.length ? (
        <Empty title="Nenhum estudante encontrado" message={query ? 'Tente outro nome ou matrícula.' : 'Ainda não há estudantes cadastrados.'} />
      ) : (
        <View style={styles.list}>
          <ThemedText type="caption" themeColor="textSecondary">
            {meta?.total ?? students.length} estudante(s)
          </ThemedText>
          {students.map((s) => (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`Abrir ficha de ${s.full_name}`} onPress={() => router.push(`/estudante/${s.id}`)}>
              <Card style={styles.row}>
                <StudentAvatar id={s.id} name={s.full_name} hasPhoto={s.has_photo} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{s.full_name}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {s.classroom?.name ?? 'Sem turma'}
                    {s.registration ? ` · Matrícula ${s.registration}` : ''}
                  </ThemedText>
                </View>
                <ThemedText type="default" themeColor="textSecondary">›</ThemedText>
              </Card>
            </Pressable>
          ))}
          {hasMore ? <Button label="Carregar mais" variant="secondary" loading={loadingMore} onPress={() => load((meta?.current_page ?? 1) + 1, 'more')} /> : null}
          {error ? (
            <ThemedText type="small" themeColor="danger">
              {error.message}
            </ThemedText>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  flex: { flex: 1 },
});
