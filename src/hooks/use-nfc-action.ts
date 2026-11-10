import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { cancelNfc } from '@/lib/nfc';

/** Uma única operação por tela; sair ou cancelar também encerra a sessão nativa. */
export function useNfcAction() {
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  const cancel = useCallback(() => {
    if (!active.current) return;
    active.current?.abort();
    void cancelNfc().catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => () => cancel(), [cancel]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') cancel();
    });
    return () => subscription.remove();
  }, [cancel]);

  async function run(
    action: (signal: AbortSignal, progress: (text: string) => void) => Promise<void>
  ) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    try {
      await action(controller.signal, (text) => {
        if (!controller.signal.aborted) setStage(text);
      });
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : 'Não foi possível concluir a operação NFC.'
        );
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
        setStage('');
      }
    }
  }

  return { busy, stage, error, cancel, run };
}
