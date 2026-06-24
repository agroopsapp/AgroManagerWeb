"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
} from "react";
import { authApi, pickCompanyIdFromLoginUser } from "@/services/auth.service";
import { normalizeUserRoleFromApi, type UserRole } from "@/types";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  /** GUID empresa (login API / BD); ausente si el usuario no tiene empresa asignada. */
  companyId?: string;
  /** Si true, el usuario no participa en fichaje (API `excludedFromTimeTracking`). */
  excludedFromTimeTracking?: boolean;
}

interface StoredAuthState {
  token: string;
  expiresAt: number; // epoch ms
  user: AuthUser;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  /** Devuelve el usuario autenticado para redirigir sin esperar al siguiente render. */
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  /** Sincroniza el flag de exclusión de fichaje con la BD (p. ej. tras GET /api/Users/{id}). */
  syncExcludedFromTimeTracking: (excluded: boolean) => void;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = "agroops_auth";

// useLayoutEffect se ejecuta de forma síncrona antes del primer paint del
// navegador, eliminando el flash de "sin usuario" en la primera carga.
// En SSR (servidor) no existe window, así que usamos useEffect como fallback
// para evitar el warning de React en servidor.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useIsomorphicLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as StoredAuthState;
          if (
            parsed.token &&
            parsed.user &&
            typeof parsed.expiresAt === "number" &&
            Number.isFinite(parsed.expiresAt)
          ) {
            if (parsed.expiresAt > Date.now()) {
              setUser({
                ...parsed.user,
                role: normalizeUserRoleFromApi(parsed.user.role),
              });
              setToken(parsed.token);
            } else {
              localStorage.removeItem(STORAGE_KEY);
            }
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } finally {
      setIsReady(true);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    let data: Awaited<ReturnType<typeof authApi.login>>;
    try {
      data = await authApi.login(email, password);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error("No se ha podido conectar con el servidor de autenticación.");
    }
    const companyId = pickCompanyIdFromLoginUser(data.user);
    const excluded =
      data.user.excludedFromTimeTracking ?? data.user.ExcludedFromTimeTracking ?? undefined;
    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      role: normalizeUserRoleFromApi(data.user.role),
      ...(companyId ? { companyId } : {}),
      ...(excluded === true ? { excludedFromTimeTracking: true } : {}),
    };
    const expiresInSec =
      typeof data.expiresIn === "number" && data.expiresIn > 0
        ? data.expiresIn
        : 60 * 60 * 24 * 7;
    const expiresAt = Date.now() + expiresInSec * 1000;
    const stored: StoredAuthState = {
      token: data.token,
      expiresAt,
      user: authUser,
    };

    setUser(authUser);
    setToken(data.token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    return authUser;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const syncExcludedFromTimeTracking = useCallback((excluded: boolean) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next: AuthUser = { ...prev };
      if (excluded) next.excludedFromTimeTracking = true;
      else delete next.excludedFromTimeTracking;
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as StoredAuthState;
          if (parsed.user) {
            const storedUser: AuthUser = { ...parsed.user };
            if (excluded) storedUser.excludedFromTimeTracking = true;
            else delete storedUser.excludedFromTimeTracking;
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ ...parsed, user: storedUser } satisfies StoredAuthState),
            );
          }
        }
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({ user, token, login, logout, syncExcludedFromTimeTracking, isReady }),
    [user, token, login, logout, syncExcludedFromTimeTracking, isReady],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
