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
 * Encabezado del objetivo del periodo: kicker + fórmula compacta.
 * Estilo alineado con el resto de tarjetas (agro-kicker / agro-muted).
 */
export const EquipoObjetivoMesEncabezado = memo(function EquipoObjetivoMesEncabezado({
  diasLaborables,
  personasEnObjetivo,
  horasObjetivo,
  filtroTodasPersonas,
  periodo,
  compact,
}: {
  diasLaborables: number;
  personasEnObjetivo: number;
  horasObjetivo: number;
  filtroTodasPersonas: boolean;
  periodo: Periodo;
  compact?: boolean;
}) {
  const periodoLabel = PERIODO_LABEL[periodo] ?? "del periodo";
  const horasObjetivoFmt = horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 });

  return (
    <div className="min-w-0">
      <p className="agro-kicker">Objetivo {periodoLabel}</p>
      <p className={`agro-muted leading-snug ${compact ? "mt-1" : "mt-1.5"}`}>
        <span className="font-semibold text-slate-700 tabular-nums dark:text-slate-200">
          {diasLaborables}
        </span>{" "}
        días (lun–vie) ×{" "}
        <span className="font-semibold text-slate-700 tabular-nums dark:text-slate-200">8 h</span>
        {filtroTodasPersonas ? (
          <>
            {" "}
            ×{" "}
            <span className="font-semibold text-slate-700 tabular-nums dark:text-slate-200">
              {personasEnObjetivo}
            </span>{" "}
            pers.
          </>
        ) : null}
        {" · "}
        <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
          {horasObjetivoFmt} h
        </span>
        <span className="text-slate-400 dark:text-slate-500"> objetivo teórico</span>
      </p>
    </div>
  );
});
