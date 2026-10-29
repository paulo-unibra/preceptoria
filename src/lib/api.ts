import Constants from "expo-constants";

/**
 * Endereço da API.
 *  1. EXPO_PUBLIC_API_URL, se definido (ex.: https://api.escola.gov.br);
 *  2. senão, o mesmo computador que serve o app no Expo (para o celular alcançar a API na rede local);
 *  3. senão, localhost.
 */
function resolveServerUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  // return `http://${host || 'localhost'}:3333`;
  return "https://preceptoria.bibliafoco.com.br/";
}

export const SERVER_URL = resolveServerUrl();
export const API_BASE = `${SERVER_URL}/api/v1`;

export class ApiError extends Error {
  status: number;
  code: string;
  fieldErrors: Record<string, string>;

  constructor(
    message: string,
    status: number,
    code: string,
    fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
}

function buildUrl(path: string, query?: Query) {
  const params = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join("&");
  return `${API_BASE}${path}${params ? `?${params}` : ""}`;
}

export async function api<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...authHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      `Não foi possível conectar ao servidor (${SERVER_URL}). Verifique a conexão e tente novamente.`,
      0,
      "E_NETWORK",
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // resposta sem JSON
  }

  if (!response.ok) {
    const errors: { message?: string; code?: string; field?: string }[] =
      payload?.errors ?? [];
    const message =
      errors
        .map((e) => e.message)
        .filter(Boolean)
        .join("\n") || "Ocorreu um erro inesperado.";
    const fieldErrors: Record<string, string> = {};
    for (const e of errors)
      if (e.field && e.message) fieldErrors[e.field] = e.message;
    if (response.status === 401 && !path.startsWith("/auth/login"))
      onUnauthorized?.();
    throw new ApiError(
      message,
      response.status,
      errors[0]?.code ?? "E_UNKNOWN",
      fieldErrors,
    );
  }
  return payload as T;
}
