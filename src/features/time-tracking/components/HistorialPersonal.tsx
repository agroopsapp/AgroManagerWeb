"use client";

import type { TimeEntryMock } from "@/features/time-tracking/types";
import {
  historicoFilaSinImputarPasado,
  isSinJornadaImputableRazon,
  effectiveWorkMinutesEntry,
  RAZON_NO_LABORAL,
  RAZON_SIN_IMPUTAR,
  RAZON_IMPUTACION_AUTOMATICA,
  MODIFICADO_POR_SISTEMA,
  equipoAbsenceEtiquetaKind,
  formatRazonTablaEquipo,
  timeEntryConParteEnServidor,
  workReportParteApiSummary,
  type HistoricoPersonalFila,
} from "@/features/time-tracking/utils/formatters";
import {
  formatDateEsWeekdayDdMmYyyy,
  formatFechaModificacionUtc,
  formatMinutesShort,
  formatTiempoAnterior,
  formatTimeLocal,
  workDateIsWeekend,
} from "@/shared/utils/time";
import {
  equipoTablaEtiquetaAusencia,
  equipoTablaEtiquetaBaseClass,
  equipoTablaSinImputarBadgeClass,
  equipoTablaZebraRowClass,
  equipoTablaZebraStripeBg,
} from "@/features/time-tracking/utils/equipoTableAppearance";
import { TimeEntryStatusBadge } from "@/features/time-tracking/components/TimeEntryStatusBadge";
import {
  EquipoTablaAccionesDuo,
  EquipoTablaBotonPrimeraJornada,
} from "@/features/time-tracking/components/EquipoTablaAccionesIconos";

interface HistorialPersonalProps {
  loading: boolean;
  historicoPersonalFilas: HistoricoPersonalFila[];
  hasAnyEntries: boolean;
  onOpenPartEditor: (entry: TimeEntryMock) => void | Promise<void>;
  /** Abre el modal «Editar día» (ausencias + modificar horario). */
  onOpenEditarDiaMenu: (workDate: string) => void;
}

/** Contenedor scroll de tabla alineado con «Horas del equipo». */
const tablaScrollClass =
  "isolate max-h-[min(80vh,calc(100dvh-11.5rem))] w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto border-t border-slate-100 bg-slate-50/20 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] dark:border-slate-800 dark:bg-slate-950/15 lg:max-h-[min(82vh,calc(100dvh-12.5rem))]";

const theadClass =
  "sticky top-0 z-[5] border-b border-slate-200/90 bg-white/90 text-xs font-semibold text-slate-600 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300";

const thClass = "px-2 py-1.5";

/** Primera columna: visible al cargar en móvil y fija al hacer scroll horizontal. */
const stickyAccionesThClass =
  "sticky left-0 z-[10] border-r border-slate-200/80 bg-white/95 px-1 py-1.5 text-center align-middle shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95";

