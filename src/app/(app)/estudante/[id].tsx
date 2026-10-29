import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { StudentAvatar, useCanWrite } from '@/components/domain';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/ui/toast';
import { Badge, Button, Card, Chip, ChipRow, ErrorView, Loading, Screen, SectionTitle, StatTile } from '@/components/ui/kit';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { api } from '@/lib/api';
import { addDays, formatDate, formatRaCode, SHIFT_LABELS, todayISO } from '@/lib/format';
import type { Student, StudentHistory, TimelineItem } from '@/lib/types';

type Period = '7' | '30' | 'all';

const ATTENDANCE: Record<string, string> = { present: 'Presente', absent: 'Falta', late: 'Atraso' };
const CHECK: Record<string, string> = { adequate: 'adequado', inadequate: 'inadequado', not_observed: 'não observado' };
const REFERRAL: Record<string, string> = { open: 'aberto', in_progress: 'em andamento', resolved: 'resolvido', cancelled: 'cancelado' };

function describe(item: TimelineItem): string {
  const d = item.data;
  switch (item.type) {
    case 'attendance':
      return `${ATTENDANCE[d.status] ?? d.status}${d.arrival_time ? ` (chegou às ${d.arrival_time})` : ''}${d.is_justified ? ' · justificada' : ''}${d.note ? ` · ${d.note}` : ''}`;
    case 'uniform_check':
      return `Fardamento ${CHECK[d.uniform_status]} · calçado ${CHECK[d.footwear_status]}${d.note ? ` · ${d.note}` : ''}`;
    case 'occurrence':
      return d.description;
    case 'notification':
      return `Notificação: ${d.reason}`;
    case 'referral':
      return `${d.reason} (${REFERRAL[d.status] ?? d.status})`;
    case 'observation':
      return d.content;
  }
}

function toneOf(item: TimelineItem) {
  if (item.type === 'occurrence') return item.data.polarity === 'positive' ? 'positive' : 'negative';
  if (item.type === 'attendance') return item.data.status === 'absent' ? 'negative' : item.data.status === 'late' ? 'warning' : 'neutral';
  return 'neutral';
}

