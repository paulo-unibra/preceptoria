import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card, Empty, ErrorView, Loading, Screen, Segmented, SectionTitle } from '@/components/ui/kit';
import { WorkSelector } from '@/components/work-selector';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { RankingResponse } from '@/lib/types';
import { useWork } from '@/lib/work-context';

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** RF-03 — ranking semanal/quinzenal: destaques, critérios transparentes, valoriza o progresso. */
export default function RankingScreen() {
  const { classroomId } = useWork();
  const [kind, setKind] = useState<'weekly' | 'biweekly'>('weekly');

  const ranking = useAsync(() => api<RankingResponse>('/ranking', { query: { kind, classroom_id: classroomId } }), [kind, classroomId], { enabled: !!classroomId });
  const r = ranking.data;

  return (
    <Screen edges={['bottom']} refreshing={ranking.refreshing} onRefresh={ranking.reload}>
      <WorkSelector showDate={false} />
      <Segmented value={kind} onChange={setKind} options={[{ value: 'weekly', label: 'Semanal' }, { value: 'biweekly', label: 'Quinzenal' }]} />

      {ranking.loading ? (
        <Loading />
      ) : ranking.error ? (
        <ErrorView error={ranking.error} onRetry={ranking.reload} />
      ) : r ? (
        <>
          <ThemedText type="caption" themeColor="textSecondary">
            Período: {formatDate(r.period.from)} a {formatDate(r.period.to)}
          </ThemedText>

          {!r.data.length ? (
            <Empty title="Nenhum destaque neste período ainda" message="Os destaques aparecem conforme os registros positivos e a frequência da turma." />
          ) : (
            r.data.map((e) => (
              <Card key={e.student.id} tone={e.position === 1 ? 'positive' : undefined}>
                <View style={styles.head}>
                  <View style={styles.pos} accessible accessibilityLabel={`${e.position}º lugar`}>
                    <ThemedText type="smallBold">{e.position}º</ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={styles.flex}>{e.student.full_name}</ThemedText>
                  <ThemedText type="heading">{e.score.toLocaleString('pt-BR')}</ThemedText>
                </View>
                <View style={styles.badges}>
                  <Badge label={`${e.breakdown.positive_ras} RA(s) positivo(s)`} tone="positive" />
                  <Badge label={`Presença ${pct(e.breakdown.attendance_rate)}`} />
                  <Badge label={`Fardamento ${pct(e.breakdown.uniform_rate)}`} />
                  {e.breakdown.progress > 0 ? <Badge label={`Progresso +${e.breakdown.progress}`} tone="info" /> : null}
                </View>
              </Card>
            ))
          )}

          <SectionTitle>Como a nota é calculada</SectionTitle>
          <Card>
            <ThemedText type="small">• Cada RA positivo: {r.criteria.weights.positive_ra} pt</ThemedText>
            <ThemedText type="small">• Cada RA negativo: {r.criteria.weights.negative_ra} pt</ThemedText>
            <ThemedText type="small">• Presença: até {r.criteria.weights.attendance_rate} pt (proporcional)</ThemedText>
            <ThemedText type="small">• Fardamento e calçado adequados: até {r.criteria.weights.uniform_rate} pt</ThemedText>
            <ThemedText type="small">• Progresso em relação ao período anterior: {r.criteria.weights.progress} pt por unidade</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Aparecem apenas os {r.criteria.top_n} maiores destaques. Estudantes que não se destacaram não são listados.
            </ThemedText>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  pos: { minWidth: 36, alignItems: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
