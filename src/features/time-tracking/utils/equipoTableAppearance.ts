import type { EquipoAusenciaEtiquetaKind } from "@/features/time-tracking/utils/formatters";
import { timeEntryApiStatusBadgeClass } from "@/features/time-tracking/utils/timeEntryApiStatus";

export const equipoTablaEtiquetaBaseClass =
  "inline-flex max-w-full rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-tight";

/** Etiqueta «Sin imputar» en columna Estado (día laborable sin fichaje). */
export const equipoTablaSinImputarBadgeClass =
  "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100";

export function equipoTablaEtiquetaAusencia(kind: EquipoAusenciaEtiquetaKind): {
  label: string;
  badgeClass: string;
} {
  const apiStatus = kind === "vacaciones" ? "Vacation" : kind === "baja" ? "SickLeave" : "NonWorkingDay";
  const label = kind === "vacaciones" ? "Vacaciones" : kind === "baja" ? "Baja" : "No laboral";
  return { label, badgeClass: timeEntryApiStatusBadgeClass(apiStatus) };
}

export function equipoTablaZebraStripeBg(rowIndex: number): string {
  return rowIndex % 2 === 0
    ? "bg-white dark:bg-slate-900/50"
    : "bg-slate-50 dark:bg-slate-900/70";
}

export function equipoTablaZebraRowClass(rowIndex: number): string {
  return `border-t border-slate-100 text-slate-900 dark:border-slate-800 dark:text-slate-100 ${equipoTablaZebraStripeBg(rowIndex)}`;
}
