import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { RaLegend, StudentAvatar } from "@/components/domain";
import { ThemedText } from "@/components/themed-text";
import {
  Button,
  Card,
  Chip,
  ChipRow,
  ErrorView,
  Field,
  Loading,
  Screen,
  SectionTitle,
} from "@/components/ui/kit";
import { Spacing } from "@/constants/theme";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { addDays, formatDayLong, formatRaCode, todayISO } from "@/lib/format";
import type {
  Occurrence,
  Paginated,
  RaCode,
  Student,
  Warning,
} from "@/lib/types";
import { useWork } from "@/lib/work-context";

/** RF-08 — novo RA: estudante, código (positivo/negativo), data, descrição objetiva e contexto. */
export default function NewOccurrenceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string }>();
  const { classroomId, date: workDate } = useWork();

  const [studentId, setStudentId] = useState<number | null>(
    params.studentId ? Number(params.studentId) : null,
  );
  const [search, setSearch] = useState("");
  const [raCode, setRaCode] = useState<number | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [date, setDate] = useState(
    workDate > todayISO() ? todayISO() : workDate,
  );
  const [description, setDescription] = useState("");
  const [context, setContext] = useState("");
  const [period, setPeriod] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const codes = useAsync(
    () =>
      api<{ data: RaCode[] }>("/ra-codes", { query: { is_active: true } }).then(
        (r) => r.data,
      ),
    [],
  );
  const students = useAsync(
    () =>
      api<Paginated<Student>>("/students", {
        query: {
          classroom_id: classroomId,
          q: search || undefined,
          per_page: 200,
        },
      }).then((r) => r.data),
    [classroomId, search],
    { enabled: !!classroomId && !params.studentId },
  );
  const fixedStudent = useAsync(
    () =>
      api<{ student: Student }>(`/students/${params.studentId}`).then(
        (r) => r.student,
      ),
    [params.studentId],
    { enabled: !!params.studentId },
  );

  const selectedStudent =
    fixedStudent.data ?? students.data?.find((s) => s.id === studentId) ?? null;
  const selectedCode = codes.data?.find((c) => c.code === raCode) ?? null;
  const positives = codes.data?.filter((c) => c.polarity === "positive") ?? [];
  const negatives = codes.data?.filter((c) => c.polarity === "negative") ?? [];
  const canSubmit = !!studentId && !!raCode && description.trim().length >= 3;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await api<{ occurrence: Occurrence; warnings: Warning[] }>(
        "/occurrences",
        {
          method: "POST",
          body: {
            student_id: studentId,
            occurred_on: date,
            ra_code: raCode,
            description: description.trim(),
            context: context.trim() || null,
            lesson_period: period,
          },
        },
      );
      // RN08: duplicidade só é sinalizada; o registro foi salvo e segue para a conferência.
      router.replace(
        result.warnings.length
          ? `/ocorrencia/${result.occurrence.id}`
          : "/ocorrencias",
      );
    } catch (e: any) {
      setError(e.message);
      setFieldErrors(e.fieldErrors ?? {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      edges={["bottom"]}
      footer={
        <>
          {error ? (
            <ThemedText
              type="small"
              themeColor="danger"
              accessibilityLiveRegion="polite"
              style={styles.footerError}
            >
              {error}
            </ThemedText>
          ) : null}
          <Button
            label="Salvar registro"
            onPress={submit}
            loading={saving}
            disabled={!canSubmit}
          />
        </>
      }
    >
      <SectionTitle>1. Estudante</SectionTitle>
      {selectedStudent ? (
        <Card>
          <View style={styles.studentRow}>
            <StudentAvatar
              id={selectedStudent.id}
              name={selectedStudent.full_name}
            />
            <View style={styles.flex}>
              <ThemedText type="smallBold">
                {selectedStudent.full_name}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {selectedStudent.registration
                  ? `Matrícula ${selectedStudent.registration}`
                  : "Sem matrícula informada"}
              </ThemedText>
            </View>
            {!params.studentId ? (
              <Button
                label="Trocar"
                variant="ghost"
                small
                onPress={() => setStudentId(null)}
              />
            ) : null}
          </View>
        </Card>
      ) : (
        <>
          <Field
            label="Buscar estudante"
            value={search}
            onChangeText={setSearch}
            placeholder="Nome ou matrícula"
            error={fieldErrors.student_id}
          />
          {students.loading ? <Loading /> : null}
          {students.error ? (
            <ErrorView error={students.error} onRetry={students.reload} />
          ) : null}
          <ChipRow>
            {(students.data ?? []).map((s) => (
              <Chip
                key={s.id}
                label={s.full_name}
                onPress={() => setStudentId(s.id)}
              />
            ))}
          </ChipRow>
        </>
      )}

      <SectionTitle>2. Código do RA</SectionTitle>
      {codes.loading ? (
        <Loading />
      ) : codes.error ? (
        <ErrorView error={codes.error} onRetry={codes.reload} />
      ) : (
        <>
          <Button
            label={
              showLegend
                ? "Ocultar legenda dos códigos"
                : "Ver legenda dos códigos"
            }
            variant="secondary"
            small
            onPress={() => setShowLegend((v) => !v)}
          />
          {showLegend ? (
            <RaLegend
              codes={codes.data ?? []}
              selected={raCode}
              onSelect={setRaCode}
            />
          ) : null}
          <ThemedText type="caption" themeColor="success" style={styles.bold}>
            Positivos (01 a 09)
          </ThemedText>
          <ChipRow>
            {positives.map((c) => (
              <Chip
                key={c.code}
                label={formatRaCode(c.code)}
                tone="positive"
                selected={raCode === c.code}
                onPress={() => setRaCode(c.code)}
              />
            ))}
          </ChipRow>
          <ThemedText type="caption" themeColor="danger" style={styles.bold}>
            Negativos (10 a 21)
          </ThemedText>
          <ChipRow>
            {negatives.map((c) => (
              <Chip
                key={c.code}
                label={formatRaCode(c.code)}
                tone="negative"
                selected={raCode === c.code}
                onPress={() => setRaCode(c.code)}
              />
            ))}
          </ChipRow>
          {selectedCode ? (
            <Card
              tone={
                selectedCode.polarity === "positive" ? "positive" : "negative"
              }
            >
              <ThemedText type="smallBold">
                RA {formatRaCode(selectedCode.code)} ·{" "}
                {selectedCode.polarity === "positive" ? "Positivo" : "Negativo"}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {selectedCode.description ??
                  "A descrição oficial deste código ainda não foi cadastrada pela escola."}
              </ThemedText>
            </Card>
          ) : null}
          {fieldErrors.ra_code ? (
            <ThemedText type="caption" themeColor="danger">
              {fieldErrors.ra_code}
            </ThemedText>
          ) : null}
        </>
      )}

      <SectionTitle>3. DATA</SectionTitle>
      <Card>
        <ThemedText type="smallBold">Data do acontecimento</ThemedText>
        <View style={styles.dateRow}>
          <Button
            label="‹"
            variant="secondary"
            small
            onPress={() => setDate((d) => addDays(d, -1))}
            style={styles.arrow}
          />
          <ThemedText type="small" style={styles.dateText}>
            {formatDayLong(date)}
          </ThemedText>
          <Button
            label="›"
            variant="secondary"
            small
            disabled={date >= todayISO()}
            onPress={() => setDate((d) => addDays(d, 1))}
            style={styles.arrow}
          />
        </View>
      </Card>
      <Field
        label="Descrição objetiva"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Descreva o fato observado, sem juízo de valor."
        error={fieldErrors.description}
      />
      <Field
        label="Contexto (opcional)"
        value={context}
        onChangeText={setContext}
        placeholder="Ex.: sala de aula, recreio, atividade em grupo"
      />
      <ThemedText type="smallBold">Aula (opcional)</ThemedText>
      <ChipRow>
        {[1, 2, 3, 4, 5, 6].map((p) => (
          <Chip
            key={p}
            small
            label={`${p}ª`}
            selected={period === p}
            onPress={() => setPeriod(period === p ? null : p)}
          />
        ))}
      </ChipRow>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: "700" },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  dateText: { flex: 1, textAlign: "center" },
  arrow: { minWidth: 48 },
  footerError: { marginBottom: Spacing.two },
});
