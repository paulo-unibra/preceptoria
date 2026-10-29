import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useCanWrite } from "@/components/domain";
import { ThemedText } from "@/components/themed-text";
import {
  Button,
  Card,
  ErrorView,
  Loading,
  Screen,
  SectionTitle,
  StatTile,
} from "@/components/ui/kit";
import { WorkSelector } from "@/components/work-selector";
import { Spacing } from "@/constants/theme";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { firstName, ROLE_LABELS } from "@/lib/format";
import type { ClassroomReport } from "@/lib/types";
import { useWork } from "@/lib/work-context";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const canWrite = useCanWrite();
  const { classroom, classroomId, date } = useWork();

  // Resumo do dia da turma: mesma fonte dos relatórios (totais e detalhes coerentes).
  const summary = useAsync(
    () =>
      api<ClassroomReport>(`/reports/classrooms/${classroomId}`, {
        query: { from: date, to: date },
      }),
    [classroomId, date],
    { enabled: !!classroomId, reloadOnFocus: true },
  );

  const t = summary.data?.totals;
  const total = classroom?.students_count ?? summary.data?.students.length ?? 0;

  return (
    <Screen refreshing={summary.refreshing} onRefresh={summary.reload}>
      <View style={styles.header}>
        <Image
          source={require("@/assets/images/splash-icon.png")}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="Logo"
        />
        <View style={styles.flex}>
          <ThemedText type="heading">
            Olá, {firstName(user?.full_name ?? "")}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {user ? ROLE_LABELS[user.role] : ""}
          </ThemedText>
        </View>
      </View>

      <WorkSelector />

      {summary.loading ? (
        <Loading />
      ) : summary.error ? (
        <ErrorView error={summary.error} onRetry={summary.reload} />
      ) : t ? (
        <>
          <SectionTitle>Resumo do dia</SectionTitle>
          <View style={styles.tiles}>
            <StatTile
              label="Faltas"
              value={t.attendance.absent}
              tone={t.attendance.absent ? "negative" : "neutral"}
            />
            <StatTile
              label="Atrasos"
              value={t.attendance.late}
              tone={t.attendance.late ? "warning" : "neutral"}
            />
            <StatTile
              label="RAs positivos"
              value={t.occurrences.positive}
              tone="positive"
            />
            <StatTile
              label="RAs negativos"
              value={t.occurrences.negative}
              tone={t.occurrences.negative ? "negative" : "neutral"}
            />
            <StatTile label="Eventos" value={t.notifications.total} />
            <StatTile
              label="Fardamento inadequado"
              value={t.uniform.uniform_inadequate}
              tone={t.uniform.uniform_inadequate ? "warning" : "neutral"}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir o painel completo dos registros do dia"
            onPress={() => router.push("/dashboard-dia")}
          >
            <Card
              tone={
                t.attendance.records >= total && total > 0
                  ? "positive"
                  : "neutral"
              }
            >
              <View style={styles.cardHead}>
                <ThemedText type="smallBold">Registros do dia</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Ver painel ›
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {t.attendance.records} de {total} estudantes registrados
                {t.uniform.records
                  ? ` · checklist de fardamento: ${t.uniform.records}`
                  : " · checklist de fardamento ainda não feito"}
              </ThemedText>
            </Card>
          </Pressable>

          {t.occurrences.needs_review > 0 ? (
            <Card tone="warning">
              <ThemedText type="smallBold">
                Registros para conferência: {t.occurrences.needs_review}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Há RAs com divergência ou possível duplicidade. Nada foi apagado
                ou alterado automaticamente.
              </ThemedText>
              <Button
                label="Ver na aba RAs"
                variant="secondary"
                small
                onPress={() => router.push("/ocorrencias")}
              />
            </Card>
          ) : null}
        </>
      ) : null}

      <SectionTitle>Atalhos</SectionTitle>
      <View style={styles.actions}>
        {canWrite ? (
          <Button label="Checklist" onPress={() => router.push("/rotina")} />
        ) : null}
        <Button
          label="Estudantes"
          variant="secondary"
          onPress={() => router.push("/lista-estudantes")}
        />
        {canWrite ? (
          <Button
            label="Registro Acadêmico (RA)"
            variant="secondary"
            onPress={() => router.push("/ocorrencia/nova")}
          />
        ) : null}
        <Button
          label="Ranking da turma"
          variant="secondary"
          onPress={() => router.push("/ranking")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  logo: { width: 56, height: 52 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  actions: { gap: Spacing.two },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
