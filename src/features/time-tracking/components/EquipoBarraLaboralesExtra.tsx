"use client";

import { memo } from "react";

/**
 * Barra: tramo principal = tope laboral (verde imputado + gris falta);
 * tramo aparte en naranja = horas extra sobre el objetivo teórico.
 */
export const EquipoBarraLaboralesExtra = memo(function EquipoBarraLaboralesExtra({
  horasObjetivo,
  horasImputadasLabor,
  horasFalta,
  horasExtra,
  horasImputadasTotal,
}: {
  horasObjetivo: number;
  horasImputadasLabor: number;
  horasFalta: number;
  horasExtra: number;
  horasImputadasTotal: number;
}) {
  const pctLabor =
    horasObjetivo > 0.01
      ? Math.min(100, (horasImputadasLabor / horasObjetivo) * 100)
      : 0;
  const tieneExtra = horasExtra > 0.05;
  const extraAnchoPct = tieneExtra
    ? Math.min(
        44,
        Math.max(
          18,
          Math.round((horasExtra / Math.max(horasObjetivo, 1)) * 72 + 16)
        )
      )
    : 0;

  return (
    <div className="mt-2 min-w-0 space-y-2 rounded-lg border border-slate-200/80 bg-slate-50/90 px-2.5 py-2 dark:border-slate-600/80 dark:bg-slate-800/35 sm:px-3 sm:py-2.5">
      <p className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
        Imputación vs tope laboral
      </p>
      <div className="flex w-full min-w-0 items-end gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs text-slate-700 dark:text-slate-200">
            <span>
              <span className="font-bold text-agro-700 dark:text-agro-400">Laborales</span>
              <span className="text-slate-600 dark:text-slate-300">
                {" "}
                (tope {horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h)
              </span>
            </span>
            <span className="shrink-0 tabular-nums font-semibold text-slate-900 dark:text-white">
              {horasImputadasLabor.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h /{" "}
              {horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
            </span>
          </div>
          <div
            className="relative h-6 w-full overflow-hidden rounded-full border border-slate-300/90 bg-slate-300 shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)] dark:border-slate-500 dark:bg-slate-600"
            role="img"
            aria-label={`Horas dentro del tope: ${horasImputadasLabor.toFixed(1)} de ${horasObjetivo.toFixed(1)} horas; falta ${horasFalta.toFixed(1)} horas`}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-agro-500 to-emerald-500 shadow-sm transition-[width] duration-500"
              style={{ width: `${pctLabor}%` }}
            />
          </div>
          {horasFalta > 0.05 && (
            <p className="text-xs leading-snug text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-500 dark:text-slate-400">Tramo gris:</span> faltan{" "}
              <strong className="font-bold text-slate-900 dark:text-white">
                {horasFalta.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </strong>{" "}
              para cubrir el tope.
            </p>
          )}
        </div>
        {tieneExtra && (
          <div
            className="flex shrink-0 flex-col space-y-1.5"
            style={{
              width: `${extraAnchoPct}%`,
              minWidth: "5.5rem",
              maxWidth: "11rem",
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">
              Horas extra
            </div>
            <div
              className="flex h-6 items-center justify-center rounded-full border-2 border-amber-600 bg-gradient-to-b from-amber-400 to-amber-600 px-1.5 text-center shadow-md dark:border-amber-500 dark:from-amber-500 dark:to-amber-700"
              role="img"
              aria-label={`Horas extra: ${horasExtra.toFixed(1)} horas por encima del objetivo`}
            >
              <span className="text-xs font-extrabold tabular-nums text-white drop-shadow-sm">
                +{horasExtra.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </span>
            </div>
          </div>
        )}
      </div>
      <p className="border-t border-slate-200/80 pt-2 text-xs leading-snug text-slate-600 dark:border-slate-600/80 dark:text-slate-300">
        Total imputado en el periodo:{" "}
        <strong className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
          {horasImputadasTotal.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
        </strong>
        {tieneExtra ? (
          <>
            {" "}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              (= laborales hasta tope +{" "}
              <span className="font-semibold text-amber-700 dark:text-amber-400">extra</span>)
            </span>
          </>
        ) : null}
        .
      </p>
    </div>
  );
});