const stickyAccionesTdClass =
  "sticky left-0 z-[1] border-r border-slate-200/80 px-1 py-1.5 text-center align-middle shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-slate-700";

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
              (sesión actual). Últimos 7 días calendario. La columna <strong>Estado</strong> resume el
              tipo de día o incidencia; en <span className="font-medium text-rose-700 dark:text-rose-400">rojo</span>{" "}
              las alertas laborables sin fichaje o jornada sin cerrar.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 text-[10px] font-medium">
            <span
              className={`${equipoTablaEtiquetaBaseClass} ${equipoTablaSinImputarBadgeClass} px-2.5 py-1`}
            >
              Alerta laboral
            </span>
            <span className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
            <div className={tablaScrollClass} style={{ overscrollBehavior: "contain" }}>
              <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className={stickyAccionesThClass}>Acciones</th>
                    <th className={thClass}>Fecha</th>
                    <th className={thClass}>Usuario</th>
                    <th className={thClass}>Entrada</th>
                    <th className={thClass}>Salida</th>
                    <th className={`${thClass} whitespace-normal leading-tight`}>
                      Entrada
                      <br />
                      <span className="font-normal normal-case text-[10px] text-slate-400 dark:text-slate-500">
                        (antes)
                      </span>
                    </th>
                    <th className={`${thClass} whitespace-normal leading-tight`}>
                      Salida
                      <br />
                      <span className="font-normal normal-case text-[10px] text-slate-400 dark:text-slate-500">
                        (antes)
                      </span>
                    </th>
                    <th className={thClass}>Descanso</th>
                    <th className={thClass} title="Estado del día / fichaje">
                      Estado
                    </th>
                    <th className={thClass}>Parte</th>
                    <th className={thClass}>Razón</th>
                    <th className={`${thClass} min-w-[8rem] max-w-[12rem]`}>Modificado por</th>
                    <th className={`${thClass} min-w-[6.5rem] whitespace-normal leading-tight`}>
                      Fecha
                      <br />
                      <span className="font-normal normal-case text-[10px] text-slate-400">modificación</span>
                    </th>
                    <th className={`${thClass} text-right`}>Duración</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoPersonalFilas.map((fila, rowIndex) => {
                    const alerta = historicoFilaSinImputarPasado(fila);
                    const zebra = equipoTablaZebraRowClass(rowIndex);
                    const stripe = equipoTablaZebraStripeBg(rowIndex);

                    if (fila.kind === "sinRegistro") {
                      const emDash = "—";
                      const esFinDeSemana = workDateIsWeekend(fila.workDate);
                      const estadoBadge = esFinDeSemana ? (
                        <span
                          className={`${equipoTablaEtiquetaBaseClass} ${equipoTablaEtiquetaAusencia("no_laboral").badgeClass}`}
                        >
                          {equipoTablaEtiquetaAusencia("no_laboral").label}
                        </span>
                      ) : alerta ? (
                        <span className={`${equipoTablaEtiquetaBaseClass} ${equipoTablaSinImputarBadgeClass}`}>
                          Sin imputar
                        </span>
                      ) : (
                        <span className={`${equipoTablaEtiquetaBaseClass} text-slate-600 dark:text-slate-300`}>
                          Sin registro
                        </span>
                      );
                      const razonTexto = esFinDeSemana ? (
                        <span className="text-slate-600 dark:text-slate-300">{RAZON_NO_LABORAL}</span>
                      ) : (
                        <span className="font-medium text-rose-800 dark:text-rose-200">{RAZON_SIN_IMPUTAR}</span>
                      );
                      const accionesCell = esFinDeSemana ? (
                        <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                      ) : (
                        <EquipoTablaBotonPrimeraJornada
                          onCrearJornada={() => onOpenEditarDiaMenu(fila.workDate)}
                        />
                      );
                      return (
                        <tr key={`sin-${fila.workDate}`} className={zebra}>
                          <td className={`${stickyAccionesTdClass} ${stripe}`}>{accionesCell}</td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                            {formatDateEsWeekdayDdMmYyyy(fila.workDate)}
                          </td>
                          <td className="max-w-[13rem] px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">
                            {emDash}
                          </td>
                          <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">{emDash}</td>
                          <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">{emDash}</td>
                          <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">{emDash}</td>
                          <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">{emDash}</td>
                          <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">{emDash}</td>
                          <td className="px-2 py-1.5 text-sm align-middle">{estadoBadge}</td>
                          <td className="px-2 py-1.5 text-sm text-slate-400 dark:text-slate-500">No</td>
                          <td className="max-w-[12rem] px-2 py-1.5 text-sm leading-snug">{razonTexto}</td>
                          <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">{emDash}</td>
                          <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">{emDash}</td>
                          <td className="px-2 py-1.5 text-right text-sm text-slate-500 dark:text-slate-400">
                            {emDash}
                          </td>
                        </tr>
                      );
                    }

                    const e = fila.entry;
                    const sinJornada = isSinJornadaImputableRazon(e.razon);
                    const ausenciaEtiqueta = equipoAbsenceEtiquetaKind(e);
                    const ausenciaEtiquetaVisual = ausenciaEtiqueta
                      ? equipoTablaEtiquetaAusencia(ausenciaEtiqueta)
                      : null;
                    const apiParte = workReportParteApiSummary(e);
                    const tieneParte = timeEntryConParteEnServidor(e);

                    const estadoCell = ausenciaEtiquetaVisual ? (
                      <span
                        className={`${equipoTablaEtiquetaBaseClass} ${ausenciaEtiquetaVisual.badgeClass}`}
                      >
                        {ausenciaEtiquetaVisual.label}
                      </span>
                    ) : alerta ? (
                      <span className={`${equipoTablaEtiquetaBaseClass} ${equipoTablaSinImputarBadgeClass}`}>
                        Sin imputar
                      </span>
                    ) : (
                      <TimeEntryStatusBadge className="text-xs" status={e.timeEntryStatus} />
                    );

                    const parteCell = sinJornada ? (
                      "—"
                    ) : (
                      <div className="leading-tight">
                        <span
                          className={
                            apiParte.tieneParte
                              ? "font-semibold text-teal-800 dark:text-teal-200"
                              : "text-slate-400 dark:text-slate-500"
                          }
                        >
                          {apiParte.tieneParte ? "Sí" : "No"}
                        </span>
                        {apiParte.tieneParte && apiParte.detalle ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">
                            {apiParte.detalle}
                          </span>
                        ) : null}
                      </div>
                    );

                    const razonClass =
                      e.razon === "imputacion_manual_error"
                        ? "rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
                        : "text-slate-700 dark:text-slate-200";

                    return (
                      <tr key={e.id} className={zebra}>
                        <td className={`${stickyAccionesTdClass} ${stripe}`}>
                          <EquipoTablaAccionesDuo
                            onEditarHora={() => onOpenEditarDiaMenu(e.workDate)}
                            onEditarParte={() => void onOpenPartEditor(e)}
                            parteDisabled={sinJornada || !e.checkOutUtc}
                            tieneParte={tieneParte}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                          {formatDateEsWeekdayDdMmYyyy(e.workDate)}
                        </td>
                        <td className="max-w-[13rem] px-2 py-1.5 text-sm leading-snug text-slate-700 dark:text-slate-200">
                          {e.userName?.trim() && (
                            <span className="font-medium">{e.userName.trim()}</span>
                          )}
                          {e.userEmail?.trim() && (
                            <span
                              className="mt-0.5 block truncate text-xs font-normal text-slate-500 dark:text-slate-400"
                              title={e.userEmail.trim()}
                            >
                              {e.userEmail.trim()}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-sm">
                          {sinJornada ? "—" : formatTimeLocal(e.checkInUtc)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-sm">
                          {sinJornada ? "—" : formatTimeLocal(e.checkOutUtc)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">
                          {formatTiempoAnterior(e.previousCheckInUtc)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">
                          {formatTiempoAnterior(e.previousCheckOutUtc)}
                        </td>
                        <td className="px-2 py-1.5 text-sm">
                          {sinJornada ? "—" : formatMinutesShort(e.breakMinutes ?? 0)}
                        </td>
                        <td className="px-2 py-1.5 text-sm align-middle">{estadoCell}</td>
                        <td className="max-w-[10rem] px-2 py-1.5 text-sm leading-tight">{parteCell}</td>
                        <td className="max-w-[12rem] px-2 py-1.5 text-sm leading-snug">
                          <span className={razonClass}>
                            {e.cierreAutomaticoMedianoche
                              ? RAZON_IMPUTACION_AUTOMATICA
                              : formatRazonTablaEquipo(e)}
                          </span>
                        </td>
                        <td
                          className="max-w-[14rem] px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200"
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
                          className="whitespace-nowrap px-2 py-1.5 text-sm text-slate-600 dark:text-slate-300"
                          title={e.updatedAtUtc ?? ""}
                        >
                          {formatFechaModificacionUtc(e.updatedAtUtc)}
                        </td>
                        <td
                          className="px-2 py-1.5 text-right text-sm font-semibold text-slate-900 dark:text-slate-50"
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
          </>
        )}
      </div>
    </section>
  );
}
