"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type UserRole = "Superadmin" | "Worker" | "Manager" | "Admin";

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface StoredAuthState {
  token: string;
  expiresAt: number; // epoch ms
  user: AuthUser;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = "agroops_auth";
const LOGIN_URL = "https://localhost:7099/api/Auth/login";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredAuthState;
        if (parsed.token && parsed.user && typeof parsed.expiresAt === "number") {
          if (parsed.expiresAt > Date.now()) {
            setUser(parsed.user);
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
    setIsReady(true);
  }, []);

  const login = async (email: string, password: string) => {
    const body = JSON.stringify({ email, password });
    let response: Response;
    try {
      response = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });
    } catch (err) {
      throw new Error("No se ha podido conectar con el servidor de autenticación.");
    }

    if (!response.ok) {
      // Intentar leer mensaje del backend
      try {
        const data = await response.json();
        if (data?.message) {
          throw new Error(data.message as string);
        }
      } catch {
        // ignorar errores de parseo
      }
      if (response.status === 401) {
        throw new Error("Email o contraseña incorrectos.");
      }
      throw new Error("Error al iniciar sesión. Inténtalo de nuevo.");
    }

    const data = await response.json();
    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      role: data.user.role,
    };
    const expiresAt = Date.now() + (data.expiresIn ?? 0) * 1000;
    const stored: StoredAuthState = {
      token: data.token,
      expiresAt,
      user: authUser,
    };

    setUser(authUser);
    setToken(data.token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
