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
    <div className="mt-4 min-w-0 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
        Imputación vs tope laboral
      </p>
      <div className="flex w-full min-w-0 items-end gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-600 dark:text-slate-400">
            <span>
              <span className="font-semibold text-agro-700 dark:text-agro-400">Laborales</span> (tope{" "}
              {horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h)
            </span>
            <span className="shrink-0 tabular-nums">
              {horasImputadasLabor.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h /{" "}
              {horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
            </span>
          </div>
          <div
            className="relative h-9 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-200/95 shadow-inner dark:border-slate-600 dark:bg-slate-700/90"
            role="img"
            aria-label={`Horas dentro del tope: ${horasImputadasLabor.toFixed(1)} de ${horasObjetivo.toFixed(1)} horas; falta ${horasFalta.toFixed(1)} horas`}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-agro-500 to-emerald-500 transition-[width] duration-500"
              style={{ width: `${pctLabor}%` }}
            />
          </div>
          {horasFalta > 0.05 && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Gris: faltan{" "}
              <strong className="text-slate-700 dark:text-slate-300">
                {horasFalta.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </strong>{" "}
              para cubrir el tope
            </p>
          )}
        </div>
        {tieneExtra && (
          <div
            className="flex shrink-0 flex-col space-y-1"
            style={{
              width: `${extraAnchoPct}%`,
              minWidth: "5.5rem",
              maxWidth: "11rem",
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Horas extra
            </div>
            <div
              className="flex h-9 items-center justify-center rounded-full border-2 border-amber-600 bg-gradient-to-b from-amber-400 to-amber-600 px-2 text-center shadow-md dark:border-amber-500 dark:from-amber-500 dark:to-amber-700"
              role="img"
              aria-label={`Horas extra: ${horasExtra.toFixed(1)} horas por encima del objetivo`}
            >
              <span className="text-sm font-extrabold tabular-nums text-white drop-shadow-sm">
                +{horasExtra.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </span>
            </div>
          </div>
        )}
      </div>
      <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        Total imputado en el periodo:{" "}
        <strong className="text-slate-700 dark:text-slate-200">
          {horasImputadasTotal.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
        </strong>
        {tieneExtra ? (
          <>
            {" "}
            (= laborales hasta tope +{" "}
            <span className="font-semibold text-amber-700 dark:text-amber-400">extra</span>)
          </>
        ) : null}
        .
      </p>
    </div>
  );
});
