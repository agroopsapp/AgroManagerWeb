// Formateadores y helpers de dominio del feature time-tracking.

import type { EquipoTablaFila, TimeEntryMock, TimeEntryRazon } from "@/features/time-tracking/types";
import { entryStablePersonKey } from "@/features/time-tracking/utils/equipoGridMerge";
import { formatTimeEntryStatusForExport } from "@/features/time-tracking/utils/timeEntryApiStatus";
import { MOCK_APP_USER_EMAIL_BY_WORKER, workerNameById } from "@/mocks/time-tracking.mock";
import {
  diffDurationMinutes,
  formatDateEsWeekdayDdMmYyyy,
  formatFechaModificacionUtc,
  formatMinutesShort,
  formatTiempoAnterior,
  formatTimeLocal,
  localTodayISO,
  workDateIsWeekend,
} from "@/shared/utils/time";

// ---------------------------------------------------------------------------
// Etiquetas de razón de imputación
// ---------------------------------------------------------------------------

export const RAZON_LABELS: Record<TimeEntryRazon, string> = {
  imputacion_normal: "Imputación normal",
  imputacion_manual_error: "Imputación manual (RRHH)",
  ausencia_vacaciones: "Vacaciones",
  ausencia_baja: "Baja / ausencia",
  dia_no_laboral: "Día no laboral (RRHH)",
};

export const RAZON_NO_LABORAL = "Fin de semana (no laboral)";
export const RAZON_SIN_IMPUTAR = "Sin imputar (día laboral)";
export const RAZON_IMPUTACION_AUTOMATICA = "Imputación automática";
export const MODIFICADO_POR_SISTEMA = "Sistema";

export function isAusenciaRazon(r: TimeEntryRazon | undefined): boolean {
  return r === "ausencia_vacaciones" || r === "ausencia_baja";
}

/** Vacaciones, baja, o día marcado como no laboral: sin horas imputables como jornada. */
export function isSinJornadaImputableRazon(r: TimeEntryRazon | undefined): boolean {
  return isAusenciaRazon(r) || r === "dia_no_laboral";
}

/**
 * `status` del API indica ausencia / día no laboral (no jornada cerrada con horas reales).
 * Cubre casos como `imputationKind: "manual"` con `status: "Vacation"` en GET /TimeEntries/rows.
 */
export function isAbsenceCalendarApiStatus(
  e: Pick<TimeEntryMock, "timeEntryStatus">,
): boolean {
  const s = e.timeEntryStatus;
  return s === "SickLeave" || s === "Vacation" || s === "NonWorkingDay";
}

/** Entrada/salida/descanso/duración: ocultar por `razon` o por `status` de ausencia en API. */
export function equipoRegistroOcultaHorasEnTabla(e: TimeEntryMock): boolean {
  return isSinJornadaImputableRazon(e.razon) || isAbsenceCalendarApiStatus(e);
}

/**
 * Columna «Razón»: prioriza `status` del API sobre `imputationKind` cuando marcan ausencia.
 */
export function formatRazonTablaEquipo(e: TimeEntryMock): string {
  switch (e.timeEntryStatus) {
    case "SickLeave":
      return RAZON_LABELS.ausencia_baja;
    case "Vacation":
      return RAZON_LABELS.ausencia_vacaciones;
    case "NonWorkingDay":
      return RAZON_LABELS.dia_no_laboral;
    default:
      return formatRazon(e.razon);
  }
}

export function formatRazon(razon: TimeEntryRazon | undefined): string {
  if (razon && razon in RAZON_LABELS) return RAZON_LABELS[razon as TimeEntryRazon];
  return "—";
}

/** Parte de trabajo en servidor (contrato /api/TimeEntries/rows). */
export function workReportParteApiSummary(entry: TimeEntryMock): {
  tieneParte: boolean;
  /** Texto secundario (estado, líneas). */
  detalle: string;
} {
  const id = entry.workReportId?.trim();
  const status = entry.workReportStatus?.trim();
  const n =
    typeof entry.workReportLineCount === "number" && Number.isFinite(entry.workReportLineCount)
      ? entry.workReportLineCount
      : null;
  const tieneParte =
    Boolean(id) || (n !== null && n > 0) || Boolean(status && status.length > 0);
  const parts: string[] = [];
  if (status) parts.push(status);
  if (n !== null && n > 0) parts.push(`${n} línea${n === 1 ? "" : "s"}`);
  if (id && parts.length === 0) parts.push("Registrado");
  return { tieneParte, detalle: parts.join(" · ") };
}

