"use client";

import { memo } from "react";

/** Dona: fichaje correcto vs manual vs hueco laboral sin imputar (8 h por día). */
export const FichajeTipoDonut = memo(function FichajeTipoDonut({
  horasNormal,
  horasManual,
  horasSinImputar,
  registrosNormal,
  registrosManual,
  diasSinImputar,
}: {
  horasNormal: number;
  horasManual: number;
  horasSinImputar: number;
  registrosNormal: number;
  registrosManual: number;
  diasSinImputar: number;
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

  return (
    <div className="equipo-dona-card flex min-h-[26rem] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm sm:min-h-[27rem] sm:px-4 sm:py-5 lg:h-full lg:min-h-0 dark:border-slate-600 dark:bg-white">
      <p className="mb-3 min-h-[4rem] text-center text-sm font-semibold leading-snug text-slate-800 sm:mb-4 sm:min-h-[2.75rem] dark:text-slate-900">
        Tipo de fichaje (incl. días sin imputar)
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
            {t > 0.01 ? (
              <>
                <span className="text-2xl font-bold leading-none tabular-nums text-agro-800 sm:text-3xl dark:text-agro-900">
                  {pctImputadoVsPotencial}%
                </span>
                <span className="mt-1 max-w-[7rem] text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-600">
                  horas imputadas vs potencial
                </span>
              </>
            ) : (
              <span className="flex min-h-[2.75rem] max-w-[6rem] items-center justify-center px-2 text-center text-[11px] font-medium leading-snug text-slate-500">
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
                Fichaje correcto
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-base font-bold tabular-nums leading-tight text-slate-900">
                {horasNormal.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </span>
              <span className="mt-0.5 block min-h-[14px] text-[10px] text-slate-500">
                {registrosNormal} reg.
              </span>
            </span>
          </li>
          <li className="flex items-start justify-between gap-3 border-b border-slate-200 py-2.5 dark:border-slate-200">
            <span className="flex min-w-0 flex-1 items-start gap-2.5 pt-0.5">
              <span
                className="mt-0.5 h-3 w-3 shrink-0 rounded-sm shadow-sm ring-1 ring-slate-200/80"
                style={{ backgroundColor: cMan }}
                aria-hidden
              />
              <span className="text-[13px] leading-snug text-slate-600 dark:text-slate-700">
                Manual / corrección
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-base font-bold tabular-nums leading-tight text-slate-900">
                {horasManual.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </span>
              <span className="mt-0.5 block min-h-[14px] text-[10px] text-slate-500">
                {registrosManual} reg.
              </span>
            </span>
          </li>
          <li className="flex items-start justify-between gap-3 py-2.5">
            <span className="flex min-w-0 flex-1 items-start gap-2.5 pt-0.5">
              <span
                className="mt-0.5 h-3 w-3 shrink-0 rounded-sm shadow-sm ring-1 ring-red-300/80"
                style={{ backgroundColor: cGap }}
                aria-hidden
              />
              <span className="text-[13px] leading-snug text-slate-600 dark:text-slate-700">
                Laborables sin imputar (8 h/día)
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-base font-bold tabular-nums leading-tight text-red-700 dark:text-red-400">
                {horasSinImputar.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </span>
              <span className="mt-0.5 block min-h-[14px] text-[10px] text-slate-500">
                {diasSinImputar} día{diasSinImputar !== 1 ? "s" : ""}
              </span>
            </span>
          </li>
          {(totalReg > 0 || diasSinImputar > 0) && (
            <li className="border-t border-slate-200 pt-2.5 text-center text-[10px] font-medium text-slate-500 dark:border-slate-200">
              {totalReg} registro{totalReg !== 1 ? "s" : ""} imputados
              {diasSinImputar > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {diasSinImputar} sin imputar
                  </span>
                </>
              ) : null}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
});
