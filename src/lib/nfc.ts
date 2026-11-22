import type { NdefRecord } from 'react-native-nfc-manager';

const PREFIX = 'preceptoria:nfc:v1:';
let busy = false;
let manager: typeof import('react-native-nfc-manager').default | null = null;

/** Diagnóstico por etapa visível no logcat (`adb logcat -s ReactNativeJS`). Nunca inclui o identificador do cartão. */
export function nfcLog(stage: string, detail?: unknown) {
  const info =
    detail instanceof Error ? `${detail.constructor.name}: ${detail.message}` : (detail ?? '');
  console.log(`[nfc] ${stage}${info ? ` — ${info}` : ''}`);
}

export async function cancelNfc() {
  nfcLog('cancelNfc');
  await manager?.cancelTechnologyRequest({ throwOnError: false });
}

function checkCancelled(signal: AbortSignal) {
  if (signal.aborted) throw new Error('Operação NFC cancelada.');
}

async function session<T>(
  signal: AbortSignal,
  message: string,
  action: (library: typeof import('react-native-nfc-manager')) => Promise<T>
) {
  if (busy) throw new Error('Já existe uma operação NFC em andamento.');
  busy = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const cancel = () => {
    void cancelNfc().catch(() => {});
  };
  try {
    checkCancelled(signal);
    let library: typeof import('react-native-nfc-manager');
    try {
      library = await import('react-native-nfc-manager');
      manager = library.default;
      if (!(await manager.isSupported())) throw new Error('E_UNSUPPORTED');
    } catch (error) {
      if (error instanceof Error && error.message === 'E_UNSUPPORTED')
        throw new Error('Este aparelho não tem suporte a NFC.', { cause: error });
      throw new Error(
        'O NFC precisa de uma versão instalada do app com o módulo NFC. Não está disponível no Expo Go.',
        { cause: error }
      );
    }
    checkCancelled(signal);
    await manager.start();
    if (!(await manager.isEnabled()))
      throw new Error('Ative o NFC nas configurações do celular e tente novamente.');
    checkCancelled(signal);
    signal.addEventListener('abort', () => nfcLog('abortado pelo usuário/tela'));
    signal.addEventListener('abort', cancel);
    timer = setTimeout(() => {
      timedOut = true;
      cancel();
    }, 45000);
    nfcLog('aguardando cartão');
    await manager.requestTechnology(library.NfcTech.Ndef, { alertMessage: message });
    nfcLog('cartão conectado');
    checkCancelled(signal);
    const result = await action(library);
    nfcLog('operação concluída');
    checkCancelled(signal);
    return result;
  } catch (error) {
    nfcLog('falha', error);
    if (timedOut)
      throw new Error('Tempo de leitura esgotado. Aproxime o cartão novamente.', { cause: error });
    if (
      error instanceof Error &&
      ['UserCancel', 'SessionInvalidated'].includes(error.constructor.name)
    )
      throw new Error('Operação NFC cancelada.', { cause: error });
    if (
      error instanceof Error &&
      ['TagNotWritable', 'TagSizeTooSmall', 'TagConnectionLost', 'TagUpdateFailure'].includes(
        error.constructor.name
      )
    )
      throw new Error(
        'Não foi possível concluir. Use um cartão NTAG regravável e mantenha-o encostado no celular.',
        { cause: error }
      );
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    try {
      await cancelNfc();
    } catch {
      /* A sessão pode já ter sido encerrada pelo sistema. */
    }
    manager = null;
    busy = false;
  }
}

function decodeCard(
  records: NdefRecord[] | undefined,
  library: typeof import('react-native-nfc-manager')
) {
  const tokens: string[] = [];
  for (const record of records ?? []) {
    if (!library.Ndef.isType(record, library.Ndef.TNF_WELL_KNOWN, library.Ndef.RTD_TEXT)) continue;
    try {
      const text = library.Ndef.text.decodePayload(new Uint8Array(record.payload));
      if (text.startsWith(PREFIX) && /^[a-f0-9]{64}$/.test(text.slice(PREFIX.length)))
        tokens.push(text.slice(PREFIX.length));
    } catch {
      /* Outros registros NDEF não identificam um estudante. */
    }
  }
  if (tokens.length !== 1)
    throw new Error('Este cartão não contém um cadastro válido da Preceptoria.');
  return tokens[0];
}

export function readNfcCard(signal: AbortSignal) {
  return session(
    signal,
    'Aproxime o cartão do estudante para registrar a presença.',
    async (library) => {
      const tag = await library.default.ndefHandler.getNdefMessage();
      return decodeCard(tag?.ndefMessage, library);
    }
  );
}

export function writeNfcCard(token: string, signal: AbortSignal) {
  return session(
    signal,
    'Mantenha o cartão do estudante encostado até concluir a gravação.',
    async (library) => {
      const bytes = library.Ndef.encodeMessage([
        library.Ndef.textRecord(`${PREFIX}${token}`, 'en'),
      ]);
      const status = await library.default.ndefHandler.getNdefStatus();
      nfcLog(
        `status do cartão: ${status.status}, capacidade ${status.capacity}, mensagem ${bytes.length} bytes`
      );
      if (status.status !== library.NdefStatus.ReadWrite)
        throw new Error('Este cartão está bloqueado para gravação. Use um cartão NTAG regravável.');
      if (status.capacity < bytes.length)
        throw new Error('O cartão não tem espaço suficiente para o cadastro.');
      checkCancelled(signal);
      await library.default.ndefHandler.writeNdefMessage(bytes);
      nfcLog('gravado, verificando');
      const verified = await library.default.ndefHandler.getNdefMessage();
      if (decodeCard(verified?.ndefMessage, library) !== token)
        throw new Error('Não foi possível confirmar a gravação. Cadastre o cartão novamente.');
    }
  );
}
