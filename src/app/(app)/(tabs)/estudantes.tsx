import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StudentAvatar } from '@/components/domain';
import { ThemedText } from '@/components/themed-text';
import { Card, Empty, ErrorView, Field, Loading, Screen } from '@/components/ui/kit';
import { WorkSelector } from '@/components/work-selector';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { api } from '@/lib/api';
import type { Paginated, Student } from '@/lib/types';
import { useWork } from '@/lib/work-context';

/** RF-04 — aba "Enturmação": relação de estudantes por turma; ao tocar, abre a ficha. */
export default function ClassRosterScreen() {
  const router = useRouter();
  const { classroom, classroomId } = useWork();
  const [search, setSearch] = useState('');

  const list = useAsync(
    () => api<Paginated<Student>>('/students', { query: { classroom_id: classroomId, q: search.trim() || undefined, per_page: 200 } }),
    [classroomId, search],
    { enabled: !!classroomId }
  );
  const students = list.data?.data ?? [];

  return (
    <Screen refreshing={list.refreshing} onRefresh={list.reload}>
      <ThemedText type="heading">Enturmação</ThemedText>
      <WorkSelector showDate={false} />
      <Field label="Buscar estudante" value={search} onChangeText={setSearch} placeholder="Nome ou matrícula" autoCorrect={false} />

      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorView error={list.error} onRetry={list.reload} />
      ) : !students.length ? (
        <Empty title="Nenhum estudante encontrado" message={search ? 'Tente outro nome ou matrícula.' : 'Esta turma ainda não tem estudantes enturmados.'} />
      ) : (
        <View style={styles.list}>
          <ThemedText type="caption" themeColor="textSecondary">
            {classroom?.name} · {list.data?.meta.total} estudante(s)
          </ThemedText>
          {students.map((s) => (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`Abrir ficha de ${s.full_name}`} onPress={() => router.push(`/estudante/${s.id}`)}>
              <Card style={styles.row}>
                <StudentAvatar id={s.id} name={s.full_name} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{s.full_name}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {s.registration ? `Matrícula ${s.registration}` : 'Sem matrícula informada'}
                  </ThemedText>
                </View>
                <ThemedText type="default" themeColor="textSecondary">›</ThemedText>
              </Card>
            </Pressable>
          ))}
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
