const origin = (
  import.meta.env.VITE_API_URL || "https://preceptoria.bibliafoco.com.br"
).replace(/\/+$/, "");
export const API_BASE = `${origin}/api/v1`;
const TOKEN_KEY = "preceptoria.dashboard.token";

export const session = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | undefined>;
type Options = {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  timeoutMs?: number;
};

async function request(
  path: string,
  { method = "GET", body, query, signal, timeoutMs = 25_000 }: Options = {},
) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "")
      url.searchParams.set(key, String(value));
  });
  let response: Response;
  const multipart = body instanceof FormData;
  try {
    const token = session.get();
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined && !multipart
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: multipart
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      "Não foi possível conectar à API. Verifique sua conexão e tente novamente.",
      0,
    );
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      errors?: { message?: string }[];
    } | null;
    if (response.status === 401 && path !== "/auth/login") {
      session.clear();
      window.dispatchEvent(new Event("session-expired"));
    }
    throw new ApiError(
      payload?.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join(" ") || "Não foi possível concluir a solicitação.",
      response.status,
    );
  }
  return response;
}

export async function apiBlob(path: string, signal?: AbortSignal) {
  return (await request(path, { signal })).blob();
}

export async function api<T>(path: string, options?: Options): Promise<T> {
  const response = await request(path, options);
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

export async function downloadReport(
  path: string,
  query: Query,
  filename: string,
) {
  const response = await request(path, { query: { ...query, format: "pdf" } });
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
