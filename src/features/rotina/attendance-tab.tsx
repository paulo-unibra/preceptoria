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
  SwitchRow,
} from "@/components/ui/kit";
import { Spacing } from "@/constants/theme";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type {
  AttendanceRecord,
  AttendanceStatus,
  RosterStudent,
} from "@/lib/types";
import { useWork } from "@/lib/work-context";

interface Draft {
  status: AttendanceStatus;
  arrival: string;
  justified: boolean;
  /** Motivo da falta justificada (opcional). */
  reason: string;
}

interface RosterRow {
  student: RosterStudent;
  attendance: AttendanceRecord | null;
}

interface RosterResponse {
  data: RosterRow[];
  /** Hora de início já gravada para a turma nesta data. */
  start_time: string | null;
  /** Último horário gravado para a turma (sugestão para as próximas chamadas). */
  last_start_time: string | null;
}

const OPTIONS: {
  status: AttendanceStatus;
  label: string;
  tone: "positive" | "negative" | "warning";
}[] = [
  { status: "present", label: "Presente", tone: "positive" },
  { status: "absent", label: "Falta", tone: "negative" },
  { status: "late", label: "Atraso", tone: "warning" },
];

/** Máscara de horário: só dígitos, formato HH:mm. */
function maskTime(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2
    ? `${digits.slice(0, 2)}:${digits.slice(2)}`
    : digits;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** RF-05 — presença, falta e atraso por turma, estudante e data. */
export function AttendanceTab() {
  const { classroomId, date } = useWork();
  const canWrite = useCanWrite();
  const [draft, setDraft] = useState<Record<number, Draft>>({});
  const [startTime, setStartTime] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

  const roster = useAsync(
    () =>
      api<RosterResponse>("/attendances/roster", {
        query: { classroom_id: classroomId, date },
      }),
    [classroomId, date],
    { enabled: !!classroomId },
  );

  // Carrega o que já foi registrado para a data.
  useEffect(() => {
    if (!roster.data) return;
    const next: Record<number, Draft> = {};
    for (const row of roster.data.data) {
      if (row.attendance) {
        next[row.student.id] = {
          status: row.attendance.status,
          arrival: row.attendance.arrival_time ?? "",
          justified: row.attendance.is_justified,
          reason: row.attendance.note ?? "",
        };
      }
    }
    setDraft(next);
    // Hora de início: a gravada na data ou, se ainda não houver chamada, o último horário da turma.
    setStartTime(roster.data.start_time ?? roster.data.last_start_time ?? "");
    setDirty(false);
    setMessage(null);
  }, [roster.data]);

  const update = (id: number, patch: Partial<Draft>) => {
    setDraft((d) => ({
      ...d,
      [id]: {
        ...(d[id] ?? { status: "present", arrival: "", justified: false, reason: "" }),
        ...patch,
      },
    }));
    setDirty(true);
    setMessage(null);
  };

  const markAllPresent = () => {
    setDraft((d) => {
      const next = { ...d };
      for (const row of roster.data?.data ?? [])
        if (!next[row.student.id])
          next[row.student.id] = {
            status: "present",
            arrival: "",
            justified: false,
            reason: "",
          };
      return next;
    });
    setDirty(true);
    setMessage(null);
  };

  async function save() {
    const records = Object.entries(draft).map(([id, d]) => ({
      student_id: Number(id),
      status: d.status,
      ...(d.status === "late" && d.arrival ? { arrival_time: d.arrival } : {}),
      ...(d.status === "absent" ? { is_justified: d.justified } : {}),
      // O motivo só vale para falta justificada; fora disso é descartado.
      ...(d.status === "absent" && d.justified && d.reason.trim()
        ? { note: d.reason.trim() }
        : {}),
    }));
    if (!records.length) return;
    if (!TIME_RE.test(startTime)) {
      setMessage({
        text: "Informe a hora de início da aula no formato HH:mm (ex.: 07:30).",
        ok: false,
      });
      return;
    }
    const invalid = Object.entries(draft).find(
      ([, d]) => d.status === "late" && d.arrival && !TIME_RE.test(d.arrival),
    );
    if (invalid) {
      setMessage({
        text: "Informe o horário de chegada no formato HH:mm (ex.: 07:45).",
        ok: false,
      });
      return;
    }
    setSaving(true);
    try {
      await api("/attendances/bulk", {
        method: "PUT",
        body: {
          classroom_id: classroomId,
          date,
          start_time: startTime,
          records,
        },
      });
      setDirty(false);
      setMessage({
        text: `Frequência salva (${records.length} estudantes).`,
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
  const rows = roster.data?.data ?? [];
  const suggested = !roster.data?.start_time && !!roster.data?.last_start_time;
  if (!rows.length)
    return (
      <Empty
        title="Nenhum estudante nesta turma"
        message="Peça à administração para enturmar os estudantes."
      />
    );

  const count = (s: AttendanceStatus) =>
    Object.values(draft).filter((d) => d.status === s).length;
  const pending = rows.length - Object.keys(draft).length;
  // Percentuais sobre quem compareceu (presentes + atrasados); no horário = 100% - atrasados.
  const attended = count("present") + count("late");
  const latePct = attended ? Math.round((count("late") / attended) * 100) : 0;
  const onTimePct = attended ? 100 - latePct : 0;
  const registered = Object.keys(draft).length;
  const absent = count("absent");
  const justified = Object.values(draft).filter(
    (d) => d.status === "absent" && d.justified,
  ).length;
  const absentPct = registered ? Math.round((absent / registered) * 100) : 0;

  return (
    <View style={styles.gap}>
      <Card>
        <ThemedText type="smallBold">
          Presentes {count("present")} · Ausentes {count("absent")} · Atrasos{" "}
          {count("late")} · Sem registro {pending}
        </ThemedText>
        <Field
          label="Hora de início da aula"
          value={startTime}
          editable={canWrite}
          keyboardType="number-pad"
          placeholder="HH:mm (ex.: 07:30)"
          maxLength={5}
          hint={
            suggested
              ? "Sugerido: último horário usado nesta turma. Altere se for diferente."
              : undefined
          }
          error={
            startTime.length === 5 && !TIME_RE.test(startTime)
              ? "Horário inválido"
              : undefined
          }
          onChangeText={(v) => {
            setStartTime(maskTime(v));
            setDirty(true);
            setMessage(null);
          }}
        />
        {canWrite ? (
          <View style={styles.actions}>
            <Button
              label="Marcar todos presentes"
              variant="secondary"
              small
              onPress={markAllPresent}
              style={styles.flex}
            />
            <Button
              label={dirty ? "Salvar frequência" : "Salvo"}
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

      {/* Resumo da chamada salva: atrasos e pontualidade (sobre quem compareceu) e faltas (sobre a turma registrada). */}
      {!dirty && registered > 0 ? (
        <Card tone={latePct > 0 || absent > 0 ? "warning" : "positive"}>
          <ThemedText type="smallBold">Resumo da frequência</ThemedText>
          {attended > 0 ? (
            <>
              <ThemedText type="small">
                {latePct}% chegou atrasado ({count("late")} de {attended})
              </ThemedText>
              <ThemedText type="small">
                {onTimePct}% chegou no horário ({count("present")} de {attended})
              </ThemedText>
            </>
          ) : null}
          <ThemedText type="small">
            {absentPct}% faltou ({absent} de {registered})
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Faltas justificadas: {justified} · Faltas não justificadas:{" "}
            {absent - justified}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Atrasos e pontualidade: percentual sobre os {attended} que
            compareceram. Faltas: percentual sobre os {registered} com registro.
          </ThemedText>
        </Card>
      ) : null}

      {rows.map(({ student }) => {
        const d = draft[student.id];
        return (
          <Card key={student.id}>
            <ThemedText type="smallBold">{student.full_name}</ThemedText>
            <ChipRow>
              {OPTIONS.map((o) => (
                <Chip
                  key={o.status}
                  label={o.label}
                  tone={o.tone}
                  selected={d?.status === o.status}
                  disabled={!canWrite}
                  onPress={() => update(student.id, { status: o.status })}
                />
              ))}
            </ChipRow>
            {d?.status === "absent" ? (
              <SwitchRow
                label="Falta justificada"
                value={d.justified}
                disabled={!canWrite}
                onValueChange={(v) => update(student.id, { justified: v })}
              />
            ) : null}
            {d?.status === "absent" && d.justified ? (
              <Field
                label="Motivo da justificativa (opcional)"
                value={d.reason}
                editable={canWrite}
                multiline
                maxLength={500}
                placeholder="Ex.: atestado médico, consulta, luto…"
                onChangeText={(v) => update(student.id, { reason: v })}
              />
            ) : null}
            {d?.status === "late" ? (
              <Field
                label="Horário de chegada"
                value={d.arrival}
                editable={canWrite}
                keyboardType="number-pad"
                placeholder="HH:mm (ex.: 07:45)"
                maxLength={5}
                error={
                  d.arrival.length === 5 && !TIME_RE.test(d.arrival)
                    ? "Horário inválido"
                    : undefined
                }
                onChangeText={(v) =>
                  update(student.id, { arrival: maskTime(v) })
                }
              />
            ) : null}
          </Card>
        );
      })}

      {canWrite ? (
        <Button
          label={dirty ? "Salvar frequência" : "Salvo"}
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
