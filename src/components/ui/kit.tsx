import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Tone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info';

/** Cor de destaque por tom, a partir do tema (claro/escuro). */
export function useToneColor(tone: Tone) {
  const theme = useTheme();
  switch (tone) {
    case 'positive':
      return theme.success;
    case 'negative':
      return theme.danger;
    case 'warning':
      return theme.warning;
    case 'info':
      return theme.primary;
    default:
      return theme.textSecondary;
  }
}

/** "#RRGGBB" + transparência. */
export const soft = (hex: string, alpha = '22') => `${hex}${alpha}`;

/* ------------------------------------------------------------------ Screen */

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Screen({ children, scroll = true, edges = ['top'], refreshing, onRefresh, footer, style }: ScreenProps) {
  const theme = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.primary} /> : undefined}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, style]}>{children}</View>
  );

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={edges} style={styles.flex}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <View style={styles.centered}>{body}</View>
          {footer ? <View style={[styles.footer, { backgroundColor: theme.background, borderColor: theme.border }]}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: Tone }) {
  const theme = useTheme();
  const accent = useToneColor(tone ?? 'neutral');
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: tone && tone !== 'neutral' ? accent : theme.border },
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.uppercase} accessibilityRole="header">
        {children}
      </ThemedText>
      {right}
    </View>
  );
}

/* ------------------------------------------------------------------ Button */

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, small, style }: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: theme.primary, fg: theme.onPrimary, border: theme.primary },
    secondary: { bg: 'transparent', fg: theme.primary, border: theme.primary },
    danger: { bg: theme.danger, fg: '#FFFFFF', border: theme.danger },
    ghost: { bg: 'transparent', fg: theme.primary, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={palette.fg} /> : <ThemedText type="smallBold" style={{ color: palette.fg }}>{label}</ThemedText>}
    </Pressable>
  );
}

/* -------------------------------------------------------------------- Chip */

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: Tone;
  disabled?: boolean;
  small?: boolean;
}

export function Chip({ label, selected, onPress, tone = 'info', disabled, small }: ChipProps) {
  const theme = useTheme();
  const color = useToneColor(tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        small && styles.chipSmall,
        {
          backgroundColor: selected ? color : 'transparent',
          borderColor: selected ? color : theme.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}>
      <ThemedText type="small" style={{ color: selected ? (tone === 'info' ? theme.onPrimary : '#FFFFFF') : theme.text, fontWeight: selected ? '700' : '500' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

/* ------------------------------------------------------------------- Badge */

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const color = useToneColor(tone);
  return (
    <View style={[styles.badge, { backgroundColor: soft(color) }]}>
      <ThemedText type="caption" style={{ color, fontWeight: '700' }}>
        {label}
      </ThemedText>
    </View>
  );
}

/* ------------------------------------------------------------------- Field */

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  hint?: string;
}

/** Olho (aberto) ou olho riscado (fechado), desenhado com Views para não depender de biblioteca de ícones. */
function EyeIcon({ open, color }: { open: boolean; color: string }) {
  return (
    <View style={styles.eye}>
      <View style={[styles.eyeOutline, { borderColor: color }]}>
        <View style={[styles.eyePupil, { backgroundColor: color }]} />
      </View>
      {!open ? <View style={[styles.eyeSlash, { backgroundColor: color }]} /> : null}
    </View>
  );
}

export function Field({ label, error, hint, multiline, editable = true, secureTextEntry, ...props }: FieldProps) {
  const theme = useTheme();
  // Em campos de senha, o olhinho alterna entre mostrar e ocultar o texto.
  const [hidden, setHidden] = useState(true);
  const isPassword = !!secureTextEntry;

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={theme.textSecondary}
          multiline={multiline}
          editable={editable}
          secureTextEntry={isPassword && hidden}
          {...props}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            isPassword && styles.inputWithToggle,
            {
              color: theme.text,
              backgroundColor: theme.background,
              borderColor: error ? theme.danger : theme.border,
              opacity: editable ? 1 : 0.5,
            },
          ]}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}
            accessibilityState={{ selected: !hidden }}
            hitSlop={8}
            onPress={() => setHidden((h) => !h)}
            style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.6 : 1 }]}>
            <EyeIcon open={!hidden} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <ThemedText type="caption" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ Select */

interface SelectProps {
  label: string;
  value: string | null;
  options: string[];
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Texto da opção que remove a seleção (campo opcional). */
  clearLabel?: string;
}

