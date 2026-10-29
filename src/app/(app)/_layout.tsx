import { Stack } from 'expo-router';

import { Brand } from '@/constants/theme';
import { WorkProvider } from '@/lib/work-context';

export default function AppLayout() {
  return (
    <WorkProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Brand.navy },
          headerTintColor: Brand.white,
          headerTitleStyle: { fontWeight: '700' },
          headerBackTitle: 'Voltar',
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard-dia" options={{ title: 'Registros do dia' }} />
        <Stack.Screen name="lista-estudantes" options={{ title: 'Estudantes' }} />
        <Stack.Screen name="estudante/[id]" options={{ title: 'Ficha do estudante' }} />
        <Stack.Screen name="ocorrencia/nova" options={{ title: 'Novo registro (RA)' }} />
        <Stack.Screen name="ocorrencia/[id]" options={{ title: 'Registro de acompanhamento' }} />
        <Stack.Screen name="ranking" options={{ title: 'Ranking' }} />
      </Stack>
    </WorkProvider>
  );
}
