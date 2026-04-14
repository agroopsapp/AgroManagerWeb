"use client";

import { memo } from "react";

/** Dona: días imputados con parte vs sin parte. */
export const PartesEnDiasDonut = memo(function PartesEnDiasDonut({
  diasImputados,
  diasConParte,
}: {
  diasImputados: number;
  diasConParte: number;
}) {
  const cOk = "#16a34a";
  const cNo = "#94a3b8";
  const safe = diasImputados > 0 ? diasImputados : 1;
  const pct = diasImputados > 0 ? Math.round((diasConParte / safe) * 1000) / 10 : 0;
  const p1 = (diasConParte / safe) * 100;
  const gradient =
    diasImputados <= 0
      ? "conic-gradient(from -90deg, #e2e8f0 0% 100%)"
      : `conic-gradient(from -90deg, ${cOk} 0% ${p1}%, ${cNo} ${p1}% 100%)`;

  return (
    <div className="equipo-dona-card flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200/65 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-4 sm:py-4 dark:border-slate-700/75 dark:bg-slate-900/45 dark:shadow-none">
      <p className="mb-2 text-center text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100 sm:text-base">
        Días imputados con parte
      </p>
      <div className="flex min-h-0 flex-col items-center gap-2 sm:gap-3">
        <div className="flex w-full flex-col items-center gap-1.5">
          <div className="relative mx-auto h-[7rem] w-[7rem] shrink-0 sm:h-[7.5rem] sm:w-[7.5rem]">
            <div
              className="h-full w-full rounded-full shadow-sm ring-1 ring-slate-200/80"
              style={{
                background: gradient,
                mask: "radial-gradient(transparent 55%, black 56%)",
                WebkitMask: "radial-gradient(transparent 55%, black 56%)",
              }}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 text-center">
              {diasImputados > 0 ? (
                <span className="text-2xl font-bold leading-none tabular-nums text-agro-800 sm:text-3xl dark:text-emerald-400">
                  {pct}%
                </span>
              ) : (
                <span className="max-w-[6.5rem] text-center text-sm font-medium leading-snug text-slate-500 dark:text-slate-400">
                  Sin datos en el filtro
                </span>
              )}
            </div>
          </div>
          {diasImputados > 0 ? (
            <p className="max-w-[13rem] px-1 text-center text-sm font-medium leading-snug text-slate-600 dark:text-slate-300">
              De días imputados con parte
            </p>
          ) : null}
        </div>
        <ul className="w-full min-w-0 max-w-full space-y-0 px-0.5 text-sm sm:px-0">
          <li className="flex items-start justify-between gap-2 border-b border-slate-200 py-1.5 dark:border-slate-600/70">
            <span className="flex min-w-0 flex-1 items-start gap-2 pt-0.5">
              <span
                className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-slate-200/80"
                style={{ backgroundColor: cOk }}
                aria-hidden
              />
              <span className="leading-snug text-slate-600 dark:text-slate-300">Con parte</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-100">
                {diasConParte}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">días</span>
            </span>
          </li>
          <li className="flex items-start justify-between gap-2 py-1.5">
            <span className="flex min-w-0 flex-1 items-start gap-2 pt-0.5">
              <span
                className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-slate-200/80"
                style={{ backgroundColor: cNo }}
                aria-hidden
              />
              <span className="leading-snug text-slate-600 dark:text-slate-300">Sin parte</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-100">
                {Math.max(0, diasImputados - diasConParte)}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">días</span>
            </span>
          </li>
          {diasImputados > 0 && (
            <li className="border-t border-slate-200 pt-1.5 text-center text-xs font-medium text-slate-500 dark:border-slate-600/70 dark:text-slate-400">
              {diasImputados} día{diasImputados !== 1 ? "s" : ""} imputado{diasImputados !== 1 ? "s" : ""} en el periodo
            </li>
          )}
        </ul>
      </div>
    </div>
  );
});
