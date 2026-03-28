"use client";

/** Encabezado: cómo se calcula el objetivo del mes (el detalle vs imputado va en las donas). */
export function EquipoObjetivoMesEncabezado({
  diasLaborables,
  personasEnObjetivo,
  horasObjetivo,
  filtroTodasPersonas,
}: {
  diasLaborables: number;
  personasEnObjetivo: number;
  horasObjetivo: number;
  filtroTodasPersonas: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-agro-700 dark:text-agro-400">
        Objetivo del mes
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        <strong>{diasLaborables}</strong> días laborables (lun–vie) × <strong>8 h</strong>
        {filtroTodasPersonas ? (
          <>
            {" "}
            × <strong>{personasEnObjetivo}</strong> personas
          </>
        ) : null}{" "}
        →{" "}
        <strong className="text-slate-800 dark:text-slate-100">
          {horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
        </strong>{" "}
        objetivo teórico.
      </p>
    </div>
  );
}
