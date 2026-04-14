"use client";

import type { TimeEntryMock } from "@/features/time-tracking/types";
import {
  historicoFilaSinImputarPasado,
  isSinJornadaImputableRazon,
  formatRazon,
  effectiveWorkMinutesEntry,
  RAZON_NO_LABORAL,
  RAZON_SIN_IMPUTAR,
  RAZON_IMPUTACION_AUTOMATICA,
  MODIFICADO_POR_SISTEMA,
  type HistoricoPersonalFila,
} from "@/features/time-tracking/utils/formatters";
import {
  formatDateES,
  formatFechaModificacionUtc,
  formatMinutesShort,
  formatTiempoAnterior,
  formatTimeLocal,
  workDateIsWeekend,
} from "@/shared/utils/time";

interface HistorialPersonalProps {
  loading: boolean;
  historicoPersonalFilas: HistoricoPersonalFila[];
  hasAnyEntries: boolean;
  onOpenPartEditor: (entry: TimeEntryMock) => void | Promise<void>;
  /** Abre el modal «Editar día» (ausencias + modificar horario). */
  onOpenEditarDiaMenu: (workDate: string) => void;
}

export function HistorialPersonal({
  loading,
  historicoPersonalFilas,
  hasAnyEntries,
  onOpenPartEditor,
  onOpenEditarDiaMenu,
}: HistorialPersonalProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 sm:py-5 dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-agro-600 dark:text-agro-400">
                Histórico reciente
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                <strong className="font-semibold text-slate-800 dark:text-slate-200">
                  Solo se muestran tus registros
                </strong>{" "}
                (sesión actual). Últimos 7 días calendario (incluye fin de semana). En{" "}
                <span className="font-medium text-rose-700 dark:text-rose-400">rojo</span>: laborables
                sin registro o sin jornada cerrada. Fin de semana sin fichaje en gris: «Fin de semana
                (no laboral)».
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 text-[10px] font-medium">
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-800 ring-1 ring-rose-200/80 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-800/50">
                Alerta laboral
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/80">
                Fin de semana
              </span>
            </div>
          </div>
      </div>

        <div className="flex-1 p-3 sm:p-4 sm:pt-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Cargando histórico…
          </p>
        ) : historicoPersonalFilas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {!hasAnyEntries
              ? "No hay registros de jornada en los últimos días."
              : "No hay datos que mostrar en la ventana de 7 días."}
          </p>
        ) : (
          <>
            <div
              className="max-h-[min(28rem,55vh)] min-w-0 overflow-x-auto overflow-y-auto rounded-2xl border border-slate-200/70 bg-slate-50/50 [-webkit-overflow-scrolling:touch] dark:border-slate-700/80 dark:bg-slate-950/40 [touch-action:pan-x_pan-y] sm:max-h-[min(32rem,60vh)]"
              style={{ overscrollBehavior: "contain" }}
            >
              <table className="w-full min-w-[1040px] text-left text-[13px] text-slate-600 dark:text-slate-300 sm:min-w-[1100px] md:min-w-full md:text-sm">
                <thead className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-100/95 text-[10px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-400">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-3 sm:px-4">Fecha</th>
                    <th className="min-w-[9rem] max-w-[13rem] px-3 py-3 sm:px-4">Usuario</th>
                    <th className="whitespace-nowrap px-3 py-3 sm:px-4">Entrada</th>
                    <th className="whitespace-nowrap px-3 py-3 sm:px-4">Salida</th>
                    <th className="whitespace-normal px-3 py-3 leading-tight sm:px-4">
                      Entrada
                      <br />
                      <span className="font-medium normal-case text-[9px] text-slate-400 dark:text-slate-500">
                        (antes)
                      </span>
                    </th>
                    <th className="whitespace-normal px-3 py-3 leading-tight sm:px-4">
                      Salida
                      <br />
                      <span className="font-medium normal-case text-[9px] text-slate-400 dark:text-slate-500">
                        (antes)
                      </span>
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 sm:px-4">Descanso</th>
                    <th className="whitespace-nowrap px-3 py-3 sm:px-4">Parte</th>
                    <th className="whitespace-nowrap px-3 py-3 sm:px-4">Acciones parte</th>
                    <th className="whitespace-nowrap px-3 py-3 sm:px-4">Razón</th>
                    <th className="min-w-[9rem] max-w-[14rem] px-3 py-3 sm:px-4">Modificado por</th>
                    <th className="min-w-[7.5rem] whitespace-normal px-3 py-3 leading-tight sm:px-4">
                      Fecha
                      <br />
                      <span className="font-medium normal-case text-[9px] text-slate-400 dark:text-slate-500">
                        modificación
                      </span>
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right sm:px-4">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoPersonalFilas.map((fila) => {
                    const alerta = historicoFilaSinImputarPasado(fila);
                    const rowClass = alerta
                      ? "border-t border-rose-200/90 bg-rose-50/90 text-rose-950 dark:border-rose-800/80 dark:bg-rose-950/45 dark:text-rose-100"
                      : "border-t border-slate-100/90 bg-white/90 transition-colors hover:bg-slate-50/90 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-800/70";
                    if (fila.kind === "sinRegistro") {
                      const emDash = "—";
                      const esFinDeSemana = workDateIsWeekend(fila.workDate);
                      const sinRowClass = alerta
                        ? rowClass
                        : esFinDeSemana
                          ? "border-t border-slate-200/90 bg-slate-100/95 text-slate-600 dark:border-slate-700 dark:bg-slate-800/55 dark:text-slate-300"
                          : rowClass;
                      const cellMuted = alerta
                        ? "px-3 py-2 text-xs text-rose-800/90 dark:text-rose-200/90"
                        : esFinDeSemana
                          ? "px-3 py-2 text-xs text-slate-500 dark:text-slate-400"
                          : "px-3 py-2 text-xs text-slate-400 dark:text-slate-500";
                      const razonCell = esFinDeSemana ? (
                        <span className="italic text-sky-700 dark:text-sky-400">
                          {RAZON_NO_LABORAL}
                        </span>
                      ) : (
                        <span className="font-semibold text-rose-800 dark:text-rose-200">
                          {RAZON_SIN_IMPUTAR}
                        </span>
                      );
                      const parteEstadoCell = (
                        <span className="text-slate-400 dark:text-slate-500">No</span>
                      );
                      const parteDisabledCell = esFinDeSemana ? (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenEditarDiaMenu(fila.workDate)}
                          title="Editar día: ausencias o imputar horario."
                          className="rounded-lg border border-agro-300/90 bg-white px-2.5 py-1 text-[11px] font-semibold text-agro-800 shadow-sm hover:bg-agro-50 dark:border-agro-600 dark:bg-agro-950/30 dark:text-agro-200 dark:hover:bg-agro-900/40"
                        >
                          Fichar
                        </button>
                      );
                      return (
                        <tr key={`sin-${fila.workDate}`} className={sinRowClass}>
                          <td
                            className={`px-3 py-2 text-xs font-medium ${alerta ? "text-rose-900 dark:text-rose-100" : esFinDeSemana ? "text-slate-700 dark:text-slate-200" : "text-slate-600 dark:text-slate-300"}`}
                          >
                            {formatDateES(fila.workDate)}
                          </td>
                          <td
                            className={`max-w-[13rem] px-3 py-2 text-xs leading-snug ${alerta ? "text-rose-900 dark:text-rose-100" : esFinDeSemana ? "text-slate-700 dark:text-slate-200" : "text-slate-700 dark:text-slate-200"}`}
                          />
                          <td className={cellMuted}>{emDash}</td>
                          <td className={cellMuted}>{emDash}</td>
                          <td className={cellMuted}>{emDash}</td>
                          <td className={cellMuted}>{emDash}</td>
                          <td className={cellMuted}>{emDash}</td>
                          <td className="px-3 py-2 text-xs">{parteEstadoCell}</td>
                          <td className="px-3 py-2 text-xs">{parteDisabledCell}</td>
                          <td className="max-w-[10rem] px-3 py-2 text-xs leading-snug">
                            {razonCell}
                          </td>
                          <td className={cellMuted}>{emDash}</td>
                          <td className={cellMuted}>{emDash}</td>
                          <td className={`${cellMuted} text-right`}>{emDash}</td>
                        </tr>
                      );
                    }
                    const e = fila.entry;
                    const sinJornada = isSinJornadaImputableRazon(e.razon);
                    const parteEstadoCell = e.workReportId ? (
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                        Sí
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">No</span>
                    );
                    const parteAccionCell = (
                      <button
                        type="button"
                        onClick={() => onOpenPartEditor(e)}
                        disabled={sinJornada || !e.checkOutUtc}
                        className="rounded-lg border border-agro-300/90 bg-white px-2.5 py-1 text-[11px] font-semibold text-agro-800 shadow-sm hover:bg-agro-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-agro-600 dark:bg-agro-950/30 dark:text-agro-200 dark:hover:bg-agro-900/40"
                      >
                        {e.workReportId ? "Editar parte" : "Añadir parte"}
                      </button>
                    );
                    return (
                      <tr key={e.id} className={rowClass}>
                        <td className="px-3 py-2 text-xs">
                          {formatDateES(e.workDate)}
                        </td>
                        <td
                          className={`max-w-[13rem] px-3 py-2 text-xs leading-snug ${alerta ? "text-rose-900 dark:text-rose-100" : "text-slate-700 dark:text-slate-200"}`}
                        >
                          {e.userName?.trim() && (
                            <span className="font-medium">{e.userName.trim()}</span>
                          )}
                          {e.userEmail?.trim() && (
                            <span
                              className="mt-0.5 block truncate text-[10px] font-normal text-slate-500 dark:text-slate-400"
                              title={e.userEmail.trim()}
                            >
                              {e.userEmail.trim()}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {sinJornada ? "—" : formatTimeLocal(e.checkInUtc)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {sinJornada ? "—" : formatTimeLocal(e.checkOutUtc)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                          {formatTiempoAnterior(e.previousCheckInUtc)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                          {formatTiempoAnterior(e.previousCheckOutUtc)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {sinJornada ? "—" : formatMinutesShort(e.breakMinutes ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-xs">{parteEstadoCell}</td>
                        <td className="px-3 py-2 text-xs">{parteAccionCell}</td>
                        <td className="max-w-[10rem] px-3 py-2 text-xs leading-snug">
                          <span
                            className={
                              e.razon === "imputacion_manual_error"
                                ? "rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
                                : e.razon === "dia_no_laboral"
                                  ? "rounded-md bg-stone-200/80 px-1.5 py-0.5 font-semibold text-stone-900 dark:bg-stone-600/50 dark:text-stone-100"
                                  : alerta
                                    ? "text-rose-900 dark:text-rose-100"
                                    : "text-slate-700 dark:text-slate-200"
                            }
                          >
                            {e.cierreAutomaticoMedianoche
                              ? RAZON_IMPUTACION_AUTOMATICA
                              : formatRazon(e.razon)}
                          </span>
                        </td>
                        <td
                          className={`max-w-[14rem] px-3 py-2 text-xs ${alerta ? "text-rose-900 dark:text-rose-100" : "text-slate-700 dark:text-slate-200"}`}
                          title={
                            e.cierreAutomaticoMedianoche
                              ? MODIFICADO_POR_SISTEMA
                              : e.lastModifiedByName?.trim() && e.lastModifiedByEmail?.trim()
                                ? `${e.lastModifiedByName.trim()} · ${e.lastModifiedByEmail.trim()}`
                                : e.lastModifiedByEmail?.trim() ||
                                  e.lastModifiedByName?.trim() ||
                                  "—"
                          }
                        >
                          <span className="line-clamp-2 break-all">
                            {e.cierreAutomaticoMedianoche
                              ? MODIFICADO_POR_SISTEMA
                              : e.lastModifiedByName?.trim() && e.lastModifiedByEmail?.trim()
                                ? `${e.lastModifiedByName.trim()} · ${e.lastModifiedByEmail.trim()}`
                                : e.lastModifiedByEmail?.trim() ||
                                  e.lastModifiedByName?.trim() ||
                                  "—"}
                          </span>
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-2 text-xs ${alerta ? "text-rose-800 dark:text-rose-200" : "text-slate-600 dark:text-slate-300"}`}
                          title={e.updatedAtUtc ?? ""}
                        >
                          {formatFechaModificacionUtc(e.updatedAtUtc)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right text-xs font-semibold ${alerta ? "text-rose-900 dark:text-rose-200" : ""}`}
                          title={
                            e.cierreAutomaticoMedianoche
                              ? "Se calculará al confirmar salida y descanso reales"
                              : undefined
                          }
                        >
                          {sinJornada || e.cierreAutomaticoMedianoche
                            ? "—"
                            : formatMinutesShort(effectiveWorkMinutesEntry(e))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-1 rounded-xl bg-slate-50/90 px-3 py-2.5 dark:bg-slate-800/40">
              <p className="text-balance text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Ejemplo: día laboral sin filas = olvidó fichar; entrada + 23:59 = olvidó cerrar (debe
                confirmar).
              </p>
              <p className="text-center text-[10px] text-slate-400 md:hidden">
                ← Desliza para ver usuario, fecha modificación, «antes» y duración →
              </p>
            </div>
          </>
        )}
        </div>
    </section>
  );
}
