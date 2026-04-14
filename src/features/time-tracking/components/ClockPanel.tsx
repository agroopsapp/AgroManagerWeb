"use client";

import type { TimeEntryMock } from "@/features/time-tracking/types";
import { formatLastModifiedByUser } from "@/features/time-tracking/utils/formatters";
import {
  diffDurationMinutes,
  formatMinutesShort,
  formatTimeLocal,
} from "@/shared/utils/time";

interface ClockPanelProps {
  // Estado de jornada
  hasOpenEntry: boolean;
  openEntry: TimeEntryMock | null | undefined;
  jornadaCompletadaHoy: boolean;
  closedTodayEntry: TimeEntryMock | null | undefined;
  // Acciones de fichaje
  actionLoading: "checkin" | "checkout" | null;
  forgotStep: string;
  olvideFicharBotonActivo: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onOpenForgotModal: () => void;
  // Aviso días sin cuadrar
  hayDiasSinCuadrarEnHistorico: boolean;
  ultimoLaboralSinCerrar: boolean;
  ayerCompStep: string;
  onAbrirCompletarAyer: () => void;
  // Error de acción
  error: string | null;
  // Resumen de hoy
  loading: boolean;
  todayEntriesPersonal: TimeEntryMock[];
  sessionEmail: string | null | undefined;
}

