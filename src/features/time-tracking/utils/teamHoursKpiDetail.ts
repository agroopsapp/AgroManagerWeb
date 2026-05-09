import type { EquipoTablaFila, TimeEntryMock } from "@/features/time-tracking/types";
import {
  effectiveWorkMinutesEntry,
  equipoAbsenceEtiquetaKind,
  equipoRegistroOcultaHorasEnTabla,
  formatRazonTablaEquipo,
  timeEntryConParteEnServidor,
  workReportParteApiSummary,
} from "@/features/time-tracking/utils/formatters";
import { formatMinutesShort, formatTimeLocal } from "@/shared/utils/time";

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
  /** Clave estable para lista / expandir fila. */
  rowKey: string;
  nombre: string;
  /** ISO fecha jornada YYYY-MM-DD */
  fechaIso: string;
  /** p. ej. horas imputadas ese día en la jornada */
  detalle?: string;
  /** Líneas extra para el panel desplegable (sin nuevas peticiones HTTP). */
  detailLines: { label: string; value: string }[];
};

function stableEquipoRowKey(fila: EquipoTablaFila): string {
  if (fila.kind === "registro") {
    return `te-${fila.e.id}-${fila.e.workDate}`;
  }
  if (fila.kind === "sinImputar") {
    return `si-${fila.workerId}-${fila.workDate}`;
  }
  return `nl-${fila.workerId}-${fila.workDate}`;
}

function apiStatusEs(s: TimeEntryMock["timeEntryStatus"]): string {
  switch (s) {
    case "Open":
      return "Abierta";
    case "Closed":
      return "Cerrada";
    case "Vacation":
      return "Vacaciones";
    case "SickLeave":
      return "Baja / ausencia";
    case "NonWorkingDay":
      return "No laboral";
    case "unknown":
      return "Desconocido";
    default:
      return "—";
  }
}

/**
 * Texto detallado de una fila de equipo para el modal KPI (datos ya en memoria).
 */
export function buildEquipoFilaDetailLines(fila: EquipoTablaFila): { label: string; value: string }[] {
  if (fila.kind === "sinImputar") {
    return [
      {
        label: "Situación",
        value:
          "Día laborable sin jornada imputada en la tabla con los filtros actuales (no consta fichaje en los datos cargados).",
      },
    ];
  }
  if (fila.kind === "noLaboral") {
    return [
      {
        label: "Situación",
        value: "Registro marcado como no laboral o fuera del patrón estándar de jornada.",
      },
    ];
  }

  const e = fila.e;
  const lines: { label: string; value: string }[] = [];
  const ocultaHoras = equipoRegistroOcultaHorasEnTabla(e);

  if (ocultaHoras) {
    lines.push({ label: "Motivo", value: formatRazonTablaEquipo(e) });
  } else {
    lines.push({ label: "Entrada", value: formatTimeLocal(e.checkInUtc) });
    lines.push({
      label: "Salida",
      value: e.checkOutUtc ? formatTimeLocal(e.checkOutUtc) : "— (jornada abierta)",
    });
    const br = e.breakMinutes ?? 0;
    if (br > 0) {
      lines.push({ label: "Descanso declarado", value: `${br} min` });
    }
    lines.push({
      label: "Duración neta",
      value: formatMinutesShort(effectiveWorkMinutesEntry(e)),
    });
  }

  const st = e.timeEntryStatus;
  if (st && st !== "unknown") {
    lines.push({ label: "Estado (API)", value: apiStatusEs(st) });
  } else if (!ocultaHoras) {
    lines.push({
      label: "Cierre",
      value: e.checkOutUtc ? "Jornada cerrada" : "Jornada abierta",
    });
  }

  const parte = workReportParteApiSummary(e);
  lines.push({
    label: "Parte en servidor",
    value: parte.tieneParte ? `Sí${parte.detalle ? ` · ${parte.detalle}` : ""}` : "No",
  });
  if (timeEntryConParteEnServidor(e) && e.workReportLinesSummary?.trim()) {
    const t = e.workReportLinesSummary.trim();
    lines.push({
      label: "Imputación (resumen)",
      value: t.length > 280 ? `${t.slice(0, 280)}…` : t,
    });
  }
  if (e.workAreaName?.trim()) {
    lines.push({ label: "Zona / área", value: e.workAreaName.trim() });
  }
  if (e.cierreAutomaticoMedianoche) {
    lines.push({
      label: "Nota",
      value:
        "El sistema cerró la jornada a medianoche; puede requerir confirmación del trabajador.",
    });
  }
  if (e.timeEntryId?.trim()) {
    lines.push({ label: "Id. fichaje", value: e.timeEntryId.trim() });
  }
  return lines;
}

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
      if (fila.kind === "sinImputar") {
        out.push({
          rowKey: stableEquipoRowKey(fila),
          nombre,
          fechaIso,
          detailLines: buildEquipoFilaDetailLines(fila),
        });
      }
      continue;
    }

    if (fila.kind !== "registro") continue;
    const e = fila.e;

    if (kind === "haFichado" || kind === "jornadasFichadas") {
      out.push({
        rowKey: stableEquipoRowKey(fila),
        nombre,
        fechaIso,
        detailLines: buildEquipoFilaDetailLines(fila),
      });
      continue;
    }

    if (kind === "horasImputadas") {
      const min = effectiveWorkMinutesEntry(e);
      out.push({
        rowKey: stableEquipoRowKey(fila),
        nombre,
        fechaIso,
        detalle: `Imputado: ${formatMinutesShort(min)}`,
        detailLines: buildEquipoFilaDetailLines(fila),
      });
      continue;
    }

    if (kind === "vacaciones") {
      if (equipoAbsenceEtiquetaKind(e) === "vacaciones") {
        out.push({
          rowKey: stableEquipoRowKey(fila),
          nombre,
          fechaIso,
          detailLines: buildEquipoFilaDetailLines(fila),
        });
      }
      continue;
    }

    if (kind === "partesCompletados") {
      if (e.checkOutUtc && timeEntryConParteEnServidor(e)) {
        out.push({
          rowKey: stableEquipoRowKey(fila),
          nombre,
          fechaIso,
          detailLines: buildEquipoFilaDetailLines(fila),
        });
      }
      continue;
    }

    if (kind === "sinParte") {
      if (e.checkOutUtc && !timeEntryConParteEnServidor(e)) {
        out.push({
          rowKey: stableEquipoRowKey(fila),
          nombre,
          fechaIso,
          detailLines: buildEquipoFilaDetailLines(fila),
        });
      }
    }
  }

  return out.sort((a, b) => {
    const n = a.nombre.localeCompare(b.nombre, "es");
    if (n !== 0) return n;
    return a.fechaIso.localeCompare(b.fechaIso);
  });
}
