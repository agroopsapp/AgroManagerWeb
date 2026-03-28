"use client";

/**
 * Boundary de error para rutas bajo el layout raíz (login, home, etc.).
 * Sin este archivo, Next puede mostrar solo "missing required error components".
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center p-6">
      <div className="rounded-2xl border border-red-200 bg-red-50/90 p-6 text-slate-900 shadow-sm dark:border-red-900/50 dark:bg-red-950/40 dark:text-slate-100">
        <h1 className="text-lg font-semibold text-red-800 dark:text-red-200">Error al cargar la página</h1>
        <p className="mt-2 text-sm text-red-900/90 dark:text-red-100/90">
          {error.message || "Ha ocurrido un error inesperado."}
        </p>
        <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
          Si ves esto tras editar código, para el servidor, ejecuta{" "}
          <code className="rounded bg-slate-200 px-1 py-0.5 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
            npm run dev:clean
          </code>{" "}
          y vuelve a entrar.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