/** RF-04 + RF-09 — ficha do estudante e histórico cronológico, com totais do mesmo período. */
export default function StudentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [period, setPeriod] = useState<Period>('30');
  const { show: showToast, toast } = useToast();

  const range = useMemo(() => (period === 'all' ? {} : { from: addDays(todayISO(), -(Number(period) - 1)), to: todayISO() }), [period]);

  const student = useAsync(() => api<{ student: Student }>(`/students/${id}`).then((r) => r.student), [id]);
  const history = useAsync(() => api<StudentHistory>(`/students/${id}/history`, { query: range }), [id, range], { reloadOnFocus: true });
  // Todos os RAs do estudante, independentemente do período escolhido no histórico.
  const allRecords = useAsync(() => api<StudentHistory>(`/students/${id}/history`), [id], { reloadOnFocus: true });

  if (student.loading) return <Screen edges={['bottom']}><Loading /></Screen>;
  if (student.error || !student.data) return <Screen edges={['bottom']}><ErrorView error={student.error ?? new Error('Estudante não encontrado.')} onRetry={student.reload} /></Screen>;

  const s = student.data;
  const t = history.data?.totals;
  const ras = (allRecords.data?.items ?? []).filter((i) => i.type === 'occurrence');
  const raTotals = allRecords.data?.totals.occurrences;

  const renderItem = (item: TimelineItem) => {
    const body = (
      <Card tone={toneOf(item) === 'neutral' ? undefined : (toneOf(item) as any)} style={item.status === 'cancelled' ? styles.cancelled : undefined}>
        <View style={styles.itemHead}>
          <ThemedText type="smallBold">{item.type === 'occurrence' ? `RA ${formatRaCode(item.data.ra_code)}` : item.label}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">{formatDate(item.date)}</ThemedText>
        </View>
        <ThemedText type="small">{describe(item)}</ThemedText>
        {item.status === 'cancelled' ? <Badge label="Cancelado" /> : null}
        {item.type === 'occurrence' && item.data.polarity_divergent ? <Badge label="Divergência: conferir" tone="warning" /> : null}
      </Card>
    );
    return item.type === 'occurrence' ? (
      <Pressable key={`${item.type}-${item.id}`} accessibilityRole="button" onPress={() => router.push(`/ocorrencia/${item.id}`)}>
        {body}
      </Pressable>
    ) : (
      <View key={`${item.type}-${item.id}`}>{body}</View>
    );
  };
  const routine = (history.data?.items ?? []).filter((i) => i.type !== 'occurrence');

  return (
    <>
    <Screen edges={['bottom']} refreshing={history.refreshing} onRefresh={() => (student.reload(), history.reload(), allRecords.reload())}>
      <Card>
        <View style={styles.header}>
          <StudentAvatar id={s.id} name={s.full_name} hasPhoto={s.has_photo} size={72} />
          <View style={styles.flex}>
            <ThemedText type="heading">{s.full_name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {s.classroom ? `${s.classroom.name}${s.classroom.shift ? ` · ${SHIFT_LABELS[s.classroom.shift] ?? ''}` : ''}` : 'Sem turma'}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {s.registration ? `Matrícula ${s.registration}` : 'Sem matrícula'}
              {s.birth_date ? ` · Nasc. ${formatDate(s.birth_date)}` : ''}
            </ThemedText>
          </View>
        </View>
        {s.tracking_notes ? (
          <View style={styles.notes}>
            <ThemedText type="smallBold">Informações de acompanhamento</ThemedText>
            <ThemedText type="small">{s.tracking_notes}</ThemedText>
          </View>
        ) : null}
      </Card>

      <SectionTitle>Responsáveis</SectionTitle>
      {s.guardians?.length ? (
        s.guardians.map((g) => (
          <Card key={g.id} style={styles.guardian}>
            <View style={styles.flex}>
              <ThemedText type="smallBold">
                {g.full_name}
                {g.relationship ? ` · ${g.relationship}` : ''}
              </ThemedText>
              {g.phone ? (
                <Pressable accessibilityRole="link" accessibilityLabel={`Ligar para ${g.full_name}`} onPress={() => Linking.openURL(`tel:${g.phone!.replace(/[^\d+]/g, '')}`)}>
                  <ThemedText type="linkPrimary">{g.phone}</ThemedText>
                </Pressable>
              ) : (
                <ThemedText type="caption" themeColor="textSecondary">
                  Telefone indisponível para o seu perfil ou não informado.
                </ThemedText>
              )}
            </View>
            {canWrite ? <Button label="Notificar" small onPress={() => showToast('Responsável notificado por meio do Whatsapp')} /> : null}
          </Card>
        ))
      ) : (
        <ThemedText type="small" themeColor="textSecondary">Nenhum responsável cadastrado.</ThemedText>
      )}

      {canWrite ? <Button label="Novo registro (RA) para este estudante" onPress={() => router.push({ pathname: '/ocorrencia/nova', params: { studentId: String(s.id) } })} /> : null}

      <SectionTitle>Registros de RA</SectionTitle>
      {allRecords.loading ? (
        <Loading />
      ) : allRecords.error ? (
        <ErrorView error={allRecords.error} onRetry={allRecords.reload} />
      ) : (
        <>
          <View style={styles.tiles}>
            <StatTile label="Total de RAs" value={raTotals?.total ?? 0} />
            <StatTile label="RAs positivos" value={raTotals?.positive ?? 0} tone="positive" />
            <StatTile label="RAs negativos" value={raTotals?.negative ?? 0} tone={raTotals?.negative ? 'negative' : 'neutral'} />
          </View>
          {ras.length ? ras.map(renderItem) : <ThemedText type="small" themeColor="textSecondary">Nenhum RA registrado para este estudante.</ThemedText>}
        </>
      )}

      <SectionTitle>Frequência, fardamento e demais registros</SectionTitle>
      <ChipRow>
        <Chip label="7 dias" selected={period === '7'} onPress={() => setPeriod('7')} />
        <Chip label="30 dias" selected={period === '30'} onPress={() => setPeriod('30')} />
        <Chip label="Todo o período" selected={period === 'all'} onPress={() => setPeriod('all')} />
      </ChipRow>

      {history.loading ? (
        <Loading />
      ) : history.error ? (
        <ErrorView error={history.error} onRetry={history.reload} />
      ) : t ? (
        <>
          {/* RN07: faltas, notificações e RAs têm contagens separadas */}
          <View style={styles.tiles}>
            <StatTile label="Faltas" value={t.attendance.absent} tone={t.attendance.absent ? 'negative' : 'neutral'} />
            <StatTile label="Atrasos" value={t.attendance.late} tone={t.attendance.late ? 'warning' : 'neutral'} />
            <StatTile label="Notificações" value={t.notifications.total} />
            <StatTile label="Encaminhados" value={t.referrals.total} />
          </View>

          {!routine.length ? (
            <ThemedText type="small" themeColor="textSecondary">Nenhum registro no período.</ThemedText>
          ) : (
            routine.map(renderItem)
          )}
        </>
      ) : null}
    </Screen>
    {toast}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  guardian: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  header: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  notes: { gap: 2, marginTop: Spacing.two },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelled: { opacity: 0.6 },
});
