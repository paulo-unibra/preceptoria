import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Screen, SectionTitle } from '@/components/ui/kit';
import { Spacing } from '@/constants/theme';
import { SERVER_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/format';
import { useWork } from '@/lib/work-context';

export default function MoreScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { classrooms } = useWork();

  return (
    <Screen>
      <ThemedText type="heading">Mais</ThemedText>

      <Card>
        <ThemedText type="smallBold">{user?.full_name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{user?.email}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{user ? ROLE_LABELS[user.role] : ''}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Turmas: {classrooms.length ? classrooms.map((c) => c.name).join(', ') : 'nenhuma vinculada'}
        </ThemedText>
      </Card>

      <SectionTitle>Indicadores</SectionTitle>
      <Button label="Ranking semanal e quinzenal" variant="secondary" onPress={() => router.push('/ranking')} />

      <SectionTitle>Conta</SectionTitle>
      <Button label="Sair" variant="danger" onPress={() => signOut()} />

      <ThemedText type="caption" themeColor="textSecondary" style={styles.footer}>
        Preceptoria · Secretaria de Educação de Itapissuma - PE{__DEV__ ? `\nServidor: ${SERVER_URL}` : ''}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { marginTop: Spacing.four, textAlign: 'center' },
});