/** Alineado con la columna «Parte en servidor» (sin id/líneas/estado en API). */
export function timeEntrySinParteEnServidor(entry: TimeEntryMock): boolean {
  return !workReportParteApiSummary(entry).tieneParte;
}

/** Fichaje con parte en servidor según el mismo criterio que la columna «Sí». */
export function timeEntryConParteEnServidor(entry: TimeEntryMock): boolean {
  return workReportParteApiSummary(entry).tieneParte;
}

// ---------------------------------------------------------------------------
// Lógica de estado de fila en el histórico personal
// ---------------------------------------------------------------------------

export type HistoricoPersonalFila =
  | { kind: "entry"; entry: TimeEntryMock }
  | { kind: "sinRegistro"; workDate: string };

/**
 * Devuelve true si la fila debe marcarse en rojo:
 * día laborable pasado sin registro, o con registro sin cerrar.
 */
export function historicoFilaSinImputarPasado(fila: HistoricoPersonalFila): boolean {
  const today = localTodayISO();
  if (fila.kind === "sinRegistro") {
    return !workDateIsWeekend(fila.workDate);
  }
  const e = fila.entry;
  if (e.workDate >= today) return false;
  if (isSinJornadaImputableRazon(e.razon)) return false;
  return e.checkOutUtc == null || e.cierreAutomaticoMedianoche === true;
}

// ---------------------------------------------------------------------------
// Cálculo de minutos efectivos trabajados
// ---------------------------------------------------------------------------

/** Minutos trabajados efectivos: prioriza `workedMinutes` del API si existe; si no, bruto − descanso. */
export function effectiveWorkMinutesEntry(e: TimeEntryMock): number {
  if (isSinJornadaImputableRazon(e.razon) || isAbsenceCalendarApiStatus(e)) return 0;
  const apiNet =
    typeof e.workedMinutes === "number" &&
    Number.isFinite(e.workedMinutes) &&
    e.workedMinutes >= 0
      ? Math.round(e.workedMinutes)
      : null;
  const gross = diffDurationMinutes(e.checkInUtc, e.checkOutUtc);
  if (gross !== null) {
    const computed = Math.max(0, gross - (e.breakMinutes ?? 0));
    if (apiNet !== null) return Math.max(0, apiNet);
    return computed;
  }
  return apiNet ?? 0;
}

/**
 * Minutos por encima del tope diario de jornada (`hoursPerWorkingDay` del summary, p. ej. 8 h).
 * Ausencias / sin horas imputables: 0 (la UI muestra «—» con `equipoRegistroOcultaHorasEnTabla`).
 */
export function effectiveExtraMinutesEntry(
  e: TimeEntryMock,
  capWorkMinutesPerDay: number,
): number {
  if (equipoRegistroOcultaHorasEnTabla(e)) return 0;
  const cap = Math.max(0, Math.round(capWorkMinutesPerDay));
  return Math.max(0, effectiveWorkMinutesEntry(e) - cap);
}

// ---------------------------------------------------------------------------
// Autor de modificación
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Exportación tabla equipo (CSV / PDF)
// ---------------------------------------------------------------------------

