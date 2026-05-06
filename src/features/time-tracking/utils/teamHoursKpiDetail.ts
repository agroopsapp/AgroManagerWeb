import type { EquipoTablaFila } from "@/features/time-tracking/types";
import {
  effectiveWorkMinutesEntry,
  equipoAbsenceEtiquetaKind,
  timeEntryConParteEnServidor,
} from "@/features/time-tracking/utils/formatters";
import { formatMinutesShort } from "@/shared/utils/time";

/**
 * Desglose KPI: filas pastilla + rejilla inferior (`TeamHoursEquipoKpiSection`).
 * `jornadasFichadas` / `sinImputarMetric` repiten criterio de `haFichado` / `sinFichar` con otro título en modal.
 */
export type TeamHoursKpiDetailKind =
  | "haFichado"
  | "sinFichar"
  | "vacaciones"
  | "sinParte"
  | "horasImputadas"
  | "jornadasFichadas"
  | "partesCompletados"
  | "sinImputarMetric";

export type TeamHoursKpiDetailRow = {
  nombre: string;
  /** ISO fecha jornada YYYY-MM-DD */
  fechaIso: string;
  /** p. ej. horas imputadas ese día en la jornada */
  detalle?: string;
};

/**
 * Desglose por persona/día alineado con el recuento en `TeamHoursEquipoKpiSection`
 * (misma iteración que los contadores haFichado / sinFichar / vacaciones / sinParte).
 */
export function buildTeamHoursKpiDetailRows(
  filas: EquipoTablaFila[],
  resolveNombre: (f: EquipoTablaFila) => string,
  kind: TeamHoursKpiDetailKind,
): TeamHoursKpiDetailRow[] {
  const out: TeamHoursKpiDetailRow[] = [];

  for (const fila of filas) {
    const nombre = resolveNombre(fila).trim() || "—";
    const fechaIso = fila.kind === "registro" ? fila.e.workDate : fila.workDate;

    if (kind === "sinFichar" || kind === "sinImputarMetric") {
      if (fila.kind === "sinImputar") out.push({ nombre, fechaIso });
      continue;
    }

    if (fila.kind !== "registro") continue;
    const e = fila.e;

    if (kind === "haFichado" || kind === "jornadasFichadas") {
      out.push({ nombre, fechaIso });
      continue;
    }

    if (kind === "horasImputadas") {
      const min = effectiveWorkMinutesEntry(e);
      out.push({
        nombre,
        fechaIso,
        detalle: `Imputado: ${formatMinutesShort(min)}`,
      });
      continue;
    }

    if (kind === "vacaciones") {
      if (equipoAbsenceEtiquetaKind(e) === "vacaciones") out.push({ nombre, fechaIso });
      continue;
    }

    if (kind === "partesCompletados") {
      if (e.checkOutUtc && timeEntryConParteEnServidor(e)) {
        out.push({ nombre, fechaIso });
      }
      continue;
    }

    if (kind === "sinParte") {
      if (e.checkOutUtc && !timeEntryConParteEnServidor(e)) {
        out.push({ nombre, fechaIso });
      }
    }
  }

  return out.sort((a, b) => {
    const n = a.nombre.localeCompare(b.nombre, "es");
    if (n !== 0) return n;
    return a.fechaIso.localeCompare(b.fechaIso);
  });
}
