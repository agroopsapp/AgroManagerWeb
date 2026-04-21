"use client";

import { memo, useMemo } from "react";
import { formatMinutesShort } from "@/shared/utils/time";

function clamp01(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1, n);
}

export type EquipoKpiResumenBarrasProps = {
  totalMinutosImputados: number;
  totalHorasDecimal: number;
  registros: number;
  /** Tope de referencia para la barra de horas (objetivo del periodo en la vista). */
  horasObjetivoTeorico: number;
  fichajeCon: number;
  fichajeJornadasLaborables: number;
  parteCon: number;
  parteJornadasRegistradas: number;
  registradasSinParte: number;
  diasSinImputar: number;
};

type BarRow = {
  key: string;
  titulo: string;
  barClass: string;
  ratio: number;
  valor: string;
  pie: string;
};

/**
 * Misma información que las cinco tarjetas KPI de Horas del equipo, en barras horizontales.
 * Cada barra usa una escala acotada al propio indicador (0–100 % del contexto del dato).
 */
export const EquipoKpiResumenBarras = memo(function EquipoKpiResumenBarras({
  totalMinutosImputados,
  totalHorasDecimal,
  registros,
  horasObjetivoTeorico,
  fichajeCon,
  fichajeJornadasLaborables,
  parteCon,
  parteJornadasRegistradas,
  registradasSinParte,
  diasSinImputar,
}: EquipoKpiResumenBarrasProps) {
  const rows = useMemo((): BarRow[] => {
    const denomHoras = Math.max(horasObjetivoTeorico, totalHorasDecimal, 1e-6);
    const rHoras = totalHorasDecimal / denomHoras;

    const rFichaje =
      fichajeJornadasLaborables > 0 ? fichajeCon / fichajeJornadasLaborables : 0;
    const rParte =
      parteJornadasRegistradas > 0 ? parteCon / parteJornadasRegistradas : 0;
    const rSinParte =
      parteJornadasRegistradas > 0 ? registradasSinParte / parteJornadasRegistradas : 0;
    const rSinImp =
      fichajeJornadasLaborables > 0 ? diasSinImputar / fichajeJornadasLaborables : 0;

    const hDec = totalHorasDecimal.toLocaleString("es-ES", {
      minimumFractionDigits: totalHorasDecimal % 1 ? 1 : 0,
      maximumFractionDigits: 1,
    });

    return [
      {
        key: "horas",
        titulo: "Horas imputadas",
        barClass: "from-agro-500 to-emerald-600",
        ratio: clamp01(rHoras),
        valor: `${formatMinutesShort(totalMinutosImputados)} · ${hDec} h dec.`,
        pie: `${registros.toLocaleString("es-ES")} ${registros === 1 ? "registro" : "registros"}`,
      },
      {
        key: "fichaje",
        titulo: "Fichaje en jornadas",
        barClass: "from-violet-500 to-purple-600",
        ratio: clamp01(rFichaje),
        valor: `${fichajeCon.toLocaleString("es-ES")} / ${fichajeJornadasLaborables.toLocaleString("es-ES")}`,
        pie: "Fichaje / celdas laborables (persona × día en la vista).",
      },
      {
        key: "parte",
        titulo: "Parte vs jornadas registradas",
        barClass: "from-sky-500 to-blue-600",
        ratio: clamp01(rParte),
        valor: `${parteCon.toLocaleString("es-ES")} / ${parteJornadasRegistradas.toLocaleString("es-ES")}`,
        pie: "Parte servidor / jornadas con entrada y salida (periodo filtrado).",
      },
      {
        key: "sinParte",
        titulo: "Registradas pero sin parte",
        barClass: "from-amber-500 to-orange-600",
        ratio: clamp01(rSinParte),
        valor: registradasSinParte.toLocaleString("es-ES"),
        pie: "Jornada cerrada sin parte en servidor.",
      },
      {
        key: "sinImputar",
        titulo: "Días sin imputar",
        barClass: "from-rose-500 to-red-600",
        ratio: clamp01(rSinImp),
        valor: diasSinImputar.toLocaleString("es-ES"),
        pie: "Celdas laborables sin fichaje (coherente con la tabla).",
      },
    ];
  }, [
    diasSinImputar,
    fichajeCon,
    fichajeJornadasLaborables,
    horasObjetivoTeorico,
    parteCon,
    parteJornadasRegistradas,
    registros,
    registradasSinParte,
    totalHorasDecimal,
    totalMinutosImputados,
  ]);

  return (
    <div
      className="rounded-lg border border-slate-300 bg-white px-2.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-3 sm:py-3 dark:border-slate-600 dark:bg-slate-900/45 dark:shadow-none"
      role="img"
      aria-label="Gráfico de barras: mismos cinco indicadores que las tarjetas KPI"
    >
      <ul className="space-y-2.5 sm:space-y-3">
        {rows.map((row) => (
          <li key={row.key} className="min-w-0">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <p className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:w-[11.5rem] sm:pt-0.5">
                {row.titulo}
              </p>
              <div className="min-w-0 flex-1">
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                  role="presentation"
                  aria-hidden
                >
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${row.barClass} transition-[width] duration-300 ease-out`}
                    style={{ width: `${row.ratio * 100}%` }}
                  />
                </div>
              </div>
              <p className="shrink-0 text-right text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100 sm:min-w-[10rem] sm:text-sm">
                {row.valor}
              </p>
            </div>
            <p className="mt-0.5 pl-0 text-[11px] leading-snug text-slate-500 dark:text-slate-400 sm:pl-[12.5rem]">
              {row.pie}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
});
