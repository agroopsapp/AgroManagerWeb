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

/** Encabezado: cómo se calcula el objetivo del periodo (el detalle vs imputado va en las donas). */
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
      <p className="mt-1 text-sm leading-snug text-slate-700 dark:text-slate-200">
        <strong className="font-bold text-slate-900 dark:text-white">{diasLaborables}</strong> días
        laborables (lun–vie) × <strong className="font-bold text-slate-900 dark:text-white">8 h</strong>
        {filtroTodasPersonas ? (
          <>
            {" "}
            ×{" "}
            <strong className="font-bold text-slate-900 dark:text-white">{personasEnObjetivo}</strong>{" "}
            personas
          </>
        ) : null}{" "}
        →{" "}
        <strong className="text-lg font-bold tabular-nums text-agro-800 dark:text-agro-300">
          {horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
        </strong>{" "}
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">objetivo teórico.</span>
      </p>
    </div>
  );
});