export function ClockPanel({
  hasOpenEntry,
  openEntry,
  jornadaCompletadaHoy,
  closedTodayEntry,
  actionLoading,
  forgotStep,
  olvideFicharBotonActivo,
  onCheckIn,
  onCheckOut,
  onOpenForgotModal,
  hayDiasSinCuadrarEnHistorico,
  ultimoLaboralSinCerrar,
  ayerCompStep,
  onAbrirCompletarAyer,
  error,
  loading,
  todayEntriesPersonal,
  sessionEmail,
}: ClockPanelProps) {
  const estadoEtiqueta = hasOpenEntry
    ? "En curso"
    : jornadaCompletadaHoy
      ? "Completada"
      : "Sin iniciar";
  const estadoPillClass = hasOpenEntry
    ? "bg-emerald-100 text-emerald-900 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-500/30"
    : jornadaCompletadaHoy
      ? "bg-slate-200/90 text-slate-800 ring-slate-400/25 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-500/30"
      : "bg-slate-100 text-slate-700 ring-slate-400/20 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-500/25";

  /** Misma “caja” que el bloque de tabla del histórico (dentro del marco común de la página). */
  const panelBox =
    "rounded-2xl border border-slate-200/70 bg-white/95 p-4 dark:border-slate-700/80 dark:bg-slate-900/70 sm:p-5";

  return (
    <section className="min-w-0 space-y-4">
      {/* Estado de hoy */}
      <div className={`min-w-0 ${panelBox}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-agro-600 dark:text-agro-400">
            Estado de hoy
          </p>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${estadoPillClass}`}
          >
            {estadoEtiqueta}
          </span>
        </div>
        {hasOpenEntry && openEntry?.entradaManual && (
          <div
            className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-xs font-medium leading-snug text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-100"
            role="status"
          >
            <span className="shrink-0 text-base" aria-hidden>
              ⚠️
            </span>
            <span>
              Entrada registrada manualmente — cuando termines, fichá la salida con normalidad.
            </span>
          </div>
        )}
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {hasOpenEntry
            ? "Jornada en curso"
            : jornadaCompletadaHoy
              ? "Jornada completada"
              : "Fuera de jornada"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {hasOpenEntry ? (
            <>
              Has fichado la entrada a las{" "}
              <span className="font-semibold">
                {formatTimeLocal(openEntry!.checkInUtc)}
              </span>
              . Cuando termines, pulsa &quot;Fichar salida&quot;.
            </>
          ) : jornadaCompletadaHoy && closedTodayEntry ? (
            <>
              Ya registraste la jornada de hoy: entrada{" "}
              <span className="font-semibold">
                {formatTimeLocal(closedTodayEntry.checkInUtc)}
              </span>
              , salida{" "}
              <span className="font-semibold">
                {formatTimeLocal(closedTodayEntry.checkOutUtc)}
              </span>
              . Solo se permite <strong>un fichaje al día</strong>; mañana podrás fichar de
              nuevo.
            </>
          ) : (
            <>
              Todavía no has marcado la entrada de hoy. Pulsa el botón inferior para
              registrar el inicio de tu jornada.
            </>
          )}
        </p>

        <div className="mt-5 flex flex-col gap-3">
          {!jornadaCompletadaHoy && (
            <button
              type="button"
              onClick={hasOpenEntry ? onCheckOut : onCheckIn}
              disabled={actionLoading !== null || forgotStep !== "closed"}
              className={`inline-flex min-h-[3rem] items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                hasOpenEntry
                  ? "bg-rose-600 shadow-rose-600/20 hover:bg-rose-700 focus-visible:ring-rose-500"
                  : "bg-agro-600 shadow-agro-600/25 hover:bg-agro-700 focus-visible:ring-agro-500"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {actionLoading === "checkin" && "Registrando entrada…"}
              {actionLoading === "checkout" && "Registrando salida…"}
              {actionLoading === null && (hasOpenEntry ? "Fichar salida" : "Fichar entrada")}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenForgotModal}
            disabled={
              !olvideFicharBotonActivo || actionLoading !== null || forgotStep !== "closed"
            }
            className="inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl border border-amber-300/90 bg-amber-50/70 px-4 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-100/90 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-600/50 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50"
          >
            Olvidé fichar
          </button>
          {hayDiasSinCuadrarEnHistorico && (
            <div className="space-y-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
              <p>
                Puedes fichar con normalidad; la regularización de días pasados la coordina
                administración.
              </p>
              {ultimoLaboralSinCerrar && ayerCompStep === "closed" && (
                <button
                  type="button"
                  onClick={onAbrirCompletarAyer}
                  className="font-semibold text-agro-700 underline-offset-2 hover:underline dark:text-agro-400"
                >
                  Completar salida y descanso del día pendiente (opcional)
                </button>
              )}
            </div>
          )}
          <p className="rounded-xl bg-slate-50/90 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            {jornadaCompletadaHoy
              ? "Normativa: un solo registro de entrada y salida por día natural."
              : "Los horarios se guardan en hora UTC en el servidor para asegurar un registro coherente en todos los dispositivos."}
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl border border-rose-200/80 bg-rose-50 px-3.5 py-2.5 text-xs font-medium leading-snug text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100">
            {error}
          </p>
        )}
      </div>

      {/* Resumen de hoy */}
      <div className={`min-w-0 ${panelBox}`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-agro-600 dark:text-agro-400">
          Resumen de hoy
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Cargando registros…
          </p>
        ) : todayEntriesPersonal.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-200/90 bg-white/60 py-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900/30 dark:text-slate-400">
            Hoy todavía no hay fichajes registrados.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
            {todayEntriesPersonal
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.checkInUtc).getTime() - new Date(b.checkInUtc).getTime()
              )
              .map((e) => (
                <li
                  key={e.id}
                  className="rounded-2xl border border-slate-200/60 bg-white px-3.5 py-2.5 shadow-sm dark:border-slate-600/60 dark:bg-slate-900/50"
                >
                  <div className="flex flex-col">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Entrada:{" "}
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {formatTimeLocal(e.checkInUtc)}
                      </span>
                      {" · "}
                      Salida:{" "}
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {formatTimeLocal(e.checkOutUtc)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Comida/descanso:{" "}
                      <span className="font-semibold">
                        {formatMinutesShort(e.breakMinutes ?? 0)}
                      </span>
                      {" · "}
                      Total trabajado:{" "}
                      <span className="font-semibold">
                        {formatMinutesShort(
                          (() => {
                            const total = diffDurationMinutes(
                              e.checkInUtc,
                              e.checkOutUtc
                            );
                            if (total === null) return null;
                            return Math.max(0, total - (e.breakMinutes ?? 0));
                          })()
                        )}
                      </span>
                    </p>
                    <p className="mt-1 break-all text-[10px] text-slate-500 dark:text-slate-400">
                      Modificado por:{" "}
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        {formatLastModifiedByUser(e, { sessionEmail })}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  );
}
