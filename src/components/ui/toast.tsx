import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const NATIVE = Platform.OS !== 'web';
const VISIBLE_MS = 2600;

function ToastView({ text, onDone }: { text: string; onDone: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current; // entrada/saída do cartão
  const pop = useRef(new Animated.Value(0)).current; // "pulo" do ícone de confirmação
  const bar = useRef(new Animated.Value(1)).current; // barra de tempo restante

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(slide, { toValue: 1, friction: 6, tension: 90, useNativeDriver: NATIVE }),
        Animated.sequence([
          Animated.delay(120),
          Animated.spring(pop, { toValue: 1, friction: 3, tension: 140, useNativeDriver: NATIVE }),
        ]),
        Animated.timing(bar, { toValue: 0, duration: VISIBLE_MS, easing: Easing.linear, useNativeDriver: false }),
      ]),
    ]).start();
    const hide = setTimeout(() => {
      Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE }).start(() => onDone());
    }, VISIBLE_MS);
    return () => clearTimeout(hide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.wrap,
        {
          top: insets.top + 10,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) }, { scale: slide.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
        },
      ]}>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.success }]}>
        <Animated.View style={[styles.icon, { backgroundColor: theme.success, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }] }]}>
          <ThemedText type="smallBold" style={styles.check}>
            ✓
          </ThemedText>
        </Animated.View>
        <ThemedText type="smallBold" style={styles.text}>
          {text}
        </ThemedText>
        <Animated.View style={[styles.bar, { backgroundColor: theme.success, width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
    </Animated.View>
  );
}

/** Aviso rápido animado no topo da tela. Use `show(texto)` e renderize `toast` na tela. */
export function useToast(): { show: (text: string) => void; toast: ReactNode } {
  const [item, setItem] = useState<{ id: number; text: string } | null>(null);
  const show = useCallback((text: string) => setItem({ id: Date.now(), text }), []);
  const toast = item ? <ToastView key={item.id} text={item.text} onDone={() => setItem((cur) => (cur?.id === item.id ? null : cur))} /> : null;
  return { show, toast };
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000, elevation: 10 },
  card: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  check: { color: '#FFFFFF' },
  text: { flex: 1 },
  bar: { position: 'absolute', left: 0, bottom: 0, height: 3 },
});
