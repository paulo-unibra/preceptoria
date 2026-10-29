import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Field, Screen } from '@/components/ui/kit';
import { Spacing } from '@/constants/theme';
import { SERVER_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** RF-01 — página de entrada com login. */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length > 0;

  async function submit() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <Image source={require('@/assets/images/splash-icon.png')} style={styles.logo} contentFit="contain" accessibilityLabel="Logo da Secretaria de Educação de Itapissuma" />
        <ThemedText type="subtitle" style={styles.center}>
          Preceptoria
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Acompanhamento Escolar
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
          Secretaria de Educação de Itapissuma - PE
        </ThemedText>
      </View>

      <View style={styles.form}>
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          autoComplete="email"
          placeholder="nome@escola.gov.br"
          returnKeyType="next"
        />
        <Field
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {error ? (
          <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </ThemedText>
        ) : null}
        <Button label="Entrar" onPress={submit} loading={loading} disabled={!canSubmit} />
      </View>

      {__DEV__ ? (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
          Servidor: {SERVER_URL}
        </ThemedText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.one, paddingTop: Spacing.five },
  logo: { width: 150, height: 140, marginBottom: Spacing.two },
  center: { textAlign: 'center' },
  form: { gap: Spacing.three, marginTop: Spacing.three },
});
