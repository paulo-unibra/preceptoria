import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundSelected}
      tintColor={colors.primary}
      iconColor={{ default: colors.textSecondary, selected: colors.primary }}
      labelStyle={{
        default: { color: colors.textSecondary },
        selected: { color: colors.primary },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="rotina">
        <NativeTabs.Trigger.Label>Rotina</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checklist" md="fact_check" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ocorrencias">
        <NativeTabs.Trigger.Label>RAs</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="flag.fill" md="flag" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="estudantes">
        <NativeTabs.Trigger.Label>Enturmação</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.3.fill" md="groups" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="mais">
        <NativeTabs.Trigger.Label>Mais</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ellipsis.circle.fill" md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
