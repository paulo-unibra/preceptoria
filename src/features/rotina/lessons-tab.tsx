import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useCanWrite } from '@/components/domain';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, ErrorView, Field, Loading, Select, SwitchRow } from '@/components/ui/kit';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { api } from '@/lib/api';
import type { Lesson, LessonDay } from '@/lib/types';
import { useWork } from '@/lib/work-context';

/** Professores (dados fictícios de teste). */
const TEACHERS = [
  'Prof. Carlos Almeida',
  'Profa. Mariana Souza',
  'Prof. Ricardo Menezes',
  'Profa. Patrícia Lima',
  'Prof. André Barbosa',
  'Profa. Fernanda Costa',
  'Prof. Eduardo Rocha',
  'Profa. Juliana Martins',
  'Prof. Marcos Ribeiro',
  'Profa. Luciana Ferreira',
];

/** Componentes curriculares (BNCC – Ensino Fundamental). */
const SUBJECTS = ['Língua Portuguesa', 'Matemática', 'Ciências', 'História', 'Geografia', 'Arte', 'Educação Física', 'Língua Inglesa', 'Ensino Religioso'];

type Draft = Omit<Lesson, 'id' | 'is_complete'> & { existing?: boolean };

const blank = (period: number): Draft => ({
  period,
  teacher_name: '',
  subject: '',
  content: '',
  progress: '',
  notes: '',
  not_identified: false,
  not_identified_reason: '',
});

const textFields: (keyof Draft)[] = ['teacher_name', 'subject', 'content', 'progress', 'notes', 'not_identified_reason'];

