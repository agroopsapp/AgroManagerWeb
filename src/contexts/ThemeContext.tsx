"use client";

import React, { createContext, useContext, useState, useEffect, useLayoutEffect } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "agromanager_theme";

function applyThemeToDOM(value: Theme) {
  const isDark = value === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.body.classList.toggle("dark", isDark);
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "dark" || stored === "light") {
      setThemeState(stored);
    }
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    applyThemeToDOM(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, mounted]);

  const setTheme = (value: Theme) => {
    setThemeState(value);
    applyThemeToDOM(value);
    localStorage.setItem(STORAGE_KEY, value);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div
        className={`min-h-screen antialiased ${theme === "dark" ? "dark bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-900"}`}
        suppressHydrationWarning
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
