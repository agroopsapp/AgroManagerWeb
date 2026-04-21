"use client";

import { sanitizeApiErrorText } from "@/shared/utils/apiErrorDisplay";

/**
 * Evita pantalla en blanco ante errores en rutas bajo /dashboard.
 * Los fallos de chunks en dev se corrigen con `npm run dev` (Turbopack) o `npm run dev:clean`.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50/90 p-6 text-slate-900 shadow-sm dark:border-red-900/50 dark:bg-red-950/40 dark:text-slate-100">
      <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">Error en el panel</h2>
      <p className="mt-2 text-sm text-red-900/90 dark:text-red-100/90">
        {sanitizeApiErrorText(error.message) || "Ha ocurrido un error inesperado."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
