"use client";

import type { AyerCompletaStep } from "@/features/time-tracking/types";
import { BreakDurationCombos } from "./BreakDurationCombos";
import { TimeSelect24h } from "./TimeSelect24h";
import { formatDateES, formatMinutesShort } from "@/shared/utils/time";

interface AyerCompletaModalProps {
  step: AyerCompletaStep;
  fechaAyerEtiqueta: string;
  ayerManStart: string;
  ayerManEnd: string;
  ayerCompOtroH: number;
  ayerCompOtroM: number;
  ayerMinutosBrutos: number;
  error: string | null;
  onClose: () => void;
  onSetStep: (s: AyerCompletaStep) => void;
  onSetManStart: (v: string) => void;
  onSetManEnd: (v: string) => void;
  onSetError: (e: string | null) => void;
  onSetOtroH: (v: number) => void;
  onSetOtroM: (v: number) => void;
  onInitDescansoStep: () => void;
  onSubmit: (breakMin?: number) => void;
}

export function AyerCompletaModal({
  step,
  fechaAyerEtiqueta,
  ayerManStart,
  ayerManEnd,
  ayerCompOtroH,
  ayerCompOtroM,
  ayerMinutosBrutos,
  error,
  onClose,
  onSetStep,
  onSetManStart,
  onSetManEnd,
  onSetError,
  onSetOtroH,
  onSetOtroM,
  onInitDescansoStep,
  onSubmit,
}: AyerCompletaModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl dark:border dark:border-slate-600 dark:bg-slate-800">
        <div className="mb-3 flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
            Registro manual del día anterior
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Cerrar
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Día: <strong>{formatDateES(fechaAyerEtiqueta)}</strong>
        </p>

        {step === "inicio" && (
          <>
            <h2 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-50">
              ¿A qué hora empezaste?
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Aunque solo te faltara la salida, revisa también la hora de entrada si hace falta.
            </p>
            <TimeSelect24h
              idPrefix="ayer-in"
              value={ayerManStart}
              onChange={onSetManStart}
            />
            {error && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  onSetStep("fin");
                }}
                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Siguiente
              </button>
            </div>
          </>
        )}

        {step === "fin" && (
          <>
            <h2 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-50">
              ¿A qué hora terminaste?
            </h2>
            <TimeSelect24h
              idPrefix="ayer-out"
              value={ayerManEnd}
              onChange={onSetManEnd}
            />
            {error && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onSetStep("inicio")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-500"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  onSetStep("descanso");
                }}
                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Siguiente
              </button>
            </div>
          </>
        )}

        {step === "descanso" && (
          <>
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-sm dark:border-rose-800 dark:bg-rose-950/40">
              <p className="text-[11px] font-medium uppercase tracking-wide text-rose-800 dark:text-rose-300">
                Resumen de la jornada indicada
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                De <strong>{ayerManStart}</strong> a <strong>{ayerManEnd}</strong> (
                {formatDateES(fechaAyerEtiqueta)})
              </p>
              {ayerMinutosBrutos > 0 ? (
                <>
                  <p className="mt-2 text-lg font-bold text-rose-900 dark:text-rose-100">
                    Tiempo total: {formatMinutesShort(ayerMinutosBrutos)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    Ese es el tiempo entre entrada y salida. Lo que declares de{" "}
                    <strong>descanso</strong> se <strong>restará</strong> de ese total para
                    calcular las <strong>horas trabajadas efectivas</strong>.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                  Revisa la hora de salida: debe ser posterior a la de entrada.
                </p>
              )}
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-50">
              ¿Paraste para comer o descansar?
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  onSubmit(0);
                }}
                className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetError(null);
                  onInitDescansoStep();
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-600"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => onSetStep("fin")}
                className="mt-1 text-xs text-slate-500 underline"
              >
                Atrás
              </button>
            </div>
          </>
        )}

        {step === "descanso_cant" && (
          <>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              ¿Cuánto tiempo descansaste?
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Elige las horas y los minutos con los desplegables.
            </p>
            {ayerMinutosBrutos > 0 && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-800/80">
                <p className="text-slate-600 dark:text-slate-400">
                  Tiempo total jornada:{" "}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {formatMinutesShort(ayerMinutosBrutos)}
                  </strong>
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-400">
                  Descanso indicado:{" "}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {formatMinutesShort(ayerCompOtroH * 60 + ayerCompOtroM)}
                  </strong>
                </p>
                <p className="mt-1 border-t border-slate-200 pt-1 font-semibold text-agro-800 dark:text-agro-300">
                  Trabajado efectivo (estimado):{" "}
                  {formatMinutesShort(
                    Math.max(0, ayerMinutosBrutos - (ayerCompOtroH * 60 + ayerCompOtroM))
                  )}
                </p>
              </div>
            )}
            <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-600">
              <BreakDurationCombos
                idPrefix="ayer-break"
                hours={ayerCompOtroH}
                minutes={ayerCompOtroM}
                onHoursChange={onSetOtroH}
                onMinutesChange={onSetOtroM}
                onUserEdit={() => {}}
              />
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onSetStep("descanso")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-500"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={() => onSubmit()}
                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Guardar jornada de ayer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
