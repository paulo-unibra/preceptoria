import { useState } from 'react';
import { Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorView, Loading } from '@/components/ui/kit';
import { useAsync } from '@/hooks/use-async';
import { useNfcAction } from '@/hooks/use-nfc-action';
import { api } from '@/lib/api';
import { writeNfcCard } from '@/lib/nfc';

interface CardStatus {
  active: boolean;
  activated_at: string | null;
}

export function StudentNfcCard({ studentId }: { studentId: number }) {
  const card = useAsync(
    () => api<{ card: CardStatus }>(`/students/${studentId}/nfc-card`),
    [studentId],
    { reloadOnFocus: true }
  );
  const action = useNfcAction();
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function enroll() {
    setMessage('');
    await action.run(async (signal, progress) => {
      let token = pendingToken;
      if (!token) {
        progress('Preparando o cadastro…');
        const prepared = await api<{ token: string }>(`/students/${studentId}/nfc-card/prepare`, {
          method: 'POST',
        });
        if (signal.aborted) return;
        token = prepared.token;
        progress('Aproxime o cartão e mantenha-o encostado até concluir.');
        await writeNfcCard(token, signal);
        setPendingToken(token);
      }
      if (signal.aborted) return;
      progress('Confirmando o vínculo com o estudante…');
      await api(`/students/${studentId}/nfc-card/activate`, { method: 'POST', body: { token } });
      setPendingToken(null);
      if (signal.aborted) return;
      setMessage('Cartão gravado e vinculado. Ele já pode ser usado na tela de frequência.');
      card.reload();
    });
  }

  async function revoke() {
    setMessage('');
    await action.run(async (signal, progress) => {
      progress('Desvinculando cartão…');
      await api(`/students/${studentId}/nfc-card`, { method: 'DELETE' });
      setPendingToken(null);
      if (signal.aborted) return;
      setMessage('Cartão desvinculado. A leitura dele não registrará novas presenças.');
      card.reload();
    });
  }

  return (
    <Card>
      <ThemedText type="smallBold">Cartão NFC</ThemedText>
      {card.loading ? (
        <Loading />
      ) : card.error ? (
        <ErrorView error={card.error} onRetry={card.reload} />
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {card.data?.card.active
              ? 'Cartão cadastrado. Para trocar de cartão, grave um novo; o anterior será invalidado após a confirmação.'
              : 'Nenhum cartão cadastrado. Grave um cartão NTAG para registrar a presença deste estudante por aproximação.'}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            A gravação substitui o conteúdo do cartão. Use um cartão reservado para este estudante.
          </ThemedText>
          {Platform.OS === 'web' ? (
            <ThemedText type="small">
              Use o app instalado em um celular com NFC para gravar o cartão.
            </ThemedText>
          ) : (
            <Button
              label={
                pendingToken
                  ? 'Confirmar vínculo do cartão'
                  : card.data?.card.active
                    ? 'Gravar novo cartão NFC'
                    : 'Cadastrar cartão NFC'
              }
              onPress={enroll}
              loading={action.busy}
            />
          )}
          {pendingToken && !action.busy ? (
            <Button
              label="Reiniciar gravação"
              variant="secondary"
              onPress={() => setPendingToken(null)}
            />
          ) : null}
          {card.data?.card.active ? (
            <Button
              label="Desvincular cartão"
              variant="secondary"
              onPress={revoke}
              disabled={action.busy}
            />
          ) : null}
        </>
      )}
      {action.busy ? (
        <>
          <ThemedText type="small" accessibilityLiveRegion="polite">
            {action.stage}
          </ThemedText>
          <Button label="Cancelar" variant="secondary" onPress={action.cancel} />
        </>
      ) : null}
      {action.error ? (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {action.error}
        </ThemedText>
      ) : null}
      {message ? (
        <ThemedText type="small" themeColor="success" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      ) : null}
    </Card>
  );
}
