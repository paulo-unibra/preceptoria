/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Paleta derivada da logo da Secretaria de Educação de Itapissuma-PE
 * (assets/images/logo.jpeg): azul-marinho do anel, azul-céu e verde do brasão,
 * marrom do escudo. Mantenha em sincronia com api/app/support/brand.ts.
 */
export const Brand = {
  navy: '#141B47',
  navyDark: '#080D30',
  blue: '#3C549C',
  sky: '#549CCC',
  skyLight: '#BCD0D7',
  green: '#2F9A55',
  brown: '#6C4A3C',
  white: '#FFFFFF',
  offWhite: '#F6F6F8',
  // Semânticas para registros (RAs positivos x negativos)
  positive: '#2F9A55',
  negative: '#B3402F',
  warning: '#B7791F',
} as const;

export const Colors = {
  light: {
    text: '#0B1033',
    background: '#FFFFFF',
    backgroundElement: '#F6F6F8',
    backgroundSelected: '#DDE5F0',
    textSecondary: '#4A5170',
    primary: Brand.navy,
    onPrimary: '#FFFFFF',
    secondary: Brand.sky,
    accent: Brand.brown,
    success: Brand.positive,
    danger: Brand.negative,
    warning: Brand.warning,
    border: '#D5DAE6',
  },
  dark: {
    text: '#F6F6F8',
    background: '#080D30',
    backgroundElement: '#141B47',
    backgroundSelected: '#243066',
    textSecondary: '#BCD0D7',
    primary: Brand.sky,
    onPrimary: '#080D30',
    secondary: Brand.skyLight,
    accent: '#C49A85',
    success: '#4CC47A',
    danger: '#E8735F',
    warning: '#E0A63A',
    border: '#2A3566',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
