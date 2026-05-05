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

/** Encabezado compacto: tope en negrita y fórmula en una sola línea secundaria. */
export const EquipoObjetivoMesEncabezado = memo(function EquipoObjetivoMesEncabezado({
  diasLaborables,
  personasEnObjetivo,
  horasObjetivo,
  filtroTodasPersonas,
  periodo,
}: {
  diasLaborables: number;
  personasEnObjetivo: number;
  horasObjetivo: number;
  filtroTodasPersonas: boolean;
  periodo: Periodo;
}) {
  const periodoLabel = PERIODO_LABEL[periodo] ?? "del periodo";

  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
        Objetivo {periodoLabel}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm leading-snug">
        <strong className="text-lg font-bold tabular-nums text-agro-800 dark:text-agro-300">
          {horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
        </strong>
        <span className="text-slate-500 dark:text-slate-400">·</span>
        <span className="text-slate-600 dark:text-slate-300">
          {diasLaborables} laborables × 8 h
          {filtroTodasPersonas ? (
            <>
              {" "}
              × {personasEnObjetivo} {personasEnObjetivo === 1 ? "persona" : "personas"}
            </>
          ) : null}
        </span>
      </p>
    </div>
  );
});
