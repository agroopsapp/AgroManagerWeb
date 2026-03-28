/**
 * Cliente HTTP base para todas las llamadas API.
 * - Base URL desde NEXT_PUBLIC_API_URL (por defecto https://localhost:7099)
 * - Token JWT leído de localStorage (misma clave que AuthContext)
 * - Métodos get, post, put, patch, delete con tipado genérico
 */

const STORAGE_KEY = "agroops_auth";

function getBaseUrl(): string {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  return "https://localhost:7099";
}

/** Base del backend (mismo origen que usa `apiClient`) para URLs absolutas de recursos (p. ej. logos). */
export function getApiBaseUrl(): string {
  return getBaseUrl();
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { token?: string; expiresAt?: number };
    if (!parsed.token || (typeof parsed.expiresAt === "number" && parsed.expiresAt <= Date.now())) {
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** ASP.NET / ProblemDetails / validación modelo */
function messageFromErrorBody(body: unknown, status: number, statusText: string): string {
  if (body == null || body === "") return `Error ${status}: ${statusText}`;
  if (typeof body === "string") {
    const t = body.trim();
    return t.length > 600 ? `${t.slice(0, 600)}…` : t || `Error ${status}`;
  }
  if (typeof body !== "object") return `Error ${status}: ${statusText}`;

  const o = body as Record<string, unknown>;
  const msg = o.message ?? o.Message;
  const title = o.title ?? o.Title;
  const detail = o.detail ?? o.Detail;

  if (typeof msg === "string" && msg.trim()) {
    if (typeof detail === "string" && detail.trim()) return `${msg.trim()}: ${detail.trim()}`;
    return msg.trim();
  }
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (typeof title === "string" && title.trim()) {
    if (typeof detail === "string" && detail.trim()) return `${title.trim()}: ${detail.trim()}`;
    return title.trim();
  }

  const errors = o.errors ?? o.Errors;
  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    const lines = Object.entries(errors as Record<string, unknown>).flatMap(([key, val]) => {
      if (Array.isArray(val)) return val.map((x) => `${key}: ${String(x)}`);
      if (val != null) return [`${key}: ${String(val)}`];
      return [];
    });
    if (lines.length) return lines.join("; ");
  }

  return `Error ${status}: ${statusText}`;
}

const DEFAULT_TIMEOUT_MS = 8_000;

type RequestInitWithBody = Omit<RequestInit, "body"> & {
  body?: object | string;
  /** Tiempo máximo en ms antes de abortar la petición. Por defecto 8 s. */
  timeoutMs?: number;
};

async function request<T>(path: string, init: RequestInitWithBody = {}): Promise<T> {
  const base = getBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const token = getAuthToken();

  const headers: HeadersInit = {
    ...(init.headers as HeadersInit),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const isJson =
    typeof init.body === "object" && init.body !== null && !(init.body instanceof FormData);
  if (isJson || (init.method !== "GET" && init.body !== undefined)) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  const body =
    typeof init.body === "object" && init.body !== null && !(init.body instanceof FormData)
      ? JSON.stringify(init.body)
      : (init.body as BodyInit | undefined);

  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    console.info(`[api] ${init.method ?? "GET"} ${url}`);
  }

  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const externalSignal = init.signal;
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  const combinedSignal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutController.signal])
    : timeoutController.signal;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      body,
      signal: combinedSignal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (timeoutController.signal.aborted && !(externalSignal?.aborted)) {
      throw new ApiError(
        `El servidor no respondió en ${timeoutMs / 1000}s. Comprueba que el backend está activo.`,
        0,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let rawText = "";
    let body: unknown = null;
    try {
      rawText = await response.text();
      if (rawText) {
        try {
          body = JSON.parse(rawText);
        } catch {
          body = rawText;
        }
      }
    } catch {
      body = null;
      rawText = "";
    }
    const message = messageFromErrorBody(body, response.status, response.statusText);
    if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
      console.warn("[api error]", response.status, url, body ?? rawText);
    }
    throw new ApiError(message, response.status, body ?? rawText);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json() as Promise<T>;
  }
  return undefined as T;
}

type ClientInit = Omit<RequestInit, "method" | "body"> & { timeoutMs?: number };

export const apiClient = {
  get<T>(path: string, init?: ClientInit): Promise<T> {
    return request<T>(path, { ...init, method: "GET" });
  },

  post<T>(path: string, body?: object, init?: ClientInit): Promise<T> {
    return request<T>(path, { ...init, method: "POST", body });
  },

  put<T>(path: string, body?: object, init?: ClientInit): Promise<T> {
    return request<T>(path, { ...init, method: "PUT", body });
  },

  patch<T>(path: string, body?: object, init?: ClientInit): Promise<T> {
    return request<T>(path, { ...init, method: "PATCH", body });
  },

  delete<T>(path: string, init?: ClientInit): Promise<T> {
    return request<T>(path, { ...init, method: "DELETE" });
  },
};
