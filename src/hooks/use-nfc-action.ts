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
    // No Android, a entrega do cartão pausa e retoma a Activity (onPause → onNewIntent → onResume),
    // o que o React Native reporta como "background". Cancelar nesse instante interrompia a gravação.
    // Só cancela se o app continuar fora de primeiro plano depois de uma pausa real.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (state === 'background') {
        timer = setTimeout(() => {
          if (AppState.currentState !== 'active') cancel();
        }, 3000);
      }
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
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
