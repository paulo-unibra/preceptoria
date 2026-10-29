import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ChipRow, Loading, ErrorView } from '@/components/ui/kit';
import { Spacing } from '@/constants/theme';
import { formatDayLong, todayISO } from '@/lib/format';
import { useWork } from '@/lib/work-context';

/**
 * Passo 2 do fluxo diário (PDF, seção 4): "Selecionar a turma e a data do acompanhamento".
 */
export function WorkSelector({ showDate = true }: { showDate?: boolean }) {
  const { classrooms, classroomId, setClassroomId, loadingClassrooms, classroomsError, reloadClassrooms, date, shiftDate, isToday } = useWork();

  if (loadingClassrooms && !classrooms.length) return <Loading label="Carregando turmas…" />;
  if (classroomsError) return <ErrorView error={classroomsError} onRetry={reloadClassrooms} />;
  if (!classrooms.length) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Você ainda não tem turmas vinculadas. Peça à administração para vincular o seu usuário a uma turma.
      </ThemedText>
    );
  }

  return (
    <View style={styles.wrap}>
      <ChipRow>
        {classrooms.map((c) => (
          <Chip key={c.id} label={`${c.name}`} selected={c.id === classroomId} onPress={() => setClassroomId(c.id)} />
        ))}
      </ChipRow>
      {showDate ? (
        <View style={styles.dateRow}>
          <Button label="‹" variant="secondary" small onPress={() => shiftDate(-1)} style={styles.arrow} />
          <View style={styles.dateText} accessible accessibilityLabel={`Data do acompanhamento: ${formatDayLong(date)}`}>
            <ThemedText type="smallBold" style={styles.center}>
              {formatDayLong(date)}
            </ThemedText>
            {isToday ? (
              <ThemedText type="caption" themeColor="textSecondary">
                hoje
              </ThemedText>
            ) : null}
          </View>
          <Button label="›" variant="secondary" small onPress={() => shiftDate(1)} disabled={date >= todayISO()} style={styles.arrow} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dateText: { flex: 1, alignItems: 'center' },
  arrow: { minWidth: 48 },
  center: { textAlign: 'center' },
});
