import { Platform } from "react-native";

import { API_BASE, authHeaders, SERVER_URL } from "@/lib/api";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

/** Nome de arquivo seguro: "registros-do-dia-9-ano-a-2026-10-28.pdf". */
export const pdfFileName = (prefix: string, name: string, date: string) =>
  `${prefix}-${slug(name)}-${date}.pdf`;

async function failure(status: number, text: string): Promise<Error> {
  let message = `Não foi possível gerar o PDF (erro ${status}).`;
  try {
    const body = JSON.parse(text);
    message = body?.errors?.[0]?.message ?? body?.message ?? message;
  } catch {
    // resposta sem JSON
  }
  return new Error(message);
}

/**
 * Baixa um PDF da API (com o token do usuário) e o abre:
 *  - Android/iOS: salva no cache e abre no visualizador de PDF; sem visualizador, abre o menu de compartilhar;
 *  - Web: baixa o arquivo pelo navegador.
 */
export async function downloadPdf(
  path: string,
  fileName: string,
  title: string,
) {
  const url = `${API_BASE}${path}`;

  if (Platform.OS === "web") {
    let res: Response;
    try {
      res = await fetch(url, { headers: authHeaders() });
    } catch {
      throw new Error(`Não foi possível conectar ao servidor (${SERVER_URL}).`);
    }
    if (!res.ok) throw await failure(res.status, await res.text());
    const objectUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }

  const { File, Paths } = await import("expo-file-system");
  const { fetch: expoFetch } = await import("expo/fetch");

  let res: Awaited<ReturnType<typeof expoFetch>>;
  try {
    res = await expoFetch(url, { headers: authHeaders() });
  } catch {
    throw new Error(
      `Não foi possível conectar ao servidor (${SERVER_URL}). Verifique a conexão e tente novamente.`,
    );
  }
  if (!res.ok) throw await failure(res.status, await res.text());

  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(await res.bytes());

  try {
    await file.preview({ title, mimeType: "application/pdf" });
  } catch {
    // Sem app de PDF instalado: oferece compartilhar/salvar o arquivo.
    const Sharing = await import("expo-sharing");
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error(
        "Nenhum aplicativo de PDF encontrado neste aparelho para abrir o arquivo.",
      );
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: title,
    });
  }
}
