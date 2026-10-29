import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OccurrenceFlags, RaBadge, useCanWrite, useIsStaff } from '@/components/domain';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorView, Field, Loading, Screen, SectionTitle } from '@/components/ui/kit';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import type { AuditLog, Occurrence, Paginated, Warning } from '@/lib/types';

const FIELD_LABELS: Record<string, string> = {
  description: 'Descrição',
  ra_code: 'Código RA',
  polarity: 'Polaridade',
  occurred_on: 'Data do acontecimento',
  context: 'Contexto',
  lesson_period: 'Aula',
  status: 'Situação',
  cancel_reason: 'Motivo do cancelamento',
  cancelled_at: 'Cancelado em',
  possible_duplicate_of_id: 'Duplicidade com',
  duplicate_reviewed_at: 'Duplicidade revisada em',
  polarity_divergent: 'Divergência de polaridade',
};
const HIDDEN_CHANGE_FIELDS = new Set(['cancelled_by', 'duplicate_reviewed_by']);

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

export default function OccurrenceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const canWrite = useCanWrite();
  const staff = useIsStaff();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const detail = useAsync(() => api<{ occurrence: Occurrence; warnings: Warning[] }>(`/occurrences/${id}`), [id], { reloadOnFocus: true });
  // CA06 — histórico de alterações com valor anterior, novo valor, autor e data (administração/coordenação).
  const audit = useAsync(
    () => api<Paginated<AuditLog>>('/audit-logs', { query: { entity: 'occurrences', entity_id: id } }).then((r) => r.data),
    [id, detail.data?.occurrence.updated_at],
    { enabled: staff }
  );

  const o = detail.data?.occurrence;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      setCancelling(false);
      setReason('');
      await detail.reload();
      await audit.reload();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (detail.loading) return <Screen edges={['bottom']}><Loading /></Screen>;
  if (detail.error || !o) return <Screen edges={['bottom']}><ErrorView error={detail.error ?? new Error('Registro não encontrado.')} onRetry={detail.reload} /></Screen>;

  return (
    <Screen edges={['bottom']} refreshing={detail.refreshing} onRefresh={detail.reload}>
      <Card tone={o.polarity === 'positive' ? 'positive' : 'negative'}>
        <RaBadge code={o.ra_code} polarity={o.polarity} />
        <ThemedText type="heading">{o.student?.full_name}</ThemedText>
        <OccurrenceFlags occurrence={o} />
        <ThemedText type="default">{o.description}</ThemedText>
        {o.context ? <ThemedText type="small" themeColor="textSecondary">Contexto: {o.context}</ThemedText> : null}
        {o.lesson_period ? <ThemedText type="small" themeColor="textSecondary">Aula: {o.lesson_period}ª</ThemedText> : null}
      </Card>

      {/* RN04: data do fato e data do cadastro são informações distintas */}
      <Card>
        <ThemedText type="small">Data do acontecimento: <ThemedText type="smallBold">{formatDate(o.occurred_on)}</ThemedText></ThemedText>
        <ThemedText type="small">Cadastrado em: <ThemedText type="smallBold">{formatDate(o.created_at)}</ThemedText></ThemedText>
        {o.source === 'legacy' ? <ThemedText type="caption" themeColor="textSecondary">Registro antigo (importado).</ThemedText> : null}
      </Card>

      {detail.data?.warnings.map((w) => (
        <Card key={w.code} tone="warning">
          <ThemedText type="small">{w.message}</ThemedText>
        </Card>
      ))}

      {o.status === 'cancelled' ? (
        <Card>
          <ThemedText type="smallBold">Registro cancelado</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{o.cancel_reason}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">O registro foi preservado no histórico; não entra nos totais.</ThemedText>
        </Card>
      ) : (
        <View style={styles.actions}>
          {user?.role === 'admin' && o.polarity_divergent ? (
            <Button label={`Alinhar polaridade ao código (${o.expected_polarity === 'positive' ? 'positivo' : 'negativo'})`} variant="secondary" loading={busy} onPress={() => run(() => api(`/occurrences/${id}/resolve-divergence`, { method: 'POST' }))} />
          ) : null}
          {staff && o.possible_duplicate_of_id && o.needs_review ? (
            <Button label="Marcar duplicidade como revisada" variant="secondary" loading={busy} onPress={() => run(() => api(`/occurrences/${id}/review-duplicate`, { method: 'POST' }))} />
          ) : null}
          {canWrite && !cancelling ? <Button label="Cancelar registro" variant="secondary" onPress={() => setCancelling(true)} /> : null}
        </View>
      )}

      {cancelling ? (
        <Card tone="negative">
          <ThemedText type="smallBold">Cancelar registro</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">O registro não é apagado: fica no histórico com o motivo.</ThemedText>
          <Field label="Motivo do cancelamento" value={reason} onChangeText={setReason} multiline />
          <View style={styles.row}>
            <Button label="Voltar" variant="ghost" small onPress={() => setCancelling(false)} style={styles.flex} />
            <Button label="Confirmar cancelamento" variant="danger" small disabled={reason.trim().length < 3} loading={busy} onPress={() => run(() => api(`/occurrences/${id}/cancel`, { method: 'POST', body: { reason: reason.trim() } }))} style={styles.flex} />
          </View>
        </Card>
      ) : null}
      {actionError ? <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">{actionError}</ThemedText> : null}

      {staff ? (
        <>
          <SectionTitle>Histórico de alterações</SectionTitle>
          {audit.loading ? <Loading /> : audit.error ? <ErrorView error={audit.error} onRetry={audit.reload} /> : (
            (audit.data ?? []).map((log) => (
              <Card key={log.id}>
                <ThemedText type="smallBold">
                  {log.action === 'create' ? 'Criado' : log.action === 'cancel' ? 'Cancelado' : 'Alterado'} por {log.user?.full_name ?? 'sistema'}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">{formatDate(log.created_at)} · {log.created_at.slice(11, 16)}</ThemedText>
                {log.action !== 'create'
                  ? Object.entries(log.changes)
                      .filter(([k]) => !HIDDEN_CHANGE_FIELDS.has(k))
                      .map(([k, v]) => (
                        <ThemedText key={k} type="small">
                          {FIELD_LABELS[k] ?? k}: <ThemedText type="small" themeColor="textSecondary">{show(v.old)}</ThemedText> → <ThemedText type="smallBold">{show(v.new)}</ThemedText>
                        </ThemedText>
                      ))
                  : null}
              </Card>
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
