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
    <div className="equipo-dona-card flex min-h-[26rem] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm sm:min-h-[27rem] sm:px-4 sm:py-5 lg:h-full lg:min-h-0 dark:border-slate-600 dark:bg-white">
      <p className="mb-3 min-h-[4rem] text-center text-sm font-semibold leading-snug text-slate-800 sm:mb-4 sm:min-h-[2.75rem] dark:text-slate-900">
        Días imputados con parte
      </p>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 sm:gap-5">
        <div className="relative mx-auto h-40 w-40 shrink-0 sm:h-44 sm:w-44">
          <div
            className="h-full w-full rounded-full shadow-md ring-1 ring-slate-200/80"
            style={{
              background: gradient,
              mask: "radial-gradient(transparent 56%, black 57%)",
              WebkitMask: "radial-gradient(transparent 56%, black 57%)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
            {diasImputados > 0 ? (
              <>
                <span className="text-2xl font-bold leading-none tabular-nums text-agro-800 sm:text-3xl dark:text-agro-900">
                  {pct}%
                </span>
                <span className="mt-1 max-w-[7rem] text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-600">
                  de días imputados con parte
                </span>
              </>
            ) : (
              <span className="flex min-h-[2.75rem] max-w-[7rem] items-center justify-center px-2 text-center text-[11px] font-medium leading-snug text-slate-500">
                Sin datos en el filtro
              </span>
            )}
          </div>
        </div>
        <ul className="mt-auto w-full min-w-0 max-w-full space-y-0 px-0.5 text-sm sm:px-0">
          <li className="flex items-start justify-between gap-3 border-b border-slate-200 py-2.5 dark:border-slate-200">
            <span className="flex min-w-0 flex-1 items-start gap-2.5 pt-0.5">
              <span
                className="mt-0.5 h-3 w-3 shrink-0 rounded-sm shadow-sm ring-1 ring-slate-200/80"
                style={{ backgroundColor: cOk }}
                aria-hidden
              />
              <span className="text-[13px] leading-snug text-slate-600 dark:text-slate-700">
                Con parte
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-base font-bold tabular-nums leading-tight text-slate-900">
                {diasConParte}
              </span>
              <span className="mt-0.5 block min-h-[14px] text-[10px] text-slate-500">días</span>
            </span>
          </li>
          <li className="flex items-start justify-between gap-3 py-2.5">
            <span className="flex min-w-0 flex-1 items-start gap-2.5 pt-0.5">
              <span
                className="mt-0.5 h-3 w-3 shrink-0 rounded-sm shadow-sm ring-1 ring-slate-200/80"
                style={{ backgroundColor: cNo }}
                aria-hidden
              />
              <span className="text-[13px] leading-snug text-slate-600 dark:text-slate-700">
                Sin parte
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-base font-bold tabular-nums leading-tight text-slate-900">
                {Math.max(0, diasImputados - diasConParte)}
              </span>
              <span className="mt-0.5 block min-h-[14px] text-[10px] text-slate-500">días</span>
            </span>
          </li>
          {diasImputados > 0 && (
            <li className="border-t border-slate-200 pt-2.5 text-center text-[10px] font-medium text-slate-500 dark:border-slate-200">
              {diasImputados} día{diasImputados !== 1 ? "s" : ""} imputado{diasImputados !== 1 ? "s" : ""} en el periodo
            </li>
          )}
        </ul>
      </div>
    </div>
  );
});
