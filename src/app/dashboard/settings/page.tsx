"use client";

import { useTheme } from "@/contexts/ThemeContext";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Ajustes</h1>
      <p className="text-slate-600 dark:text-slate-400">
        Configuración de la aplicación.
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 font-semibold text-slate-800 dark:text-slate-200">Apariencia</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Elige entre tema claro u oscuro.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition ${
              theme === "light"
                ? "border-agro-500 bg-agro-50 text-agro-800 dark:border-agro-400 dark:bg-agro-900/30 dark:text-agro-200"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-600"
            }`}
          >
            <span className="text-lg" aria-hidden>☀️</span>
            Claro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition ${
              theme === "dark"
                ? "border-agro-500 bg-agro-50 text-agro-800 dark:border-agro-400 dark:bg-agro-900/30 dark:text-agro-200"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-600"
            }`}
          >
            <span className="text-lg" aria-hidden>🌙</span>
            Oscuro
          </button>
        </div>
      </div>
    </div>
  );
}
