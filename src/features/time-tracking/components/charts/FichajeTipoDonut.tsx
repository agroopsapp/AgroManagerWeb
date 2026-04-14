"use client";

import { memo } from "react";

/** Dona: fichaje correcto vs manual vs falta al tope mensual (misma magnitud que la dona «objetivo»). */
export const FichajeTipoDonut = memo(function FichajeTipoDonut({
  horasNormal,
  horasManual,
  horasSinImputar,
  registrosNormal,
  registrosManual,
  diasSinImputar,
  bare = false,
  bareStack = false,
}: {
  horasNormal: number;
  horasManual: number;
  horasSinImputar: number;
  registrosNormal: number;
  registrosManual: number;
  diasSinImputar: number;
  bare?: boolean;
  bareStack?: boolean;
}) {
  const cOk = "#16a34a";
  const cMan = "#d97706";
  const cGap = "#dc2626";
  const t = horasNormal + horasManual + horasSinImputar;
  const safe = t > 0.01 ? t : 1;
  const p1 = (horasNormal / safe) * 100;
  const p2 = ((horasNormal + horasManual) / safe) * 100;
  let gradient: string;
  if (t <= 0.01) {
    gradient = "conic-gradient(from -90deg, #e2e8f0 0% 100%)";
  } else if (horasSinImputar <= 0.01 && horasManual <= 0.01) {
    gradient = `conic-gradient(from -90deg, ${cOk} 0% 100%)`;
  } else if (horasSinImputar <= 0.01) {
    gradient = `conic-gradient(from -90deg, ${cOk} 0% ${p1}%, ${cMan} ${p1}% 100%)`;
  } else if (horasManual <= 0.01 && horasNormal <= 0.01) {
    gradient = `conic-gradient(from -90deg, ${cGap} 0% 100%)`;
  } else {
    gradient = `conic-gradient(from -90deg, ${cOk} 0% ${p1}%, ${cMan} ${p1}% ${p2}%, ${cGap} ${p2}% 100%)`;
  }
  const imputadas = horasNormal + horasManual;
  const pctImputadoVsPotencial =
    t > 0.01 ? Math.round((imputadas / t) * 1000) / 10 : 0;
  const totalReg = registrosNormal + registrosManual;

  const shell = bare
    ? "flex w-full min-w-0 max-w-full flex-col"
    : "equipo-dona-card flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200/65 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-4 sm:py-4 dark:border-slate-700/75 dark:bg-slate-900/45 dark:shadow-none";

  const legendList = (
    <ul
      className={`w-full min-w-0 space-y-0 ${bare ? (bareStack ? "max-w-full px-0" : "max-w-md px-0 sm:px-1") : "max-w-full px-0.5 sm:px-0"} text-base`}
    >
      <li className="flex items-start justify-between gap-3 border-b border-slate-200 py-2.5 dark:border-slate-600/70">
        <span className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            className="mt-1 h-3.5 w-3.5 shrink-0 rounded-sm ring-2 ring-slate-200/80"
            style={{ backgroundColor: cOk }}
            aria-hidden
          />
          <span className="font-medium leading-snug text-slate-800 dark:text-slate-200">Fichaje correcto</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-lg font-bold tabular-nums leading-tight text-slate-900 dark:text-white">
            {horasNormal.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
          </span>
          <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">{registrosNormal} reg.</span>
        </span>
      </li>
      <li className="flex items-start justify-between gap-3 border-b border-slate-200 py-2.5 dark:border-slate-600/70">
        <span className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            className="mt-1 h-3.5 w-3.5 shrink-0 rounded-sm ring-2 ring-slate-200/80"
            style={{ backgroundColor: cMan }}
            aria-hidden
          />
          <span className="font-medium leading-snug text-slate-800 dark:text-slate-200">Manual / corrección</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-lg font-bold tabular-nums leading-tight text-slate-900 dark:text-white">
            {horasManual.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
          </span>
          <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">{registrosManual} reg.</span>
        </span>
      </li>
      <li className="flex items-start justify-between gap-3 py-2.5">
        <span className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            className="mt-1 h-3.5 w-3.5 shrink-0 rounded-sm ring-2 ring-red-300/80"
            style={{ backgroundColor: cGap }}
            aria-hidden
          />
          <span className="font-medium leading-snug text-slate-800 dark:text-slate-200">
            Falta vs objetivo (días sin fichar)
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-lg font-bold tabular-nums leading-tight text-red-700 dark:text-red-400">
            {horasSinImputar.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
          </span>
          <span
            className="mt-1 block text-sm text-slate-600 dark:text-slate-400"
            title="Mismas horas que «Falta para objetivo» en la dona de la izquierda (tope del mes menos imputado total). Los días sin registro en el grid son informativos."
          >
            {diasSinImputar > 0
              ? `${diasSinImputar} día${diasSinImputar !== 1 ? "s" : ""} sin registro`
              : horasSinImputar > 0.01
                ? "Imputación por debajo del tope"
                : "—"}
          </span>
        </span>
      </li>
      {(totalReg > 0 || diasSinImputar > 0) && (
        <li className="border-t border-slate-200 pt-2.5 text-center text-sm font-medium text-slate-600 dark:border-slate-600/70 dark:text-slate-300">
          {totalReg} registro{totalReg !== 1 ? "s" : ""} imputados
          {diasSinImputar > 0 ? (
            <>
              {" "}
              ·{" "}
              <span className="font-bold text-red-600 dark:text-red-400">{diasSinImputar} sin imputar</span>
            </>
          ) : null}
        </li>
      )}
    </ul>
  );

  const donutBlock = (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="relative mx-auto h-[7.25rem] w-[7.25rem] shrink-0 sm:h-[8rem] sm:w-[8rem]">
        <div
          className="h-full w-full rounded-full shadow-sm ring-1 ring-slate-200/80"
          style={{
            background: gradient,
            mask: "radial-gradient(transparent 55%, black 56%)",
            WebkitMask: "radial-gradient(transparent 55%, black 56%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 text-center">
          {t > 0.01 ? (
            <span className="text-2xl font-bold leading-none tabular-nums text-agro-800 sm:text-3xl dark:text-emerald-400">
              {pctImputadoVsPotencial}%
            </span>
          ) : (
            <span className="max-w-[7rem] text-center text-sm font-medium leading-snug text-slate-500 dark:text-slate-400 sm:text-base">
              Sin datos en el filtro
            </span>
          )}
        </div>
      </div>
      {t > 0.01 ? (
        <p className="max-w-[14rem] px-1 text-center text-sm font-medium leading-snug text-slate-700 dark:text-slate-300 sm:text-base">
          Horas imputadas vs potencial
        </p>
      ) : null}
    </div>
  );

  return (
    <div className={shell}>
      <p
        className={`mb-3 font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 ${bare ? "text-left text-base sm:text-lg" : "text-center text-sm sm:text-base"}`}
      >
        Tipo de fichaje (incl. días sin imputar)
      </p>
      {bare ? (
        bareStack ? (
          <div className="flex min-h-0 w-full flex-col items-stretch gap-4">
            <div className="min-w-0 w-full">{legendList}</div>
            <div className="flex justify-center pt-1">{donutBlock}</div>
          </div>
        ) : (
          <div className="flex min-h-0 w-full flex-col items-stretch gap-5 lg:flex-row lg:items-center lg:gap-6 xl:gap-8">
            <div className="flex min-w-0 flex-1 flex-col justify-center lg:mx-auto lg:max-w-lg">
              {legendList}
            </div>
            <div className="flex shrink-0 flex-col items-center justify-center lg:pl-2">{donutBlock}</div>
          </div>
        )
      ) : (
        <div className="flex min-h-0 flex-col items-center gap-2 sm:gap-3">
          {donutBlock}
          {legendList}
        </div>
      )}
    </div>
  );
});
