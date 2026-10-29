import { Image } from 'expo-image';
import { TabList, TabSlot, Tabs, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, useWindowDimensions, View, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Navegação da versão web. O Expo Router só reconhece as abas quando cada <TabTrigger> aparece
 * literalmente dentro do <TabList> (não use .map aqui).
 */
export default function AppTabs() {
  return (
    <Tabs>
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Início</TabButton>
          </TabTrigger>
          <TabTrigger name="rotina" href="/rotina" asChild>
            <TabButton>Rotina</TabButton>
          </TabTrigger>
          <TabTrigger name="ocorrencias" href="/ocorrencias" asChild>
            <TabButton>RAs</TabButton>
          </TabTrigger>
          <TabTrigger name="estudantes" href="/estudantes" asChild>
            <TabButton>Enturmação</TabButton>
          </TabTrigger>
          <TabTrigger name="mais" href="/mais" asChild>
            <TabButton>Mais</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
      <TabSlot style={styles.slot} />
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const { width } = useWindowDimensions();
  const compact = width < 520;
  return (
    <Pressable {...(props as PressableProps)} accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type={isFocused ? 'backgroundSelected' : 'backgroundElement'} style={[styles.tabButtonView, compact && styles.tabButtonCompact]}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'} style={isFocused && styles.bold}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { width } = useWindowDimensions();
  const compact = width < 520;
  return (
    <View {...props} style={styles.header}>
      <ThemedView type="backgroundElement" style={[styles.innerContainer, compact && styles.innerCompact]}>
        {!compact ? (
          <>
            <Image source={require('@/assets/images/favicon.png')} style={styles.logo} accessibilityLabel="Logo" />
            <ThemedText type="smallBold" style={styles.brandText}>
              Preceptoria
            </ThemedText>
          </>
        ) : null}
        <View style={[styles.tabs, compact && styles.tabsCompact]}>{props.children}</View>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { width: '100%', paddingHorizontal: Spacing.two, paddingTop: Spacing.two, alignItems: 'center' },
  innerContainer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  innerCompact: { paddingHorizontal: Spacing.one, borderRadius: Spacing.four },
  logo: { width: 28, height: 28, borderRadius: 14 },
  brandText: { marginRight: 'auto' },
  tabs: { flexDirection: 'row', gap: Spacing.one },
  tabsCompact: { flex: 1, justifyContent: 'space-between' },
  slot: { flex: 1 },
  pressed: { opacity: 0.7 },
  bold: { fontWeight: '700' },
  tabButtonView: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  tabButtonCompact: { paddingHorizontal: Spacing.two },
});
