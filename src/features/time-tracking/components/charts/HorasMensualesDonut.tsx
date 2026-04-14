"use client";

import { memo } from "react";

type Periodo = "dia" | "semana" | "mes" | "trimestre" | "anio";

const PERIODO_LABEL: Record<Periodo, string> = {
  dia: "del día",
  semana: "de la semana",
  mes: "del mes",
  trimestre: "del trimestre",
  anio: "del año",
};

/** Dona: imputado (verde), falta (gris), extra (coral). Estilo tipo gráfico circular con leyenda. */
export const HorasMensualesDonut = memo(function HorasMensualesDonut({
  horasImputadoHastaTope,
  horasFalta,
  horasExtra,
  horasObjetivo,
  horasImputadasTotal,
  registrosEnPeriodo,
  periodo,
  /** Sin marco propio: para incrustar dentro de una tarjeta contenedora (p. ej. team-hours). */
  bare = false,
  /** En columnas estrechas: leyenda arriba y dona centrada (sin reparto horizontal). */
  bareStack = false,
}: {
  horasImputadoHastaTope: number;
  horasFalta: number;
  horasExtra: number;
  horasObjetivo: number;
  horasImputadasTotal: number;
  registrosEnPeriodo: number;
  periodo: Periodo;
  bare?: boolean;
  bareStack?: boolean;
}) {
  const periodoLabel = PERIODO_LABEL[periodo] ?? "del periodo";
  const t = horasImputadoHastaTope + horasFalta + horasExtra;
  const safe = t > 0 ? t : 1;
  const p1 = (horasImputadoHastaTope / safe) * 100;
  const p2 = (horasFalta / safe) * 100;
  const p3 = (horasExtra / safe) * 100;
  const a1 = p1;
  const a2 = a1 + p2;
  let gradient: string;
  /* Paleta app; verdes un poco más saturados para leer bien sobre fondo blanco */
  const cImp = "#16a34a";
  const cFalta = "#94a3b8";
  const cExtra = "#d97706";
  if (horasExtra > 0.01 && horasFalta > 0.01) {
    gradient = `conic-gradient(from -90deg, ${cImp} 0% ${a1}%, ${cFalta} ${a1}% ${a2}%, ${cExtra} ${a2}% 100%)`;
  } else if (horasExtra > 0.01) {
    gradient = `conic-gradient(from -90deg, ${cImp} 0% ${a1}%, ${cExtra} ${a1}% 100%)`;
  } else if (horasFalta > 0.01) {
    gradient = `conic-gradient(from -90deg, ${cImp} 0% ${a1}%, ${cFalta} ${a1}% 100%)`;
  } else {
    gradient = `conic-gradient(from -90deg, ${cImp} 0% 100%)`;
  }
  const pctVsObjetivo =
    horasObjetivo > 0
      ? Math.round((horasImputadasTotal / horasObjetivo) * 1000) / 10
      : 0;

  const leyenda: { color: string; label: string; h: number }[] = [
    { color: cImp, label: "Horas imputadas (hasta tope)", h: horasImputadoHastaTope },
    { color: cFalta, label: "Falta para objetivo", h: horasFalta },
  ];
  if (horasExtra > 0.01) {
    leyenda.push({ color: cExtra, label: "Horas extra", h: horasExtra });
  }

  // Suppress unused variable warning for p3
  void p3;

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
            className="mt-1 h-3.5 w-3.5 shrink-0 rounded-sm border-2 border-slate-500 bg-slate-100 dark:border-slate-400 dark:bg-slate-200"
            aria-hidden
          />
          <span className="font-semibold leading-snug text-slate-800 dark:text-slate-100">
            Objetivo teórico
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-lg font-bold tabular-nums leading-tight text-slate-900 dark:text-white">
            {horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
          </span>
          <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">tope {periodoLabel}</span>
        </span>
      </li>
      {leyenda.map((item, idx) => (
        <li
          key={item.label}
          className={`flex items-start justify-between gap-3 py-2.5 ${
            idx < leyenda.length - 1 ? "border-b border-slate-200 dark:border-slate-600/70" : ""
          }`}
        >
          <span className="flex min-w-0 flex-1 items-start gap-2.5">
            <span
              className="mt-1 h-3.5 w-3.5 shrink-0 rounded-sm ring-2 ring-slate-200/90"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span className="font-medium leading-snug text-slate-800 dark:text-slate-200">{item.label}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-lg font-bold tabular-nums leading-tight text-slate-900 dark:text-white">
              {item.h.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
            </span>
            <span className="mt-1 block min-h-[1.125rem] text-sm text-slate-500 dark:text-slate-500">&nbsp;</span>
          </span>
        </li>
      ))}
      {registrosEnPeriodo > 0 && (
        <li className="border-t border-slate-200 pt-2.5 text-center text-sm font-medium text-slate-600 dark:border-slate-600/70 dark:text-slate-300">
          {registrosEnPeriodo} registro{registrosEnPeriodo !== 1 ? "s" : ""} en el periodo
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
          <span className="text-2xl font-bold leading-none tabular-nums text-agro-800 sm:text-3xl dark:text-emerald-400">
            {pctVsObjetivo}%
          </span>
        </div>
      </div>
      <p className="max-w-[14rem] px-1 text-center text-sm font-medium leading-snug text-slate-700 dark:text-slate-300 sm:text-base">
        {pctVsObjetivo > 100 ? "Sobre el objetivo" : "Del objetivo cubierto"}
      </p>
    </div>
  );

  return (
    <div className={shell}>
      <p
        className={`mb-3 font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 ${bare ? "text-left text-base sm:text-lg" : "text-center text-sm sm:text-base"}`}
      >
        Distribución {periodoLabel} (objetivo vs imputado)
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