/**
 * Campo de seleção: abre uma lista com as opções (em vez de digitação livre).
 * Valores já gravados que não estão na lista (cadastros antigos) continuam aparecendo e selecionados.
 */
export function Select({ label, value, options, onChange, placeholder = 'Selecione…', disabled, clearLabel = 'Limpar seleção' }: SelectProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const list = value && !options.includes(value) ? [value, ...options] : options;
  const choose = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? 'nenhum selecionado'}`}
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.input, styles.selectBox, { backgroundColor: theme.background, borderColor: theme.border, opacity: disabled ? 0.5 : 1 }]}>
        <ThemedText type="default" numberOfLines={1} style={[styles.flex, { color: value ? theme.text : theme.textSecondary }]}>
          {value ?? placeholder}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          ▾
        </ThemedText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Fechar lista">
          <Pressable onPress={() => {}} style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ThemedText type="smallBold" style={styles.sheetTitle}>
              {label}
            </ThemedText>
            <ScrollView keyboardShouldPersistTaps="handled">
              {list.map((o) => {
                const selected = o === value;
                return (
                  <Pressable
                    key={o}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => choose(o)}
                    style={({ pressed }) => [styles.option, { backgroundColor: selected ? theme.backgroundElement : 'transparent', opacity: pressed ? 0.6 : 1 }]}>
                    <ThemedText type={selected ? 'smallBold' : 'small'}>{o}</ThemedText>
                    {selected ? (
                      <ThemedText type="smallBold" style={{ color: theme.primary }}>
                        ✓
                      </ThemedText>
                    ) : null}
                  </Pressable>
                );
              })}
              {value ? (
                <Pressable accessibilityRole="button" onPress={() => choose(null)} style={({ pressed }) => [styles.option, { opacity: pressed ? 0.6 : 1 }]}>
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    {clearLabel}
                  </ThemedText>
                </Pressable>
              ) : null}
            </ScrollView>
            <Button label="Cancelar" variant="ghost" small onPress={() => setOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function SwitchRow({ label, value, onValueChange, disabled }: { label: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.switchRow}>
      <ThemedText type="small" style={styles.flex}>
        {label}
      </ThemedText>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: theme.primary, false: theme.border }}
      />
    </View>
  );
}

/* --------------------------------------------------------------- Segmented */

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: theme.primary }]}>
            <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text, fontWeight: selected ? '700' : '500' }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------- State views */

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.state} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={theme.primary} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <View style={styles.state}>
      <ThemedText type="smallBold" themeColor="danger" style={styles.center} accessibilityLiveRegion="polite">
        {error.message}
      </ThemedText>
      {onRetry ? <Button label="Tentar novamente" variant="secondary" small onPress={onRetry} /> : null}
    </View>
  );
}

export function Empty({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.state}>
      <ThemedText type="smallBold" style={styles.center}>
        {title}
      </ThemedText>
      {message ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function StatTile({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: Tone }) {
  const color = useToneColor(tone);
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <ThemedText type="heading" style={{ color: tone === 'neutral' ? theme.text : color }}>
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  footer: { padding: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
  uppercase: { textTransform: 'uppercase', letterSpacing: 0.6 },
  button: { minHeight: 48, borderRadius: Spacing.three, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four },
  buttonSmall: { minHeight: 40, paddingHorizontal: Spacing.three },
  chip: { minHeight: 40, paddingHorizontal: Spacing.three, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipSmall: { minHeight: 34, paddingHorizontal: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  field: { gap: 6 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 10, fontSize: 16 },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  inputWithToggle: { paddingRight: 52 },
  selectBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', maxHeight: '70%', borderWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.three, gap: Spacing.two },
  sheetTitle: { paddingHorizontal: Spacing.two },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, borderRadius: Spacing.two },
  toggle: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 52, alignItems: 'center', justifyContent: 'center' },
  eye: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  eyeOutline: { width: 24, height: 14, borderWidth: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyePupil: { width: 6, height: 6, borderRadius: 3 },
  eyeSlash: { position: 'absolute', width: 28, height: 2, borderRadius: 1, transform: [{ rotate: '-40deg' }] },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 44 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: Spacing.three, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  state: { padding: Spacing.four, alignItems: 'center', gap: Spacing.two },
  center: { textAlign: 'center' },
  tile: { flexGrow: 1, flexBasis: '30%', minWidth: 96, borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
