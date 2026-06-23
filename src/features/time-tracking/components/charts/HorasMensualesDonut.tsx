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

/**
 * Dona por **celdas laborables** (persona × día laborable en la rejilla del periodo):
 * con parte en servidor, con fichaje pero sin parte, sin fichaje.
 * Misma magnitud que los KPI «Fichaje en jornadas» / «Parte vs jornadas».
 */
export const HorasMensualesDonut = memo(function HorasMensualesDonut({
  celdasLaborables,
  celdasConFichaje,
  celdasConFichajeYParte,
  celdasConFichajeSinParteLaboral,
  periodo,
  bare = false,
  bareStack = false,
}: {
  celdasLaborables: number;
  celdasConFichaje: number;
  celdasConFichajeYParte: number;
  /** Cerradas de trabajo real sin parte (excluye vacaciones/baja). Si se omite, se infiere como cf − cy. */
  celdasConFichajeSinParteLaboral?: number;
  periodo: Periodo;
  bare?: boolean;
  bareStack?: boolean;
}) {
  const periodoLabel = PERIODO_LABEL[periodo] ?? "del periodo";
  const jl = Math.max(0, Math.round(celdasLaborables));
  const cf = Math.min(Math.max(0, Math.round(celdasConFichaje)), jl);
  const cy = Math.min(Math.max(0, Math.round(celdasConFichajeYParte)), cf);
  const sinParteLaboral =
    celdasConFichajeSinParteLaboral != null
      ? Math.min(Math.max(0, Math.round(celdasConFichajeSinParteLaboral)), cf)
      : Math.max(0, cf - cy);
  const ausenciaCubierta = Math.max(0, cf - cy - sinParteLaboral);
  const sinFichaje = Math.max(0, jl - cf);
  const safe = jl > 0 ? jl : 1;
  const pY = (cy / safe) * 100;
  const pAusencia = (ausenciaCubierta / safe) * 100;
  const pF = (sinParteLaboral / safe) * 100;
  const a1 = pY;
  const a2 = a1 + pAusencia;
  const a3 = a2 + pF;

  const cParte = "#16a34a";
  const cAusencia = "#6366f1";
  const cFichajeSinParte = "#38bdf8";
  const cSin = "#94a3b8";

  let gradient: string;
  if (jl <= 0) {
    gradient = "conic-gradient(from -90deg, #e2e8f0 0% 100%)";
  } else if (sinFichaje <= 0 && sinParteLaboral <= 0 && ausenciaCubierta <= 0) {
    gradient = `conic-gradient(from -90deg, ${cParte} 0% 100%)`;
  } else if (sinFichaje <= 0 && sinParteLaboral <= 0) {
    gradient =
      cy <= 0
        ? `conic-gradient(from -90deg, ${cAusencia} 0% 100%)`
        : `conic-gradient(from -90deg, ${cParte} 0% ${a1}%, ${cAusencia} ${a1}% 100%)`;
  } else if (sinFichaje <= 0 && ausenciaCubierta <= 0) {
    gradient =
      cy <= 0
        ? `conic-gradient(from -90deg, ${cFichajeSinParte} 0% 100%)`
        : `conic-gradient(from -90deg, ${cParte} 0% ${a1}%, ${cFichajeSinParte} ${a1}% 100%)`;
  } else if (sinParteLaboral <= 0 && ausenciaCubierta <= 0 && cy <= 0) {
    gradient = `conic-gradient(from -90deg, ${cSin} 0% 100%)`;
  } else {
    gradient = `conic-gradient(from -90deg, ${cParte} 0% ${a1}%, ${cAusencia} ${a1}% ${a2}%, ${cFichajeSinParte} ${a2}% ${a3}%, ${cSin} ${a3}% 100%)`;
  }

  const pctParteSobreLaborables = jl > 0 ? Math.round((cy / jl) * 1000) / 10 : 0;

  const shell = bare
    ? "flex w-full min-w-0 max-w-full flex-col"
    : "equipo-dona-card flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200/65 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-4 sm:py-4 dark:border-slate-700/75 dark:bg-slate-900/45 dark:shadow-none";

  const ariaResumen =
    jl > 0
      ? `${jl} celdas laborables: ${cy} con fichaje y parte, ${sinParteLaboral} trabajo sin parte, ${ausenciaCubierta} vacaciones/festivo/baja cubiertas, ${sinFichaje} sin fichaje.`
      : "Sin celdas laborables en el filtro.";

  const filaMetricas = (
    <div className="grid w-full min-w-0 grid-cols-3 gap-1.5 sm:gap-2" role="presentation">
      <div className="rounded-lg border border-slate-200/80 bg-slate-50/90 px-1.5 py-2 text-center dark:border-slate-600/70 dark:bg-slate-900/50">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Laborables
        </p>
        <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{jl}</p>
      </div>
      <div className="rounded-lg border border-sky-200/70 bg-sky-50/80 px-1.5 py-2 text-center dark:border-sky-900/40 dark:bg-sky-950/30">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          Con fichaje
        </p>
        <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{cf}</p>
      </div>
      <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/85 px-1.5 py-2 text-center dark:border-emerald-900/45 dark:bg-emerald-950/30">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
          Fichaje + parte
        </p>
        <p className="mt-1 text-lg font-bold tabular-nums text-emerald-900 dark:text-emerald-100">{cy}</p>
      </div>
    </div>
  );

  const donutBlock = (
    <div className="flex w-full flex-col items-center gap-1">
      <div className="relative mx-auto h-[6.75rem] w-[6.75rem] shrink-0 sm:h-[7.5rem] sm:w-[7.5rem]">
        <div
          className="h-full w-full rounded-full shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-600/80"
          style={{
            background: gradient,
            mask: "radial-gradient(transparent 55%, black 56%)",
            WebkitMask: "radial-gradient(transparent 55%, black 56%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 text-center">
          {jl > 0 ? (
            <span className="text-xl font-bold leading-none tabular-nums text-emerald-800 sm:text-2xl dark:text-emerald-400">
              {pctParteSobreLaborables}%
            </span>
          ) : (
            <span className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">—</span>
          )}
        </div>
      </div>
      {jl > 0 ? (
        <p className="text-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Parte / laborables
        </p>
      ) : null}
    </div>
  );

  const leyendaColores = (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-600 dark:text-slate-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: cParte }} aria-hidden />
        Parte
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: cAusencia }} aria-hidden />
        Vacaciones / festivo / baja
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: cFichajeSinParte }} aria-hidden />
        Sin parte
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: cSin }} aria-hidden />
        Sin fichaje
      </span>
    </div>
  );

  return (
    <div className={shell} role="img" aria-label={ariaResumen}>
      <p
        className={`mb-2 font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 ${bare ? "text-left text-sm sm:text-base" : "text-center text-sm sm:text-base"}`}
      >
        Fichaje y parte {periodoLabel}
      </p>
      {filaMetricas}
      {bare ? (
        bareStack ? (
          <div className="mt-3 flex min-h-0 w-full flex-col items-stretch gap-3">
            {donutBlock}
            {leyendaColores}
          </div>
        ) : (
          <div className="mt-3 flex min-h-0 w-full flex-col items-stretch gap-4 lg:flex-row lg:items-center lg:gap-5">
            <div className="flex min-w-0 flex-1 flex-col justify-center">{leyendaColores}</div>
            <div className="flex shrink-0 flex-col items-center justify-center lg:pl-1">{donutBlock}</div>
          </div>
        )
      ) : (
        <div className="mt-3 flex min-h-0 flex-col items-center gap-2">
          {donutBlock}
          {leyendaColores}
        </div>
      )}
    </div>
  );
});
