import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Brand } from '@/constants/theme';

const DURATION = 600;

const fadeOut = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  25: { opacity: 1 },
  100: { opacity: 0, transform: [{ scale: 1.15 }], easing: Easing.out(Easing.quad) },
});

/**
 * Abertura do app: a logo da Secretaria sobre o azul-marinho, que some suavemente
 * (continuação da splash nativa).
 */
export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const logo = <Image style={styles.logo} source={require('@/assets/images/splash-icon.png')} accessibilityLabel="Logo da Secretaria de Educação" />;

  return animate ? (
    <Animated.View
      pointerEvents="none"
      entering={fadeOut.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) scheduleOnRN(setVisible, false);
      })}
      style={styles.overlay}>
      {logo}
    </Animated.View>
  ) : (
    <View
      pointerEvents="none"
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => setAnimate(true));
      }}
      style={styles.overlay}>
      {logo}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  logo: { width: 160, height: 150 },
});
