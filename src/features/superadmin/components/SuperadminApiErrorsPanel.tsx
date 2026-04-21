"use client";

import { MODAL_BACKDROP_CENTER, MODAL_SURFACE, MODAL_SURFACE_PAD } from "@/components/modalShell";
import { useSuperadminApiErrors } from "@/features/superadmin/hooks/useSuperadminApiErrors";

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

const HTTP_METHODS = ["", "GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export function SuperadminApiErrorsPanel({ active }: { active: boolean }) {
  const er = useSuperadminApiErrors(active);

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Los filtros de texto, método, código HTTP, empresa y usuario se aplican sobre la página cargada (resultado de{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">page</code> /{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">pageSize</code>). Cambia de página para revisar
        otros registros.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Texto (ruta, mensaje, trace…)</label>
          <input
            type="search"
            value={er.filterText}
            onChange={(e) => er.setFilterText(e.target.value)}
            className={fieldClass}
            placeholder="Buscar en la página actual…"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Código HTTP</label>
          <input
            type="text"
            inputMode="numeric"
            value={er.filterHttp}
            onChange={(e) => er.setFilterHttp(e.target.value.replace(/\D/g, ""))}
            className={fieldClass}
            placeholder="p. ej. 401"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Método</label>
          <select
            value={er.filterMethod}
            onChange={(e) => er.setFilterMethod(e.target.value)}
            className={fieldClass}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m || "any"} value={m}>
                {m || "Cualquiera"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Company ID</label>
          <input
            value={er.filterCompanyId}
            onChange={(e) => er.setFilterCompanyId(e.target.value)}
            className={fieldClass}
            placeholder="GUID parcial"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Usuario ID</label>
          <input
            value={er.filterUsuarioId}
            onChange={(e) => er.setFilterUsuarioId(e.target.value)}
            className={fieldClass}
            placeholder="GUID parcial"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void er.reload()}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Actualizar página
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Total en servidor: {er.totalCount} · Página {er.page} de {er.totalPages}
        </span>
      </div>

      {er.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {er.error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
            <tr>
              <th className="px-3 py-3">Fecha (UTC)</th>
              <th className="px-3 py-3">HTTP</th>
              <th className="px-3 py-3">Método</th>
              <th className="px-3 py-3 min-w-[8rem]">Ruta</th>
              <th className="px-3 py-3 hidden xl:table-cell">Mensaje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {er.loading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!er.loading &&
              er.items.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-900/40"
                  onClick={() => er.openDetail(row.id)}
                >
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {row.fechaHoraUtc ? new Date(row.fechaHoraUtc).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.codigoHttp}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.metodoHttp}</td>
                  <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200 max-w-[14rem] truncate" title={row.rutaEndpoint}>
                    {row.rutaEndpoint || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hidden xl:table-cell max-w-md truncate" title={row.mensajeError ?? ""}>
                    {row.mensajeError || "—"}
                  </td>
                </tr>
              ))}
            {!er.loading && er.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No hay filas en esta página con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={er.page <= 1 || er.loading}
            onClick={() => er.setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-40 dark:border-slate-600"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={er.page >= er.totalPages || er.loading}
            onClick={() => er.setPage((p) => p + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-40 dark:border-slate-600"
          >
            Siguiente
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span className="text-xs font-semibold uppercase text-slate-500">Tamaño página</span>
          <select
            value={er.pageSize}
            onChange={(e) => er.setPageSize(Number(e.target.value))}
            className={`${fieldClass} w-auto py-1.5`}
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {er.detailId && (
        <div className={`fixed inset-0 z-50 ${MODAL_BACKDROP_CENTER}`} onClick={er.closeDetail}>
          <div
            className={`max-h-[90vh] w-full max-w-2xl overflow-y-auto ${MODAL_SURFACE} ${MODAL_SURFACE_PAD}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Detalle del error</h2>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={er.closeDetail}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                ✕
              </button>
            </div>
            {er.detailLoading && <p className="mt-4 text-sm text-slate-500">Cargando…</p>}
            {er.detailError && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">{er.detailError}</p>
            )}
            {er.detail && !er.detailLoading && (
              <dl className="mt-4 space-y-2 text-sm">
                {(
                  [
                    ["id", er.detail.id],
                    ["fechaHoraUtc", er.detail.fechaHoraUtc],
                    ["usuarioId", er.detail.usuarioId ?? "—"],
                    ["companyId", er.detail.companyId ?? "—"],
                    ["rolNombre", er.detail.rolNombre ?? "—"],
                    ["codigoHttp", String(er.detail.codigoHttp)],
                    ["metodoHttp", er.detail.metodoHttp],
                    ["rutaEndpoint", er.detail.rutaEndpoint],
                    ["traceId", er.detail.traceId ?? "—"],
                    ["tipoExcepcion", er.detail.tipoExcepcion ?? "—"],
                    ["mensajeError", er.detail.mensajeError ?? "—"],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="grid gap-1 sm:grid-cols-[10rem_1fr]">
                    <dt className="font-semibold text-slate-500 dark:text-slate-400">{k}</dt>
                    <dd className="break-all text-slate-900 dark:text-slate-100">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