function csvEscapeSemicolon(field: string): string {
  const s = String(field ?? "");
  if (/[;\r\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvPersonaCell(
  f: EquipoTablaFila,
  nameByPersonKey?: Map<string, string>
): string {
  if (f.kind === "registro") {
    const pk = entryStablePersonKey(f.e);
    if (pk) {
      const n = nameByPersonKey?.get(pk);
      if (n?.trim()) return n.trim();
    }
    return workerNameById(f.e.workerId);
  }
  if (f.displayName?.trim()) return f.displayName.trim();
  return workerNameById(f.workerId);
}

function parteServidorExportCell(e: TimeEntryMock): string {
  const api = workReportParteApiSummary(e);
  if (!api.tieneParte) return "No";
  return api.detalle ? `Sí · ${api.detalle}` : "Sí";
}

const DEFAULT_CAP_WORK_MINUTES_PER_DAY = 8 * 60;

/** Cabeceras y filas alineadas con la tabla en pantalla (incl. parte en servidor). */
export function buildEquipoTableExportRows(
  filas: EquipoTablaFila[],
  nameByPersonKey?: Map<string, string>,
  capWorkMinutesPerDay: number = DEFAULT_CAP_WORK_MINUTES_PER_DAY,
): { headers: string[]; rows: string[][] } {
  const cap = Number.isFinite(capWorkMinutesPerDay) ? capWorkMinutesPerDay : DEFAULT_CAP_WORK_MINUTES_PER_DAY;
  const headers = [
    "Persona",
    "Fecha",
    "Entrada",
    "Salida",
    "Descanso",
    "Estado (API)",
    "Razón",
    "Modificado por",
    "Fecha modificación",
    "Duración",
    "Extra",
    "Parte en servidor",
  ];
  const rows = filas.map((f) => {
    if (f.kind === "registro") {
      const e = f.e;
      const ocultaHoras = equipoRegistroOcultaHorasEnTabla(e);
      const ocultaMetaPorStatusAusencia = isAbsenceCalendarApiStatus(e);
      const extraM = effectiveExtraMinutesEntry(e, cap);
      return [
        csvPersonaCell(f, nameByPersonKey),
        formatDateEsWeekdayDdMmYyyy(e.workDate),
        ocultaHoras ? "—" : formatTimeLocal(e.checkInUtc),
        ocultaHoras ? "—" : formatTimeLocal(e.checkOutUtc),
        ocultaHoras ? "—" : formatMinutesShort(e.breakMinutes ?? 0),
        ocultaMetaPorStatusAusencia ? "—" : formatTimeEntryStatusForExport(e.timeEntryStatus),
        formatRazonTablaEquipo(e),
        ocultaMetaPorStatusAusencia ? "—" : formatLastModifiedByUser(e),
        ocultaMetaPorStatusAusencia ? "—" : formatFechaModificacionUtc(e.updatedAtUtc),
        ocultaHoras ? "—" : formatMinutesShort(effectiveWorkMinutesEntry(e)),
        ocultaHoras || extraM <= 0 ? "—" : formatMinutesShort(extraM),
        ocultaMetaPorStatusAusencia ? "—" : parteServidorExportCell(e),
      ];
    }
    if (f.kind === "noLaboral") {
      return [
        csvPersonaCell(f, nameByPersonKey),
        formatDateEsWeekdayDdMmYyyy(f.workDate),
        "—",
        "—",
        "—",
        "—",
        RAZON_NO_LABORAL,
        "—",
        "—",
        "—",
        "—",
        "—",
      ];
    }
    return [
      csvPersonaCell(f, nameByPersonKey),
      formatDateEsWeekdayDdMmYyyy(f.workDate),
      "—",
      "—",
      "—",
      "—",
      RAZON_SIN_IMPUTAR,
      "—",
      "—",
      "—",
      "—",
      "—",
    ];
  });
  return { headers, rows };
}

/** CSV de la vista calendario de horas del equipo (incl. no laboral y sin imputar). */
export function buildEquipoTableCsvFilas(
  filas: EquipoTablaFila[],
  nameByPersonKey?: Map<string, string>,
  capWorkMinutesPerDay?: number,
): string {
  const sep = ";";
  const { headers, rows } = buildEquipoTableExportRows(filas, nameByPersonKey, capWorkMinutesPerDay);
  const headerLine = headers.map(csvEscapeSemicolon).join(sep);
  const dataLines = rows.map((cells) => cells.map(csvEscapeSemicolon).join(sep));
  return `\uFEFF${headerLine}\r\n${dataLines.join("\r\n")}`;
}

// ---------------------------------------------------------------------------
// Autor de modificación
// ---------------------------------------------------------------------------

/**
 * Devuelve una cadena legible con el nombre y/o email de quien modificó el registro.
 * Prioridad: nombre+email > solo email > solo nombre > sessionEmail > email del mock.
 */
export function formatLastModifiedByUser(
  e: TimeEntryMock,
  opts?: { sessionEmail?: string | null }
): string {
  const name = e.lastModifiedByName?.trim();
  const mail = e.lastModifiedByEmail?.trim();
  if (name && mail) return `${name} · ${mail}`;
  if (mail) return mail;
  if (name) return name;
  const ses = opts?.sessionEmail?.trim();
  if (ses) return ses;
  return MOCK_APP_USER_EMAIL_BY_WORKER[e.workerId] ?? "—";
}