/** RF-06/RF-07 — registro diário das aulas, com a opção explícita "Não identificado". */
export function LessonsTab() {
  const { classroomId, date } = useWork();
  const canWrite = useCanWrite();
  const [planned, setPlanned] = useState(5);
  const [lessons, setLessons] = useState<Record<number, Draft>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const day = useAsync(
    () => api<{ data: LessonDay[] }>('/lesson-days', { query: { classroom_id: classroomId, date } }).then((r) => r.data[0] ?? null),
    [classroomId, date],
    { enabled: !!classroomId }
  );

  useEffect(() => {
    if (day.loading) return;
    const d = day.data;
    setPlanned(d?.planned_lessons ?? 5);
    const next: Record<number, Draft> = {};
    for (const l of d?.lessons ?? []) {
      next[l.period] = {
        period: l.period,
        teacher_name: l.teacher_name ?? '',
        subject: l.subject ?? '',
        content: l.content ?? '',
        progress: l.progress ?? '',
        notes: l.notes ?? '',
        not_identified: l.not_identified,
        not_identified_reason: l.not_identified_reason ?? '',
        existing: true,
      };
    }
    setLessons(next);
    setDirty(false);
    setMessage(null);
  }, [day.data, day.loading]);

  const highestFilled = Math.max(0, ...Object.keys(lessons).map(Number).filter((p) => lessons[p].existing));

  const change = (period: number, patch: Partial<Draft>) => {
    setLessons((all) => ({ ...all, [period]: { ...blank(period), ...all[period], ...patch } }));
    setDirty(true);
    setMessage(null);
  };

  const toggleNotIdentified = (period: number, on: boolean) => {
    // Em "Não identificado" nenhum conteúdo é aceito: nada é inventado (PDF, seção 8).
    change(period, on ? { not_identified: true, content: '', progress: '', notes: '' } : { not_identified: false, not_identified_reason: '' });
  };

  const hasContent = (l?: Draft) => !!l && (l.not_identified || l.existing || textFields.some((f) => String(l[f] ?? '').trim()));

  async function save() {
    const payload = Array.from({ length: planned }, (_, i) => i + 1)
      .filter((p) => hasContent(lessons[p]))
      .map((p) => {
        const l = lessons[p];
        const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
        return {
          period: p,
          teacher_name: clean(l.teacher_name),
          subject: clean(l.subject),
          content: l.not_identified ? null : clean(l.content),
          progress: l.not_identified ? null : clean(l.progress),
          notes: l.not_identified ? null : clean(l.notes),
          not_identified: l.not_identified,
          not_identified_reason: l.not_identified ? clean(l.not_identified_reason) : null,
        };
      });
    setSaving(true);
    try {
      await api('/lesson-days', { method: 'PUT', body: { classroom_id: classroomId, date, planned_lessons: planned, lessons: payload } });
      setMessage({ text: 'Aulas do dia salvas.', ok: true });
      setDirty(false);
      await day.reload();
    } catch (e: any) {
      setMessage({ text: e.message, ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (day.loading) return <Loading />;
  if (day.error) return <ErrorView error={day.error} onRetry={day.reload} />;

  return (
    <View style={styles.gap}>
      <Card>
        <ThemedText type="smallBold">Aulas previstas no dia</ThemedText>
        <View style={styles.stepper}>
          <Button label="−" variant="secondary" small disabled={!canWrite || planned <= Math.max(1, highestFilled)} onPress={() => (setPlanned((n) => n - 1), setDirty(true))} style={styles.stepBtn} />
          <ThemedText type="heading" style={styles.plannedValue} accessibilityLabel={`${planned} aulas previstas`}>
            {planned}
          </ThemedText>
          <Button label="+" variant="secondary" small disabled={!canWrite || planned >= 12} onPress={() => (setPlanned((n) => n + 1), setDirty(true))} style={styles.stepBtn} />
        </View>
        {!canWrite ? (
          <ThemedText type="caption" themeColor="textSecondary">
            Seu perfil tem acesso somente de consulta.
          </ThemedText>
        ) : null}
        {message ? (
          <ThemedText type="small" themeColor={message.ok ? 'success' : 'danger'} accessibilityLiveRegion="polite">
            {message.text}
          </ThemedText>
        ) : null}
      </Card>

      {Array.from({ length: planned }, (_, i) => i + 1).map((period) => {
        const l = lessons[period] ?? blank(period);
        const off = !canWrite;
        return (
          <Card key={period} tone={l.not_identified ? 'warning' : 'neutral'}>
            <View style={styles.titleRow}>
              <ThemedText type="smallBold">{period}ª aula</ThemedText>
              {l.not_identified ? <Badge label="Não identificado" tone="warning" /> : null}
            </View>
            <SwitchRow label="Não identificado (não acompanhei esta aula)" value={l.not_identified} disabled={off} onValueChange={(v) => toggleNotIdentified(period, v)} />
            {l.not_identified ? (
              <Field label="Motivo (opcional)" value={l.not_identified_reason ?? ''} editable={!off} onChangeText={(v) => change(period, { not_identified_reason: v })} placeholder="Ex.: substituindo um professor" />
            ) : null}
            <Select label="Professor(a)" value={l.teacher_name || null} options={TEACHERS} disabled={off} placeholder="Selecione o(a) professor(a)" onChange={(v) => change(period, { teacher_name: v ?? '' })} />
            <Select label="Componente curricular" value={l.subject || null} options={SUBJECTS} disabled={off} placeholder="Selecione a matéria" onChange={(v) => change(period, { subject: v ?? '' })} />
            {!l.not_identified ? (
              <>
                <Field label="Conteúdo" value={l.content ?? ''} editable={!off} multiline onChangeText={(v) => change(period, { content: v })} />
                <Field label="Andamento da aula" value={l.progress ?? ''} editable={!off} multiline onChangeText={(v) => change(period, { progress: v })} />
                <Field label="Observações" value={l.notes ?? ''} editable={!off} multiline onChangeText={(v) => change(period, { notes: v })} />
              </>
            ) : null}
          </Card>
        );
      })}

      {canWrite ? <Button label={dirty ? 'Salvar aulas' : 'Salvo'} onPress={save} loading={saving} disabled={!dirty} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Spacing.two },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepBtn: { minWidth: 52 },
  plannedValue: { minWidth: 36, textAlign: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
