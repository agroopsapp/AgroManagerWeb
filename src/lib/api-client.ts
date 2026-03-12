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

type RequestInitWithBody = Omit<RequestInit, "body"> & { body?: object | string };

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

  const response = await fetch(url, {
    ...init,
    headers,
    body,
  });

  if (!response.ok) {
    let body: unknown = null;
    try {
      const text = await response.text();
      if (text) body = JSON.parse(text);
    } catch {
      body = null;
    }
    const message =
      (body as { message?: string })?.message ?? `Error ${response.status}: ${response.statusText}`;
    throw new ApiError(message, response.status, body);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json() as Promise<T>;
  }
  return undefined as T;
}

export const apiClient = {
  get<T>(path: string, init?: Omit<RequestInit, "method" | "body">): Promise<T> {
    return request<T>(path, { ...init, method: "GET" });
  },

  post<T>(path: string, body?: object, init?: Omit<RequestInit, "method" | "body">): Promise<T> {
    return request<T>(path, { ...init, method: "POST", body });
  },

  put<T>(path: string, body?: object, init?: Omit<RequestInit, "method" | "body">): Promise<T> {
    return request<T>(path, { ...init, method: "PUT", body });
  },

  patch<T>(path: string, body?: object, init?: Omit<RequestInit, "method" | "body">): Promise<T> {
    return request<T>(path, { ...init, method: "PATCH", body });
  },

  delete<T>(path: string, init?: Omit<RequestInit, "method" | "body">): Promise<T> {
    return request<T>(path, { ...init, method: "DELETE" });
  },
};
