import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, Empty, ErrorView, Loading, Screen, SectionTitle, StatTile, type Tone } from '@/components/ui/kit';
import { WorkSelector } from '@/components/work-selector';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatDayLong, formatRaCode } from '@/lib/format';
import { downloadPdf, pdfFileName } from '@/lib/pdf';
import type { ClassroomReport, RaCode, TimelineItem } from '@/lib/types';
import { useWork } from '@/lib/work-context';

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** Barra empilhada com legenda: mostra a divisão de um total em partes coloridas. */
function StackedBar({ segments, label }: { segments: { value: number; color: string; label: string }[]; label: string }) {
  const theme = useTheme();
  const shown = segments.filter((s) => s.value > 0);
  return (
    <View style={styles.gapSmall}>
      <View
        accessible
        accessibilityLabel={`${label}: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}
        style={[styles.bar, { backgroundColor: theme.border }]}>
        {shown.map((s) => (
          <View key={s.label} style={{ flex: s.value, backgroundColor: s.color }} />
        ))}
      </View>
      <View style={styles.legend}>
        {segments.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <ThemedText type="caption">
              {s.label}: {s.value}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Linha "chave: valor" de uma lista dentro de um card. */
function Line({ left, right, onPress }: { left: ReactNode; right?: ReactNode; onPress?: () => void }) {
  const body = (
    <View style={styles.line}>
      <View style={styles.flex}>{left}</View>
      {right}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** Dashboard com tudo o que foi registrado para a turma no dia selecionado. */
export default function DayDashboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { classroom, classroomId, date } = useWork();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function generatePdf() {
    if (!classroomId) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadPdf(
        `/reports/classrooms/${classroomId}/day?date=${date}&format=pdf`,
        pdfFileName('registros-do-dia', classroom?.name ?? 'turma', date),
        `Registros do dia - ${classroom?.name ?? ''}`
      );
    } catch (e: any) {
      setPdfError(e?.message ?? 'Não foi possível gerar o PDF.');
    } finally {
      setPdfBusy(false);
    }
  }

  const report = useAsync(
    () => api<ClassroomReport>(`/reports/classrooms/${classroomId}`, { query: { from: date, to: date, include_items: true } }),
    [classroomId, date],
    { enabled: !!classroomId, reloadOnFocus: true }
  );
  const roster = useAsync(
    () => api<{ start_time: string | null }>('/attendances/roster', { query: { classroom_id: classroomId, date } }),
    [classroomId, date],
    { enabled: !!classroomId, reloadOnFocus: true }
  );
  const codes = useAsync(() => api<{ data: RaCode[] }>('/ra-codes').then((r) => r.data), []);

  const d = useMemo(() => {
    const rep = report.data;
    if (!rep) return null;
    const names = new Map(rep.students.map((s) => [s.student.id, s.student.full_name]));
    const name = (id: number) => names.get(id) ?? `Estudante ${id}`;
    const items: TimelineItem[] = rep.students.flatMap((s) => s.items ?? []);
    const ofType = (t: TimelineItem['type']) => items.filter((i) => i.type === t);

    const attendance = new Map<number, TimelineItem>();
    for (const i of ofType('attendance')) attendance.set(i.data.student_id, i);
    const uniform = new Map<number, TimelineItem>();
    for (const i of ofType('uniform_check')) uniform.set(i.data.student_id, i);

    const att = [...attendance.values()];
    const late = att.filter((i) => i.data.status === 'late').sort((a, b) => String(a.data.arrival_time ?? '99').localeCompare(String(b.data.arrival_time ?? '99')));
    const absent = att.filter((i) => i.data.status === 'absent');
    const present = att.filter((i) => i.data.status === 'present');
    const pending = rep.students.filter((s) => !attendance.has(s.student.id));
    const uniformBad = [...uniform.values()].filter((i) => i.data.uniform_status === 'inadequate' || i.data.footwear_status === 'inadequate');
    const occurrences = ofType('occurrence').sort((a, b) => b.registered_at.localeCompare(a.registered_at));

    return {
      rep,
      name,
      late,
      absent,
      present,
      pending,
      attendance,
      uniform,
      uniformBad,
      occurrences,
      notifications: ofType('notification'),
      referrals: ofType('referral'),
      observations: ofType('observation'),
      lessons: (rep.lessons.items?.[0]?.lessons ?? []).slice().sort((a, b) => a.period - b.period),
    };
  }, [report.data]);

  const codeName = (code: number) => codes.data?.find((c) => c.code === code)?.description ?? null;
  const reload = () => (report.reload(), roster.reload());

  return (
    <Screen edges={['bottom']} refreshing={report.refreshing} onRefresh={reload}>
      <WorkSelector />

      {report.loading ? (
        <Loading />
      ) : report.error ? (
        <ErrorView error={report.error} onRetry={report.reload} />
      ) : !d ? null : (
        (() => {
          const t = d.rep.totals;
          const registered = t.attendance.records;
          const attended = t.attendance.present + t.attendance.late;
          const latePct = pct(t.attendance.late, attended);
          const onTimePct = attended ? 100 - latePct : 0;
          const absentPct = pct(t.attendance.absent, registered);
          const unjustified = t.attendance.absent - t.attendance.absent_justified;
          const anything =
            registered || t.uniform.records || t.occurrences.total || t.notifications.total || t.referrals.total || t.observations.total || d.lessons.length;

          return (
            <>
              <Card>
                <ThemedText type="heading">{classroom?.name ?? d.rep.classroom.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDayLong(date)}
                </ThemedText>
                <View style={styles.badges}>
                  <Badge label={roster.data?.start_time ? `Início da aula: ${roster.data.start_time}` : 'Início da aula não informado'} tone={roster.data?.start_time ? 'info' : 'neutral'} />
                  <Badge label={`${d.rep.students.length} estudantes`} />
                </View>
                <Button label="Gerar PDF" onPress={generatePdf} loading={pdfBusy} />
                {pdfError ? (
                  <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
                    {pdfError}
                  </ThemedText>
                ) : null}
              </Card>

              {!anything ? <Empty title="Nenhum registro neste dia" message="Faça a chamada, o checklist ou lance um RA para ver o painel." /> : null}

              {/* ------------------------------------------------ Frequência */}
              <SectionTitle>Frequência</SectionTitle>
              <View style={styles.tiles}>
                <StatTile label="Presentes" value={t.attendance.present} tone="positive" />
                <StatTile label="Atrasos" value={t.attendance.late} tone={t.attendance.late ? 'warning' : 'neutral'} />
                <StatTile label="Faltas" value={t.attendance.absent} tone={t.attendance.absent ? 'negative' : 'neutral'} />
                <StatTile label="Justificadas" value={t.attendance.absent_justified} />
                <StatTile label="Sem registro" value={d.pending.length} tone={d.pending.length ? 'warning' : 'neutral'} />
              </View>
              <Card>
                <StackedBar
                  label="Distribuição da frequência"
                  segments={[
                    { label: 'No horário', value: t.attendance.present, color: theme.success },
                    { label: 'Atrasados', value: t.attendance.late, color: theme.warning },
                    { label: 'Faltas', value: t.attendance.absent, color: theme.danger },
                    { label: 'Sem registro', value: d.pending.length, color: theme.textSecondary },
                  ]}
                />
                {registered ? (
                  <View style={styles.gapSmall}>
                    {attended ? (
                      <>
                        <ThemedText type="small">
                          {onTimePct}% chegou no horário ({t.attendance.present} de {attended})
                        </ThemedText>
                        <ThemedText type="small">
                          {latePct}% chegou atrasado ({t.attendance.late} de {attended})
                        </ThemedText>
                      </>
                    ) : null}
                    <ThemedText type="small">
                      {absentPct}% faltou ({t.attendance.absent} de {registered})
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Faltas justificadas: {t.attendance.absent_justified} · não justificadas: {unjustified}
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    A chamada deste dia ainda não foi registrada.
                  </ThemedText>
                )}
              </Card>

              {d.late.length ? (
                <Card tone="warning">
                  <ThemedText type="smallBold">Chegaram atrasados</ThemedText>
                  {d.late.map((i) => (
                    <Line
                      key={i.id}
                      onPress={() => router.push(`/estudante/${i.data.student_id}`)}
                      left={<ThemedText type="small">{d.name(i.data.student_id)}</ThemedText>}
                      right={<ThemedText type="smallBold">{i.data.arrival_time ? `às ${i.data.arrival_time}` : 'horário não informado'}</ThemedText>}
                    />
                  ))}
                </Card>
              ) : null}

              {d.absent.length ? (
                <Card tone="negative">
                  <ThemedText type="smallBold">Faltas</ThemedText>
                  {d.absent.map((i) => (
                    <Line
                      key={i.id}
                      onPress={() => router.push(`/estudante/${i.data.student_id}`)}
                      left={
                        <>
                          <ThemedText type="small">{d.name(i.data.student_id)}</ThemedText>
                          {i.data.is_justified && i.data.note ? (
                            <ThemedText type="caption" themeColor="textSecondary">
                              Motivo: {i.data.note}
                            </ThemedText>
                          ) : null}
                        </>
                      }
                      right={<Badge label={i.data.is_justified ? 'Justificada' : 'Sem justificativa'} tone={i.data.is_justified ? 'info' : 'negative'} />}
                    />
                  ))}
                </Card>
              ) : null}

              {d.pending.length && registered ? (
                <Card>
                  <ThemedText type="smallBold">Sem registro de frequência</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {d.pending.map((s) => s.student.full_name).join(' · ')}
                  </ThemedText>
                </Card>
              ) : null}

              {/* ------------------------------------------------ Fardamento */}
              <SectionTitle>Fardamento e calçado</SectionTitle>
              {t.uniform.records ? (
                <Card>
                  <ThemedText type="smallBold">Fardamento</ThemedText>
                  <StackedBar
                    label="Fardamento"
                    segments={[
                      { label: 'Adequado', value: t.uniform.uniform_adequate, color: theme.success },
                      { label: 'Inadequado', value: t.uniform.uniform_inadequate, color: theme.danger },
                      { label: 'Não observado', value: Math.max(0, t.uniform.records - t.uniform.uniform_adequate - t.uniform.uniform_inadequate), color: theme.textSecondary },
                    ]}
                  />
                  <ThemedText type="smallBold">Calçado</ThemedText>
                  <StackedBar
                    label="Calçado"
                    segments={[
                      { label: 'Adequado', value: t.uniform.footwear_adequate, color: theme.success },
                      { label: 'Inadequado', value: t.uniform.footwear_inadequate, color: theme.danger },
                      { label: 'Não observado', value: Math.max(0, t.uniform.records - t.uniform.footwear_adequate - t.uniform.footwear_inadequate), color: theme.textSecondary },
                    ]}
                  />
                  {d.uniformBad.length ? (
                    <View style={styles.gapSmall}>
                      <ThemedText type="smallBold">Com inadequação</ThemedText>
                      {d.uniformBad.map((i) => (
                        <Line
                          key={i.id}
                          onPress={() => router.push(`/estudante/${i.data.student_id}`)}
                          left={
                            <>
                              <ThemedText type="small">{d.name(i.data.student_id)}</ThemedText>
                              {i.data.note ? (
                                <ThemedText type="caption" themeColor="textSecondary">
                                  {i.data.note}
                                </ThemedText>
                              ) : null}
                            </>
                          }
                          right={
                            <View style={styles.badges}>
                              {i.data.uniform_status === 'inadequate' ? <Badge label="Fardamento" tone="warning" /> : null}
                              {i.data.footwear_status === 'inadequate' ? <Badge label="Calçado" tone="warning" /> : null}
                            </View>
                          }
                        />
                      ))}
                    </View>
                  ) : (
                    <ThemedText type="small" themeColor="success">
                      Todos adequados.
                    </ThemedText>
                  )}
                </Card>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  O checklist de fardamento deste dia ainda não foi feito.
                </ThemedText>
              )}

              {/* ------------------------------------------------ Aulas */}
              <SectionTitle>Aulas</SectionTitle>
              <View style={styles.tiles}>
                <StatTile label="Previstas" value={d.rep.lessons.planned_lessons} />
                <StatTile label="Registradas" value={d.rep.lessons.registered_lessons} tone="positive" />
                <StatTile label="Não identificadas" value={d.rep.lessons.not_identified_lessons} tone={d.rep.lessons.not_identified_lessons ? 'warning' : 'neutral'} />
              </View>
              {d.lessons.length ? (
                d.lessons.map((l) => (
                  <Card key={l.period} tone={l.not_identified ? 'warning' : 'neutral'}>
                    <View style={styles.between}>
                      <ThemedText type="smallBold">
                        {l.period}ª aula{l.subject ? ` · ${l.subject}` : ''}
                      </ThemedText>
                      {l.not_identified ? <Badge label="Não identificado" tone="warning" /> : null}
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {l.teacher_name ?? 'Professor não informado'}
                    </ThemedText>
                    {l.not_identified ? (
                      l.not_identified_reason ? <ThemedText type="small">Motivo: {l.not_identified_reason}</ThemedText> : null
                    ) : (
                      <>
                        {l.content ? <ThemedText type="small">Conteúdo: {l.content}</ThemedText> : null}
                        {l.progress ? <ThemedText type="small">Andamento: {l.progress}</ThemedText> : null}
                        {l.notes ? <ThemedText type="caption" themeColor="textSecondary">Obs.: {l.notes}</ThemedText> : null}
                      </>
                    )}
                  </Card>
                ))
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Nenhuma aula registrada neste dia.
                </ThemedText>
              )}

              {/* ------------------------------------------------ RAs */}
              <SectionTitle>Registros acadêmicos (RA)</SectionTitle>
              <View style={styles.tiles}>
                <StatTile label="Total" value={t.occurrences.total} />
                <StatTile label="Positivos" value={t.occurrences.positive} tone="positive" />
                <StatTile label="Negativos" value={t.occurrences.negative} tone={t.occurrences.negative ? 'negative' : 'neutral'} />
              </View>
              {t.occurrences.total ? (
                <Card>
                  <StackedBar
                    label="RAs positivos e negativos"
                    segments={[
                      { label: 'Positivos', value: t.occurrences.positive, color: theme.success },
                      { label: 'Negativos', value: t.occurrences.negative, color: theme.danger },
                    ]}
                  />
                </Card>
              ) : null}
              {d.occurrences.length ? (
                d.occurrences.map((o) => {
                  const positive = o.data.polarity === 'positive';
                  const tone: Tone = positive ? 'positive' : 'negative';
                  const cname = codeName(o.data.ra_code);
                  return (
                    <Pressable key={o.id} accessibilityRole="button" onPress={() => router.push(`/ocorrencia/${o.id}`)}>
                      <Card tone={tone}>
                        <View style={styles.between}>
                          <ThemedText type="smallBold">{d.name(o.data.student_id)}</ThemedText>
                          <Badge label={`RA ${formatRaCode(o.data.ra_code)}${cname ? ` · ${cname}` : ''}`} tone={tone} />
                        </View>
                        <ThemedText type="small">{o.data.description}</ThemedText>
                        {o.data.polarity_divergent ? <Badge label="Divergência: conferir" tone="warning" /> : null}
                      </Card>
                    </Pressable>
                  );
                })
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Nenhum RA neste dia.
                </ThemedText>
              )}

              {/* ------------------------------------------------ Eventos */}
              {d.notifications.length || d.referrals.length || d.observations.length ? (
                <>
                  <SectionTitle>Notificações, encaminhamentos e observações</SectionTitle>
                  {d.notifications.map((i) => (
                    <Card key={`n${i.id}`}>
                      <ThemedText type="smallBold">Notificação · {d.name(i.data.student_id)}</ThemedText>
                      <ThemedText type="small">{i.data.reason}</ThemedText>
                    </Card>
                  ))}
                  {d.referrals.map((i) => (
                    <Card key={`r${i.id}`}>
                      <ThemedText type="smallBold">Encaminhamento · {d.name(i.data.student_id)}</ThemedText>
                      <ThemedText type="small">{i.data.reason}</ThemedText>
                    </Card>
                  ))}
                  {d.observations.map((i) => (
                    <Card key={`o${i.id}`}>
                      <ThemedText type="smallBold">Observação · {d.name(i.data.student_id)}</ThemedText>
                      <ThemedText type="small">{i.data.content}</ThemedText>
                    </Card>
                  ))}
                </>
              ) : null}

              {/* ------------------------------------------------ Por estudante */}
              <SectionTitle>Por estudante</SectionTitle>
              {d.rep.students.map(({ student, totals }) => {
                const a = d.attendance.get(student.id);
                const u = d.uniform.get(student.id);
                const status = a?.data.status as string | undefined;
                return (
                  <Pressable key={student.id} accessibilityRole="button" accessibilityLabel={`Abrir ficha de ${student.full_name}`} onPress={() => router.push(`/estudante/${student.id}`)}>
                    <Card>
                      <View style={styles.between}>
                        <ThemedText type="smallBold" style={styles.flex}>
                          {student.full_name}
                        </ThemedText>
                        <ThemedText type="default" themeColor="textSecondary">›</ThemedText>
                      </View>
                      <View style={styles.badges}>
                        <Badge
                          label={status === 'present' ? 'Presente' : status === 'late' ? `Atraso${a?.data.arrival_time ? ` ${a.data.arrival_time}` : ''}` : status === 'absent' ? (a?.data.is_justified ? 'Falta justificada' : 'Falta') : 'Sem chamada'}
                          tone={status === 'present' ? 'positive' : status === 'late' ? 'warning' : status === 'absent' ? 'negative' : 'neutral'}
                        />
                        {u ? (
                          <Badge
                            label={u.data.uniform_status === 'inadequate' || u.data.footwear_status === 'inadequate' ? 'Fardamento: atenção' : 'Fardamento ok'}
                            tone={u.data.uniform_status === 'inadequate' || u.data.footwear_status === 'inadequate' ? 'warning' : 'positive'}
                          />
                        ) : null}
                        {totals.occurrences.positive ? <Badge label={`RA+ ${totals.occurrences.positive}`} tone="positive" /> : null}
                        {totals.occurrences.negative ? <Badge label={`RA− ${totals.occurrences.negative}`} tone="negative" /> : null}
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </>
          );
        })()
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  gapSmall: { gap: 6 },
  bar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 4 },
});
