import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { OccurrenceFlags, RaBadge, useCanWrite } from "@/components/domain";
import { ThemedText } from "@/components/themed-text";
import {
  Button,
  Card,
  Empty,
  ErrorView,
  Loading,
  Screen,
  Segmented,
} from "@/components/ui/kit";
import { WorkSelector } from "@/components/work-selector";
import { Spacing } from "@/constants/theme";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Occurrence, Paginated } from "@/lib/types";
import { useWork } from "@/lib/work-context";

type Filter = "all" | "positive" | "negative" | "review";

/** RF-08 + RF-12 — ocorrências e RAs, com filtros por turma e tipo. */
export default function OccurrencesScreen() {
  const router = useRouter();
  const canWrite = useCanWrite();
  const { classroomId } = useWork();
  const [filter, setFilter] = useState<Filter>("all");

  const list = useAsync(
    () =>
      api<Paginated<Occurrence>>("/occurrences", {
        query: {
          classroom_id: classroomId,
          per_page: 100,
          polarity:
            filter === "positive" || filter === "negative" ? filter : undefined,
          needs_review: filter === "review" ? true : undefined,
        },
      }),
    [classroomId, filter],
    { enabled: !!classroomId, reloadOnFocus: true },
  );

  const items = list.data?.data ?? [];

  return (
    <Screen refreshing={list.refreshing} onRefresh={list.reload}>
      <View style={styles.titleRow}>
        <ThemedText type="heading">Registros (RAs)</ThemedText>
        {canWrite ? (
          <Button
            label="Novo RA"
            small
            onPress={() => router.push("/ocorrencia/nova")}
          />
        ) : null}
      </View>
      <WorkSelector showDate={false} />
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Todos" },
          { value: "positive", label: "Positivos" },
          { value: "negative", label: "Negativos" },
          // { value: 'review', label: 'Conferir' },
        ]}
      />

      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorView error={list.error} onRetry={list.reload} />
      ) : !items.length ? (
        <Empty
          title="Nenhum registro encontrado"
          message={
            filter === "review"
              ? "Não há registros aguardando conferência."
              : "Os registros lançados aparecerão aqui."
          }
        />
      ) : (
        <View style={styles.list}>
          <ThemedText type="caption" themeColor="textSecondary">
            {list.data?.meta.total} registro(s)
          </ThemedText>
          {items.map((o) => (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              accessibilityLabel={`RA ${o.ra_code} de ${o.student?.full_name}`}
              onPress={() => router.push(`/ocorrencia/${o.id}`)}
            >
              <Card
                tone={o.polarity === "positive" ? "positive" : "negative"}
                style={o.status === "cancelled" ? styles.cancelled : undefined}
              >
                <View style={styles.titleRow}>
                  <RaBadge code={o.ra_code} polarity={o.polarity} />
                  <ThemedText type="caption" themeColor="textSecondary">
                    {formatDate(o.occurred_on)}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold">{o.student?.full_name}</ThemedText>
                <ThemedText type="small" numberOfLines={2}>
                  {o.description}
                </ThemedText>
                <OccurrenceFlags occurrence={o} />
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  list: { gap: Spacing.two },
  cancelled: { opacity: 0.6 },
});
