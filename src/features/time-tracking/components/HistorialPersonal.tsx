"use client";

import type { TimeEntryMock } from "@/features/time-tracking/types";
import {
  historicoFilaSinImputarPasado,
  isAusenciaRazon,
  formatRazon,
  RAZON_NO_LABORAL,
  RAZON_SIN_IMPUTAR,
  RAZON_IMPUTACION_AUTOMATICA,
  MODIFICADO_POR_SISTEMA,
  type HistoricoPersonalFila,
} from "@/features/time-tracking/utils/formatters";
import {
  diffDurationMinutes,
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
  onOpenForgotForDate: (workDate: string) => void;
}

export function HistorialPersonal({
  loading,
  historicoPersonalFilas,
  hasAnyEntries,
  onOpenPartEditor,
  onOpenForgotForDate,
}: HistorialPersonalProps) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Histórico reciente
            </p>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              <strong className="text-slate-800 dark:text-slate-100">
                Solo se muestran tus registros
              </strong>{" "}
              (usuario con sesión iniciada). Últimos 7 días calendario (incluye fin de semana).
              En rojo: laborables sin registro o sin jornada cerrada. Fin de semana sin fichaje en
              gris y «Fin de semana (no laboral)».
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Cargando histórico…
          </p>
        ) : historicoPersonalFilas.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {!hasAnyEntries
              ? "No hay registros de jornada en los últimos días."
              : "No hay datos que mostrar en la ventana de 7 días."}
          </p>
        ) : (
          <>
            <div
              className="mt-3 max-h-80 min-w-0 overflow-x-auto overflow-y-auto rounded-lg border border-slate-100 [-webkit-overflow-scrolling:touch] dark:border-slate-700 [touch-action:pan-x_pan-y]"
              style={{ overscrollBehavior: "contain" }}
            >
              <table className="w-full min-w-[1040px] text-left text-xs text-slate-600 dark:text-slate-300 sm:min-w-[1100px] md:min-w-full">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="min-w-[9rem] max-w-[13rem] px-3 py-2">Usuario</th>
                    <th className="px-3 py-2">Entrada</th>
                    <th className="px-3 py-2">Salida</th>
                    <th className="whitespace-normal px-3 py-2 leading-tight">
                      Entrada
                      <br />
                      <span className="font-normal normal-case text-[10px] text-slate-400">
                        (antes)
                      </span>
                    </th>
                    <th className="whitespace-normal px-3 py-2 leading-tight">
                      Salida
                      <br />
                      <span className="font-normal normal-case text-[10px] text-slate-400">
                        (antes)
                      </span>
                    </th>
                    <th className="px-3 py-2">Descanso</th>
                    <th className="px-3 py-2">Parte</th>
                    <th className="px-3 py-2">Acciones parte</th>
                    <th className="px-3 py-2">Razón</th>
                    <th className="min-w-[9rem] max-w-[14rem] px-3 py-2">Modificado por</th>
                    <th className="min-w-[7.5rem] whitespace-normal px-3 py-2 leading-tight">
                      Fecha
                      <br />
                      <span className="font-normal normal-case text-[10px] text-slate-400">
                        modificación
                      </span>
                    </th>
                    <th className="px-3 py-2 text-right">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoPersonalFilas.map((fila) => {
                    const alerta = historicoFilaSinImputarPasado(fila);
                    const rowClass = alerta
                      ? "border-t border-rose-200 bg-rose-50/95 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100"
                      : "border-t border-slate-100 bg-white/80 dark:border-slate-700 dark:bg-slate-800/80";
                    if (fila.kind === "sinRegistro") {
                      const emDash = "—";
                      const esFinDeSemana = workDateIsWeekend(fila.workDate);
                      const sinRowClass = alerta
                        ? rowClass
                        : esFinDeSemana
                          ? "border-t border-slate-200 bg-slate-100/95 text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300"
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
                          onClick={() => onOpenForgotForDate(fila.workDate)}
                          title="Regularizar fichaje de este día."
                          className="rounded-lg border border-agro-200 px-2 py-1 text-[11px] font-semibold text-agro-700 hover:bg-agro-50 dark:border-agro-700 dark:text-agro-300 dark:hover:bg-agro-900/30"
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
                        disabled={!e.checkOutUtc}
                        className="rounded-lg border border-agro-200 px-2 py-1 text-[11px] font-semibold text-agro-700 hover:bg-agro-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-agro-700 dark:text-agro-300 dark:hover:bg-agro-900/30"
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
                          {formatTimeLocal(e.checkInUtc)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {formatTimeLocal(e.checkOutUtc)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                          {formatTiempoAnterior(e.previousCheckInUtc)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                          {formatTiempoAnterior(e.previousCheckOutUtc)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {formatMinutesShort(e.breakMinutes ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-xs">{parteEstadoCell}</td>
                        <td className="px-3 py-2 text-xs">{parteAccionCell}</td>
                        <td className="max-w-[10rem] px-3 py-2 text-xs leading-snug">
                          <span
                            className={
                              e.razon === "imputacion_manual_error"
                                ? "rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
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
                          {e.cierreAutomaticoMedianoche
                            ? "—"
                            : formatMinutesShort(
                                (() => {
                                  const total = diffDurationMinutes(
                                    e.checkInUtc,
                                    e.checkOutUtc
                                  );
                                  if (total === null) return null;
                                  return Math.max(0, total - (e.breakMinutes ?? 0));
                                })()
                              )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-balance px-1 text-center text-[10px] text-slate-500 dark:text-slate-400">
              Ejemplo: día laboral sin filas = olvidó fichar; entrada + 23:59 = olvidó cerrar (debe
              confirmar).
            </p>
            <p className="mt-0.5 text-center text-[10px] text-slate-400 md:hidden">
              ← Desliza para ver usuario, fecha modificación, «antes» y duración →
            </p>
          </>
        )}
      </div>
    </section>
  );
}
