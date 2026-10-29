import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useCanWrite } from "@/components/domain";
import { ThemedText } from "@/components/themed-text";
import {
  Button,
  Card,
  Chip,
  ChipRow,
  Empty,
  ErrorView,
  Field,
  Loading,
} from "@/components/ui/kit";
import { Spacing } from "@/constants/theme";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type {
  ChecklistStatus,
  RosterStudent,
  UniformRecord,
} from "@/lib/types";
import { useWork } from "@/lib/work-context";

interface Draft {
  uniform: ChecklistStatus;
  footwear: ChecklistStatus;
  note: string;
}

const OPTIONS: {
  value: ChecklistStatus;
  label: string;
  tone: "positive" | "negative" | "neutral";
}[] = [
  { value: "adequate", label: "Adequado", tone: "positive" },
  { value: "inadequate", label: "Inadequado", tone: "negative" },
  { value: "not_observed", label: "Não observado", tone: "neutral" },
];

interface RosterRow {
  student: RosterStudent;
  check: UniformRecord | null;
}

/** RF-02 — checklist diário de fardamento e calçado, simples e rápido, com observação opcional. */
export function UniformTab() {
  const { classroomId, date } = useWork();
  const canWrite = useCanWrite();
  const [draft, setDraft] = useState<Record<number, Draft>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

  const roster = useAsync(
    () =>
      api<{ data: RosterRow[] }>("/uniform-checks/roster", {
        query: { classroom_id: classroomId, date },
      }).then((r) => r.data),
    [classroomId, date],
    { enabled: !!classroomId },
  );

  useEffect(() => {
    if (!roster.data) return;
    const next: Record<number, Draft> = {};
    for (const row of roster.data) {
      if (row.check)
        next[row.student.id] = {
          uniform: row.check.uniform_status,
          footwear: row.check.footwear_status,
          note: row.check.note ?? "",
        };
    }
    setDraft(next);
    setDirty(false);
    setMessage(null);
  }, [roster.data]);

  const update = (id: number, patch: Partial<Draft>) => {
    setDraft((d) => ({
      ...d,
      [id]: {
        ...(d[id] ?? {
          uniform: "not_observed",
          footwear: "not_observed",
          note: "",
        }),
        ...patch,
      },
    }));
    setDirty(true);
    setMessage(null);
  };

  const markAllAdequate = () => {
    setDraft((d) => {
      const next = { ...d };
      for (const row of roster.data ?? [])
        if (!next[row.student.id])
          next[row.student.id] = {
            uniform: "adequate",
            footwear: "adequate",
            note: "",
          };
      return next;
    });
    setDirty(true);
    setMessage(null);
  };

  async function save() {
    const records = Object.entries(draft).map(([id, d]) => ({
      student_id: Number(id),
      uniform_status: d.uniform,
      footwear_status: d.footwear,
      note: d.note.trim() || null,
    }));
    if (!records.length) return;
    setSaving(true);
    try {
      await api("/uniform-checks/bulk", {
        method: "PUT",
        body: { classroom_id: classroomId, date, records },
      });
      setDirty(false);
      setMessage({
        text: `Checklist salvo (${records.length} estudantes).`,
        ok: true,
      });
    } catch (e: any) {
      setMessage({ text: e.message, ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (roster.loading) return <Loading />;
  if (roster.error)
    return <ErrorView error={roster.error} onRetry={roster.reload} />;
  const rows = roster.data ?? [];
  if (!rows.length) return <Empty title="Nenhum estudante nesta turma" />;

  return (
    <View style={styles.gap}>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Marque “Não observado” quando não houver registro; o sistema não
          presume nada.
        </ThemedText>
        {canWrite ? (
          <View style={styles.actions}>
            <Button
              label="Marcar todos adequados"
              variant="secondary"
              small
              onPress={markAllAdequate}
              style={styles.flex}
            />
            <Button
              label={dirty ? "Salvar checklist" : "Salvo"}
              small
              onPress={save}
              loading={saving}
              disabled={!dirty}
              style={styles.flex}
            />
          </View>
        ) : (
          <ThemedText type="caption" themeColor="textSecondary">
            Seu perfil tem acesso somente de consulta.
          </ThemedText>
        )}
        {message ? (
          <ThemedText
            type="small"
            themeColor={message.ok ? "success" : "danger"}
            accessibilityLiveRegion="polite"
          >
            {message.text}
          </ThemedText>
        ) : null}
      </Card>

      {rows.map(({ student }) => {
        const d = draft[student.id];
        const hasIssue =
          d?.uniform === "inadequate" || d?.footwear === "inadequate";
        return (
          <Card key={student.id} tone={hasIssue ? "warning" : "neutral"}>
            <ThemedText type="smallBold">{student.full_name}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Fardamento
            </ThemedText>
            <ChipRow>
              {OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  small
                  label={o.label}
                  tone={o.tone}
                  selected={d?.uniform === o.value}
                  disabled={!canWrite}
                  onPress={() => update(student.id, { uniform: o.value })}
                />
              ))}
            </ChipRow>
            <ThemedText type="caption" themeColor="textSecondary">
              Calçado
            </ThemedText>
            <ChipRow>
              {OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  small
                  label={o.label}
                  tone={o.tone}
                  selected={d?.footwear === o.value}
                  disabled={!canWrite}
                  onPress={() => update(student.id, { footwear: o.value })}
                />
              ))}
            </ChipRow>
            {hasIssue ? (
              <Field
                label="Observação"
                value={d.note}
                editable={canWrite}
                onChangeText={(v) => update(student.id, { note: v })}
                placeholder="Ex.: chinelo, sem camisa da escola"
              />
            ) : null}
          </Card>
        );
      })}

      {canWrite ? (
        <Button
          label={dirty ? "Salvar checklist" : "Salvo"}
          onPress={save}
          loading={saving}
          disabled={!dirty}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Spacing.two },
  actions: { flexDirection: "row", gap: Spacing.two },
  flex: { flex: 1 },
});
