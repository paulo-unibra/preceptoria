const unavailable = () =>
  new Error(
    'Use o app instalado em um Android ou iPhone com NFC. O cadastro e a leitura não estão disponíveis no navegador.'
  );

export async function cancelNfc(): Promise<void> {}

export const readNfcCard: (signal: AbortSignal) => Promise<string> = async () => {
  throw unavailable();
};

export const writeNfcCard: (token: string, signal: AbortSignal) => Promise<void> = async () => {
  throw unavailable();
};
