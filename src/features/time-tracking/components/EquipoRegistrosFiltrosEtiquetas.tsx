"use client";

import type { EquipoTablaFiltroExtra } from "@/features/time-tracking/types";

type EquipoPeriodoVista = "dia" | "semana" | "mes" | "trimestre" | "anio";

const TITULO_PERIODO: Record<EquipoPeriodoVista, string> = {
  dia: "Día",
  semana: "Semana",
  mes: "Mes",
  trimestre: "Trimestre",
  anio: "Año",
};

/** Estilo «Fin de semana» de la referencia: fondo azul muy suave y borde. */
const chipInfoClass =
  "inline-flex max-w-full items-center rounded-full border border-sky-200/95 bg-sky-50/95 px-2.5 py-1 text-[10px] font-semibold leading-tight text-sky-950 shadow-sm dark:border-sky-800/90 dark:bg-sky-950/40 dark:text-sky-50";

/** Estilo «Alerta laboral»: rojo suave sin borde marcado. */
const chipRoseClass =
  "inline-flex max-w-full items-center rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-semibold leading-tight text-rose-900 dark:bg-rose-950/55 dark:text-rose-100";

const chipAmberClass =
  "inline-flex max-w-full items-center rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold leading-tight text-amber-950 shadow-sm dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-50";

const chipTealClass =
  "inline-flex max-w-full items-center rounded-full border border-teal-200/90 bg-teal-50 px-2.5 py-1 text-[10px] font-semibold leading-tight text-teal-950 shadow-sm dark:border-teal-800/80 dark:bg-teal-950/40 dark:text-teal-50";

export interface EquipoRegistrosFiltrosEtiquetasProps {
  periodo: EquipoPeriodoVista;
  /** Texto ya resuelto del rango (fecha, mes, trimestre, año…). */
  periodoRangoTexto: string;
  /** Con periodo «Año»: mes que lista la tabla (solo nombre, p. ej. «Abril»). */
  vistaTablaMesNombre?: string | null;
  /** Con periodo «Año»: año visible en la tabla (p. ej. «2026»). */
  vistaTablaAnioTexto?: string | null;
  empresaNombre?: string | null;
  personaNombre?: string | null;
  servicioNombre?: string | null;
  filtroExtra: EquipoTablaFiltroExtra;
  className?: string;
}

/**
 * Etiquetas de contexto encima de la tabla «Registros» (Horas del equipo / panel manager):
 * periodo siempre, y chips adicionales cuando hay alcance o vista rápida activa.
 */
export function EquipoRegistrosFiltrosEtiquetas({
  periodo,
  periodoRangoTexto,
  vistaTablaMesNombre,
  vistaTablaAnioTexto,
  empresaNombre,
  personaNombre,
  servicioNombre,
  filtroExtra,
  className = "",
}: EquipoRegistrosFiltrosEtiquetasProps) {
  const rango = periodoRangoTexto.trim();
  const titulo = TITULO_PERIODO[periodo];

  const chips: { key: string; className: string; text: string }[] = [];
  chips.push({
    key: "periodo",
    className: chipInfoClass,
    text: rango ? `${titulo} · ${rango}` : titulo,
  });

  if (
    periodo === "anio" &&
    vistaTablaMesNombre?.trim() &&
    vistaTablaAnioTexto?.trim()
  ) {
    chips.push({
      key: "tabla-mes",
      className: chipInfoClass,
      text: `Tabla · ${vistaTablaMesNombre.trim()} ${vistaTablaAnioTexto.trim()}`,
    });
  }

  const emp = empresaNombre?.trim();
  if (emp) {
    chips.push({ key: "empresa", className: chipInfoClass, text: `Empresa · ${emp}` });
  }

  const per = personaNombre?.trim();
  if (per) {
    chips.push({ key: "persona", className: chipInfoClass, text: `Persona · ${per}` });
  }

  const svc = servicioNombre?.trim();
  if (svc) {
    chips.push({ key: "servicio", className: chipInfoClass, text: `Servicio · ${svc}` });
  }

  if (filtroExtra === "soloSinImputar") {
    chips.push({ key: "vx-sin-fichar", className: chipRoseClass, text: "Vista · Sin fichar" });
  } else if (filtroExtra === "soloSinParteServidor") {
    chips.push({ key: "vx-sin-parte", className: chipAmberClass, text: "Vista · Sin parte" });
  } else if (filtroExtra === "soloConParteServidor") {
    chips.push({ key: "vx-con-parte", className: chipTealClass, text: "Vista · Con parte" });
  }

  return (
    <div
      className={`border-b border-slate-100 bg-slate-50/60 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/35 ${className}`.trim()}
      role="status"
      aria-label="Filtros aplicados a la tabla de registros"
    >
      <p className="sr-only">
        Filtros activos: {chips.map((c) => c.text).join(", ")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <span key={c.key} className={c.className}>
            {c.text}
          </span>
        ))}
      </div>
    </div>
  );
}
