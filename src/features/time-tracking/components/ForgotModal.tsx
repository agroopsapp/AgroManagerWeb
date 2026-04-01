"use client";

import type { ForgotStep, ForgotMode } from "@/features/time-tracking/types";
import { parseHHMM, toHHMM } from "@/shared/utils/time";
import { TimeSelect24h } from "./TimeSelect24h";

interface ForgotModalProps {
  step: ForgotStep;
  targetDate: string | null;
  today: string;
  soloTime: string;
  fullStart: string;
  fullEnd: string;
  forgotMode: ForgotMode;
  fullBreakMins: number;
  fullBreakCustom: string;
  breakOtro: boolean;
  error: string | null;
  onClose: () => void;
  onSetStep: (s: ForgotStep) => void;
  onSetError: (e: string | null) => void;
  onSetTargetDate: (d: string | null) => void;
  onSetSoloTime: (v: string) => void;
  onSetFullStart: (v: string) => void;
  onSetFullEnd: (v: string) => void;
  onSetForgotMode: (m: ForgotMode) => void;
  onSetFullBreakMins: (v: number) => void;
  onSetFullBreakCustom: (v: string) => void;
  onSetBreakOtro: (v: boolean) => void;
  onSubmitSoloEntrada: () => void;
  onSubmitJornadaCompleta: (forced?: number) => void;
}

export function ForgotModal({
  step,
  targetDate,
  today,
  soloTime,
  fullStart,
  fullEnd,
  forgotMode,
  fullBreakMins,
  error,
  onClose,
  onSetStep,
  onSetError,
  onSetTargetDate,
  onSetSoloTime,
  onSetFullStart,
  onSetFullEnd,
  onSetForgotMode,
  onSetFullBreakMins,
  onSetFullBreakCustom,
  onSetBreakOtro,
  onSubmitSoloEntrada,
  onSubmitJornadaCompleta,
}: ForgotModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl dark:border dark:border-slate-600 dark:bg-slate-800">
        <div className="mb-3 flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Corrección de fichaje
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Cerrar
          </button>
        </div>

        {step === "pick_day" && (
          <>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              ¿De qué día es el fichaje?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Solo puedes usar esta corrección para <strong>hoy</strong> si aún no consta tu
              fichaje. Días anteriores los gestiona administración.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  onSetTargetDate(today);
                  onSetStep("pick_type");
                }}
                className="w-full rounded-xl bg-agro-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-agro-700 dark:hover:bg-agro-500"
              >
                Continuar (hoy)
              </button>
            </div>
          </>
        )}

        {step === "pick_type" && targetDate === today && (
          <>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Corrección disponible
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              En esta modalidad solo puedes registrar la <strong>jornada completa</strong>.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  onSetForgotMode("full_hoy");
                  onSetStep("full_start");
                }}
                className="w-full rounded-xl bg-agro-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-agro-700 dark:hover:bg-agro-500"
              >
                Toda la jornada
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetTargetDate(null);
                  onSetStep("pick_day");
                }}
                className="mt-1 text-xs text-slate-500 underline underline-offset-2"
              >
                Atrás
              </button>
            </div>
          </>
        )}

        {step === "solo_time" && (
          <>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              ¿A qué hora empezaste?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Se registrará una entrada manual. La jornada quedará abierta hasta que fichés la
              salida.
            </p>
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Hora de entrada
              </p>
              <TimeSelect24h
                idPrefix="forgot-solo"
                value={soloTime}
                onChange={onSetSoloTime}
              />
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  onSetStep("pick_type");
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium dark:border-slate-500"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={onSubmitSoloEntrada}
                className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Guardar entrada
              </button>
            </div>
          </>
        )}

        {step === "full_start" && (
          <>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              ¿A qué hora empezaste?
            </h2>
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Hora de inicio
              </p>
              <TimeSelect24h
                idPrefix="forgot-start"
                value={fullStart}
                onChange={onSetFullStart}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  if (forgotMode === "full_ayer" || forgotMode === "full_ultimo_laboral") {
                    onSetForgotMode(null);
                    onSetTargetDate(null);
                    onSetStep("pick_day");
                  } else {
                    onSetStep("pick_type");
                  }
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium dark:border-slate-500"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  onSetStep("full_end");
                }}
                className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Siguiente
              </button>
            </div>
          </>
        )}

        {step === "full_end" && (
          <>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              ¿A qué hora terminaste?
            </h2>
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Hora de fin
              </p>
              <TimeSelect24h
                idPrefix="forgot-end"
                value={fullEnd}
                onChange={onSetFullEnd}
              />
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  onSetStep("full_start");
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium dark:border-slate-500"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  onSetStep("full_rest");
                }}
                className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Siguiente
              </button>
            </div>
          </>
        )}

        {step === "full_rest" && (
          <>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              ¿Paraste para comer o descansar?
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  onSubmitJornadaCompleta(0);
                }}
                className="w-full rounded-xl bg-agro-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  onSetFullBreakMins(30);
                  onSetBreakOtro(false);
                  onSetFullBreakCustom("");
                  onSetStep("full_rest_amount");
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-600"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => onSetStep("full_end")}
                className="mt-1 text-xs text-slate-500 underline"
              >
                Atrás
              </button>
            </div>
          </>
        )}

        {step === "full_rest_amount" && (
          <>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              ¿Cuánto tiempo?
            </h2>
            <div className="mt-3">
              <TimeSelect24h
                idPrefix="forgot-break"
                value={toHHMM(
                  Math.floor(Math.max(0, fullBreakMins) / 60),
                  Math.max(0, fullBreakMins) % 60
                )}
                onChange={(hm) => {
                  const { h, m } = parseHHMM(hm);
                  onSetBreakOtro(false);
                  onSetFullBreakCustom("");
                  onSetFullBreakMins(h * 60 + m);
                }}
              />
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  onSetStep("full_rest");
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-500"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={() => onSubmitJornadaCompleta()}
                className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Registrar jornada
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
