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
  return (
    <section className="min-w-0 space-y-3">
      {/* Tarjeta: Estado de hoy */}
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Estado de hoy
        </p>
        {hasOpenEntry && openEntry?.entradaManual && (
          <div
            className="mt-2 flex items-center gap-2 rounded-lg border border-amber-600 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-500 dark:bg-amber-950/50 dark:text-amber-100"
            role="status"
          >
            <span aria-hidden>⚠️</span>
            Entrada registrada manualmente — cuando termines, fichá la salida con normalidad.
          </div>
        )}
        <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
          {hasOpenEntry
            ? "Jornada en curso"
            : jornadaCompletadaHoy
              ? "Jornada completada"
              : "Fuera de jornada"}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
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

        <div className="mt-4 flex flex-col gap-2">
          {!jornadaCompletadaHoy && (
            <button
              type="button"
              onClick={hasOpenEntry ? onCheckOut : onCheckIn}
              disabled={actionLoading !== null || forgotStep !== "closed"}
              className={`inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                hasOpenEntry
                  ? "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500"
                  : "bg-agro-600 hover:bg-agro-700 focus:ring-agro-500"
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
            className="inline-flex items-center justify-center rounded-xl border-2 border-dashed border-amber-600/70 bg-amber-50/80 px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
          >
            Olvidé fichar
          </button>
          {hayDiasSinCuadrarEnHistorico && (
            <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
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
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {jornadaCompletadaHoy
              ? "Normativa: un solo registro de entrada y salida por día natural."
              : "Los horarios se guardan en hora UTC en el servidor para asegurar un registro coherente en todos los dispositivos."}
          </p>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
            {error}
          </p>
        )}
      </div>

      {/* Tarjeta: Resumen de hoy */}
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Resumen de hoy
        </p>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Cargando registros…
          </p>
        ) : todayEntriesPersonal.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Hoy todavía no hay fichajes registrados.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {todayEntriesPersonal
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.checkInUtc).getTime() - new Date(b.checkInUtc).getTime()
              )
              .map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-600 dark:bg-slate-700/60"
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
