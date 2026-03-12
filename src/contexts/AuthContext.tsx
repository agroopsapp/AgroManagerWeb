"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { UserRole } from "@/types";

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
    let data: { token: string; expiresIn?: number; user: { id: string; email: string; role: string } };
    try {
      const { authApi } = await import("@/services/auth.service");
      data = await authApi.login(email, password);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error("No se ha podido conectar con el servidor de autenticación.");
    }
    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      role: data.user.role as AuthUser["role"],
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
