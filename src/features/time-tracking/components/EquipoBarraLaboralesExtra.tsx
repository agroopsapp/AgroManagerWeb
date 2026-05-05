"use client";

import { memo } from "react";

/**
 * Imputación del periodo vs tope laboral.
 * - Barra suave + 4 mini-tiles (Tope · Imputado · Falta · Extra).
 * - Mismas props/datos que la versión anterior; sin cambios de lógica.
 */
export const EquipoBarraLaboralesExtra = memo(function EquipoBarraLaboralesExtra({
  horasObjetivo,
  horasImputadasLabor,
  horasFalta,
  horasExtra,
  horasImputadasTotal,
  compact,
  hideTotalImputado,
}: {
  horasObjetivo: number;
  horasImputadasLabor: number;
  horasFalta: number;
  horasExtra: number;
  horasImputadasTotal: number;
  compact?: boolean;
  hideTotalImputado?: boolean;
}) {
  const pctLabor =
    horasObjetivo > 0.01
      ? Math.min(100, (horasImputadasLabor / horasObjetivo) * 100)
      : 0;
  const tieneExtra = horasExtra > 0.05;
  const tieneFalta = horasFalta > 0.05;

  const fmt1 = (n: number) =>
    n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

  const tilePadding = compact ? "p-2" : "p-2.5";

  return (
    <div className={compact ? "mt-3 space-y-2.5" : "mt-3 space-y-3"}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Imputación vs tope laboral
        </p>
        <p className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-white">
            {fmt1(horasImputadasLabor)} h
          </span>
          <span className="mx-1 text-slate-300 dark:text-slate-600">/</span>
          {fmt1(horasObjetivo)} h
        </p>
      </div>

      <div
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200/70 ring-1 ring-inset ring-slate-200 dark:bg-slate-700/40 dark:ring-slate-700/60"
        role="img"
        aria-label={`Imputado ${fmt1(horasImputadasLabor)} de ${fmt1(horasObjetivo)} horas (${Math.round(pctLabor)}%); falta ${fmt1(horasFalta)} h.`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-agro-500 transition-[width] duration-500"
          style={{ width: `${pctLabor}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div
          className={`rounded-2xl border border-slate-200 bg-white ${tilePadding} dark:border-slate-700 dark:bg-slate-950/30`}
        >
          <p className="agro-muted">Tope</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-900 dark:text-white">
            {fmt1(horasObjetivo)} h
          </p>
        </div>
        <div
          className={`rounded-2xl border border-emerald-200/70 bg-emerald-50/50 ${tilePadding} dark:border-emerald-800/40 dark:bg-emerald-950/25`}
        >
          <p className="agro-muted">Imputado</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
            {fmt1(horasImputadasLabor)} h
          </p>
        </div>
        <div
          className={`rounded-2xl border border-slate-200 bg-white ${tilePadding} dark:border-slate-700 dark:bg-slate-950/30`}
        >
          <p className="agro-muted">Falta</p>
          <p
            className={`mt-0.5 text-base font-semibold tabular-nums ${
              tieneFalta
                ? "text-slate-900 dark:text-white"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {fmt1(horasFalta)} h
          </p>
        </div>
        <div
          className={
            tieneExtra
              ? `rounded-2xl border border-amber-200/80 bg-amber-50/70 ${tilePadding} dark:border-amber-800/50 dark:bg-amber-950/25`
              : `rounded-2xl border border-slate-200 bg-white ${tilePadding} dark:border-slate-700 dark:bg-slate-950/30`
          }
        >
          <p className="agro-muted">Extra</p>
          <p
            className={`mt-0.5 text-base font-semibold tabular-nums ${
              tieneExtra
                ? "text-amber-800 dark:text-amber-200"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            +{fmt1(horasExtra)} h
          </p>
        </div>
      </div>

      {!hideTotalImputado ? (
        <p className="border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Total imputado en el periodo:{" "}
          <strong className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {fmt1(horasImputadasTotal)} h
          </strong>
          {tieneExtra ? (
            <>
              {" "}
              <span className="text-slate-400 dark:text-slate-500">
                (laborales hasta tope +{" "}
                <span className="font-medium text-amber-700 dark:text-amber-400">extra</span>)
              </span>
            </>
          ) : null}
          .
        </p>
      ) : null}
    </div>
  );
});
