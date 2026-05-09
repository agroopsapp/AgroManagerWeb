"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { OPERATIVA_MENU_RELEASED, useFeatures } from "@/contexts/FeaturesContext";
import { useAuth } from "@/contexts/AuthContext";
import { appHomePath } from "@/lib/dashboardNavGating";
import { USER_ROLE } from "@/types";

/**
 * Configuración global (módulos, menú operativa, animales): solo SuperAdmin.
 * El resto de roles no debe ver esta pantalla (redirección + enlace solo en sidebar para SA).
 */
export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const {
    enableAnimals,
    setEnableAnimals,
    enableTimeTracking,
    setEnableTimeTracking,
    enableOperativaYAnalisisMenu,
    setEnableOperativaYAnalisisMenu,
  } = useFeatures();
  const { user, isReady } = useAuth();
  const router = useRouter();
  const isSuperAdmin = user?.role === USER_ROLE.SuperAdmin;

  useEffect(() => {
    if (!isReady || !user) return;
    if (!isSuperAdmin) {
      router.replace(appHomePath(user.role, enableTimeTracking, enableOperativaYAnalisisMenu));
    }
  }, [isReady, user, isSuperAdmin, router, enableTimeTracking, enableOperativaYAnalisisMenu]);

  if (!isReady || !user || !isSuperAdmin) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Comprobando permisos…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Ajustes</h1>
      <p className="text-slate-600 dark:text-slate-400">
        Configuración global de la aplicación (solo superadministrador).
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
                ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-200"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-600"
            }`}
          >
            <span className="text-lg" aria-hidden>
              ☀️
            </span>
            Claro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition ${
              theme === "dark"
                ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-200"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-600"
            }`}
          >
            <span className="text-lg" aria-hidden>
              🌙
            </span>
            Oscuro
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
        <h2 className="mb-1 font-semibold text-slate-800 dark:text-slate-200">
          Registro de jornada (fichador)
        </h2>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Solo superadministrador
        </p>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Activa o desactiva el módulo de fichaje para todos los usuarios. Si está desactivado, no verán la entrada en
          el menú y no podrán acceder a la pantalla.
        </p>
        <label className="inline-flex items-center gap-3">
          <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-300 transition peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-600 dark:bg-slate-600">
            <input
              type="checkbox"
              checked={enableTimeTracking}
              onChange={(e) => setEnableTimeTracking(e.target.checked)}
              className="peer sr-only"
            />
            <span
              className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                enableTimeTracking ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </span>
          <span className="text-sm text-slate-700 dark:text-slate-200">
            Mostrar <strong>Registro de jornada</strong> (fichador) en la aplicación
          </span>
        </label>
      </div>

      {!OPERATIVA_MENU_RELEASED ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-600 dark:bg-slate-800/80">
          <h2 className="mb-2 font-semibold text-slate-800 dark:text-slate-200">
            Tareas, panel, animales y estadísticas
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            En esta versión esas secciones{" "}
            <strong className="font-semibold text-slate-700 dark:text-slate-300">no están publicadas</strong>: no
            aparecen en el menú y no se pueden activar desde aquí. Cuando toque habilitarlas, un desarrollador debe
            poner <code className="rounded bg-slate-200 px-1 text-xs dark:bg-slate-700">PUBLICAR_MENU_OPERATIVA_Y_ANALISIS</code> en{" "}
            <code className="rounded bg-slate-200 px-1 text-xs dark:bg-slate-700">true</code> en{" "}
            <code className="rounded bg-slate-200 px-1 text-xs dark:bg-slate-700">dashboardNavGating.ts</code>.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
            <h2 className="mb-1 font-semibold text-slate-800 dark:text-slate-200">Tareas, datos y análisis</h2>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Solo superadministrador
            </p>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Si lo desactivas, desaparecen del menú y del acceso rápido:{" "}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">Panel</strong>,{" "}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">Tareas</strong>,{" "}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">Tareas sin asignar</strong>,{" "}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">Incidencias</strong>,{" "}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">Animales</strong>,{" "}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">Granjas</strong> y{" "}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">Estadísticas</strong>. Los
              trabajadores pasan a entrar por tareas, registro de jornada o{" "}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">Mi empresa</strong> si todo lo demás
              está desactivado. Las URLs directas redirigen al panel principal.
            </p>
            <label className="inline-flex items-center gap-3">
              <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-300 transition peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-600 dark:bg-slate-600">
                <input
                  type="checkbox"
                  checked={enableOperativaYAnalisisMenu}
                  onChange={(e) => setEnableOperativaYAnalisisMenu(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    enableOperativaYAnalisisMenu ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
              <span className="text-sm text-slate-700 dark:text-slate-200">
                Mostrar <strong>Panel</strong>, <strong>tareas</strong>, <strong>incidencias</strong>,{" "}
                <strong>animales</strong>, <strong>granjas</strong> y <strong>estadísticas</strong> en la aplicación
              </span>
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-1 font-semibold text-slate-800 dark:text-slate-200">Funcionalidad de animales</h2>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200 dark:text-amber-300/90">
              Solo superadministrador
            </p>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Decide si quieres usar seguimiento específico de animales (fichas e incidentes) o solo gestión de tareas
              generales.
            </p>
            <label className="inline-flex items-center gap-3">
              <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-300 transition peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-600 dark:bg-slate-600">
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
                <strong>Incidencias animales</strong> y la pestaña de <strong>Animales con incidentes</strong> en el
                panel).
              </span>
            </label>
          </div>
        </>
      )}
    </div>
  );
}
