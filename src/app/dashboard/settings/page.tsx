"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useFeatures } from "@/contexts/FeaturesContext";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE } from "@/types";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { enableAnimals, setEnableAnimals } = useFeatures();
  const { user } = useAuth();
  const role = user?.role;
  const canEditAnimalsFeature =
    role === USER_ROLE.Admin || role === USER_ROLE.SuperAdmin;

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

      {canEditAnimalsFeature && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-1 font-semibold text-slate-800 dark:text-slate-200">
            Funcionalidad de animales
          </h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Decide si quieres usar seguimiento específico de animales (fichas e incidentes) o solo gestión de tareas generales.
          </p>
          <label className="inline-flex items-center gap-3">
            <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-300 transition peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-agro-500 dark:bg-slate-600">
              <input
                type="checkbox"
                checked={enableAnimals}
                onChange={(e) => setEnableAnimals(e.target.checked)}
                className="peer sr-only"
              />
              <span
                className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  enableAnimals ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </span>
            <span className="text-sm text-slate-700 dark:text-slate-200">
              Activar seguimiento de animales (se muestran los menús de <strong>Animales</strong>,{" "}
              <strong>Incidencias animales</strong> y la pestaña de{" "}
              <strong>Animales con incidentes</strong> en el panel).
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

