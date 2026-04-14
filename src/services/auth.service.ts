/**
 * Servicio de autenticación.
 * Login usa fetch directo (sin token). El resto de la app usa apiClient con token.
 */

const STORAGE_KEY = "agroops_auth";

function getBaseUrl(): string {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  return "https://localhost:7099";
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Usuario en la respuesta de POST /api/Auth/login (API real + variantes habituales). */
export interface LoginResponseUser {
  id: string;
  email: string;
  role: string;
  /** GUID empresa tenant cuando existe en BD (misma idea que claim JWT `company_id`). */
  companyId?: string | null;
  company_id?: string | null;
  CompanyId?: string | null;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
  user: LoginResponseUser;
}

/** Unifica camelCase / snake_case / Pascal del JSON de login. */
export function pickCompanyIdFromLoginUser(user: LoginResponseUser): string | undefined {
  const raw = user.companyId ?? user.company_id ?? user.CompanyId;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/Auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      let message = "Error al iniciar sesión.";
      try {
        const data = await response.json();
        if (data?.message) message = data.message as string;
      } catch {
        // ignore
      }
      if (response.status === 401) message = "Email o contraseña incorrectos.";
      throw new Error(message);
    }

    return response.json();
  },

  /** Solo para uso en cliente: guardar sesión (AuthContext ya lo hace tras login) */
  getStoredToken(): string | null {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as { token?: string; expiresAt?: number };
      if (!parsed.token || (parsed.expiresAt != null && parsed.expiresAt <= Date.now())) return null;
      return parsed.token;
    } catch {
      return null;
    }
  },
};
