import { messageFromApiErrorJsonBody } from "@/shared/utils/apiErrorDisplay";

function getBaseUrl(): string {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  return "https://localhost:7099";
}

export class KioskApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "KioskApiError";
  }
}

const DEFAULT_TIMEOUT_MS = 8_000;

const DEVICE_ID_STORAGE_KEY = "agroops_kiosk_device_id";
const KIOSK_TOKEN_STORAGE_KEY = "agroops_kiosk_token";

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing && existing.trim()) return existing.trim();
  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `kiosk-${Math.random().toString(16).slice(2)}-${Date.now()}`;
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
  return created;
}

export function getKioskToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KIOSK_TOKEN_STORAGE_KEY);
  if (!raw) return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export function setKioskToken(token: string): void {
  if (typeof window === "undefined") return;
  const t = token.trim();
  if (!t) return;
  localStorage.setItem(KIOSK_TOKEN_STORAGE_KEY, t);
}

export function clearKioskToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KIOSK_TOKEN_STORAGE_KEY);
}

type RequestInitWithBody = Omit<RequestInit, "body"> & {
  body?: object | string;
  timeoutMs?: number;
  deviceId?: string;
};

async function request<T>(path: string, init: RequestInitWithBody = {}): Promise<T> {
  const base = getBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const kioskToken = getKioskToken();
  const headers: HeadersInit = {
    ...(init.headers as HeadersInit),
    "X-Kiosk-Device-Id": init.deviceId?.trim() || getOrCreateDeviceId(),
    "X-Kiosk-Client": "web",
    ...(kioskToken ? { "X-Kiosk-Token": kioskToken } : {}),
  };

  const isJson =
    typeof init.body === "object" && init.body !== null && !(init.body instanceof FormData);
  if (isJson || (init.method !== "GET" && init.body !== undefined)) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  const body =
    typeof init.body === "object" && init.body !== null && !(init.body instanceof FormData)
      ? JSON.stringify(init.body)
      : (init.body as BodyInit | undefined);

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
      throw new KioskApiError(
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
    let parsedBody: unknown = null;
    try {
      rawText = await response.text();
      if (rawText) {
        try {
          parsedBody = JSON.parse(rawText);
        } catch {
          parsedBody = rawText;
        }
      }
    } catch {
      parsedBody = null;
      rawText = "";
    }
    const message = messageFromApiErrorJsonBody(
      parsedBody,
      response.status,
      response.statusText,
    );
    throw new KioskApiError(message, response.status, parsedBody ?? rawText);
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength === "0") {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json() as Promise<T>;
  }
  return undefined as T;
}

type ClientInit = Omit<RequestInit, "method" | "body"> & { timeoutMs?: number; deviceId?: string };

export const kioskApiClient = {
  get<T>(path: string, init?: ClientInit): Promise<T> {
    return request<T>(path, { ...init, method: "GET" });
  },

  post<T>(path: string, body?: object, init?: ClientInit): Promise<T> {
    return request<T>(path, { ...init, method: "POST", body });
  },

  put<T>(path: string, body?: object, init?: ClientInit): Promise<T> {
    return request<T>(path, { ...init, method: "PUT", body });
  },

  delete<T>(path: string, init?: ClientInit): Promise<T> {
    return request<T>(path, { ...init, method: "DELETE" });
  },
};

