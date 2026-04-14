"use client";

import { memo, type ReactNode } from "react";

const surfaceClass =
  "relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200/65 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-3 sm:py-2.5 dark:border-slate-700/75 dark:bg-slate-900/45 dark:shadow-none";

const accentBar: Record<"emerald" | "sky" | "amber" | "violet" | "rose", string> = {
  emerald: "from-agro-500 to-emerald-600",
  sky: "from-sky-500 to-blue-600",
  amber: "from-amber-500 to-orange-600",
  violet: "from-violet-500 to-purple-600",
  rose: "from-rose-500 to-red-600",
};

/** Fracción grande: con parte / jornadas registradas (ficha cerrada). */
export const EquipoKpiFraccionParte = memo(function EquipoKpiFraccionParte({
  conParte,
  jornadasRegistradas,
}: {
  conParte: number;
  jornadasRegistradas: number;
}) {
  return (
    <div
      className="flex flex-col gap-0.5"
      role="group"
      aria-label={`${conParte} con parte de ${jornadasRegistradas} jornadas registradas`}
    >
      <div className="flex items-baseline gap-1.5 tabular-nums">
        <span className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
          {conParte.toLocaleString("es-ES")}
        </span>
        <span
          className="select-none text-lg font-extralight text-slate-300 sm:text-xl dark:text-slate-600"
          aria-hidden
        >
          /
        </span>
        <span className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
          {jornadasRegistradas.toLocaleString("es-ES")}
        </span>
      </div>
      <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
        Parte servidor / jornadas con entrada y salida (periodo filtrado).
      </p>
    </div>
  );
});

/** Fracción: con fichaje / jornadas laborables en la rejilla (persona × día laborable). */
export const EquipoKpiFraccionFichaje = memo(function EquipoKpiFraccionFichaje({
  conFichaje,
  jornadasLaborables,
}: {
  conFichaje: number;
  jornadasLaborables: number;
}) {
  return (
    <div
      className="flex flex-col gap-0.5"
      role="group"
      aria-label={`${conFichaje} con fichaje de ${jornadasLaborables} jornadas laborables`}
    >
      <div className="flex items-baseline gap-1.5 tabular-nums">
        <span className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
          {conFichaje.toLocaleString("es-ES")}
        </span>
        <span
          className="select-none text-lg font-extralight text-slate-300 sm:text-xl dark:text-slate-600"
          aria-hidden
        >
          /
        </span>
        <span className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
          {jornadasLaborables.toLocaleString("es-ES")}
        </span>
      </div>
      <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
        Fichaje / celdas laborables (persona × día en la vista).
      </p>
    </div>
  );
});

/** Tarjeta KPI reutilizable (Horas del equipo y vistas similares). */
export const EquipoKpiStatCard = memo(function EquipoKpiStatCard({
  titulo,
  valorPrincipal,
  detalle,
  pie,
  accent = "emerald",
}: {
  titulo: ReactNode;
  valorPrincipal: ReactNode;
  detalle?: ReactNode;
  pie?: ReactNode;
  accent?: keyof typeof accentBar;
}) {
  const bar = accentBar[accent];
  return (
    <div className={surfaceClass}>
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b ${bar} opacity-90`}
        aria-hidden
      />
      <p className="pl-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500 dark:text-slate-400">
        {titulo}
      </p>
      <div className="mt-1 flex min-h-0 flex-1 flex-col pl-1">
        <div className="min-h-0">{valorPrincipal}</div>
        {detalle ? (
          <div className="mt-0.5 text-xs leading-snug text-slate-600 dark:text-slate-400">
            {detalle}
          </div>
        ) : null}
        {pie ? (
          <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
            {pie}
          </p>
        ) : null}
      </div>
    </div>
  );
});
