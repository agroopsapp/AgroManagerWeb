"use client";

/**
 * Sustituye temporarily el árbol cuando falla el layout raíz. Debe incluir html/body.
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="antialiased bg-slate-100 p-6 text-slate-900">
        <h1 className="text-lg font-semibold text-red-800">Error en la aplicación</h1>
        <p className="mt-2 text-sm">{error.message || "Error inesperado."}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white"
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
