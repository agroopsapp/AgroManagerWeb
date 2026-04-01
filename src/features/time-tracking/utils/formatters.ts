// Formateadores y helpers de dominio del feature time-tracking.

import type { EquipoTablaFila, TimeEntryMock, TimeEntryRazon } from "@/features/time-tracking/types";
import { MOCK_APP_USER_EMAIL_BY_WORKER, workerNameById } from "@/mocks/time-tracking.mock";
import {
  diffDurationMinutes,
  formatDateES,
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
};

export const RAZON_NO_LABORAL = "Fin de semana (no laboral)";
export const RAZON_SIN_IMPUTAR = "Sin imputar (día laboral)";
export const RAZON_IMPUTACION_AUTOMATICA = "Imputación automática";
export const MODIFICADO_POR_SISTEMA = "Sistema";

export function isAusenciaRazon(r: TimeEntryRazon | undefined): boolean {
  return r === "ausencia_vacaciones" || r === "ausencia_baja";
}

export function formatRazon(razon: TimeEntryRazon | undefined): string {
  if (razon && razon in RAZON_LABELS) return RAZON_LABELS[razon as TimeEntryRazon];
  return "—";
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
  if (isAusenciaRazon(e.razon)) return false;
  return e.checkOutUtc == null || e.cierreAutomaticoMedianoche === true;
}

// ---------------------------------------------------------------------------
// Cálculo de minutos efectivos trabajados
// ---------------------------------------------------------------------------

/** Minutos trabajados efectivos (bruto − descanso) para un registro cerrado. */
export function effectiveWorkMinutesEntry(e: TimeEntryMock): number {
  if (isAusenciaRazon(e.razon)) return 0;
  const gross = diffDurationMinutes(e.checkInUtc, e.checkOutUtc);
  if (gross === null) return 0;
  return Math.max(0, gross - (e.breakMinutes ?? 0));
}

// ---------------------------------------------------------------------------
// Autor de modificación
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CSV del equipo
// ---------------------------------------------------------------------------

function csvEscapeSemicolon(field: string): string {
  const s = String(field ?? "");
  if (/[;\r\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CSV de la vista calendario de horas del equipo (incl. no laboral y sin imputar). */
export function buildEquipoTableCsvFilas(filas: EquipoTablaFila[]): string {
  const sep = ";";
  const headers = [
    "Persona",
    "Fecha",
    "Entrada",
    "Salida",
    "Entrada (antes)",
    "Salida (antes)",
    "Descanso",
    "Razón",
    "Modificado por",
    "Fecha modificación",
    "Duración",
  ];
  const headerLine = headers.map(csvEscapeSemicolon).join(sep);
  const dataLines = filas.map((f) => {
    const cells =
      f.kind === "registro"
        ? [
            workerNameById(f.e.workerId),
            formatDateES(f.e.workDate),
            isAusenciaRazon(f.e.razon) ? "—" : formatTimeLocal(f.e.checkInUtc),
            isAusenciaRazon(f.e.razon) ? "—" : formatTimeLocal(f.e.checkOutUtc),
            formatTiempoAnterior(f.e.previousCheckInUtc),
            formatTiempoAnterior(f.e.previousCheckOutUtc),
            isAusenciaRazon(f.e.razon) ? "—" : formatMinutesShort(f.e.breakMinutes ?? 0),
            formatRazon(f.e.razon),
            formatLastModifiedByUser(f.e),
            formatFechaModificacionUtc(f.e.updatedAtUtc),
            isAusenciaRazon(f.e.razon) ? "—" : formatMinutesShort(effectiveWorkMinutesEntry(f.e)),
          ]
        : f.kind === "noLaboral"
          ? [
              workerNameById(f.workerId),
              formatDateES(f.workDate),
              "—",
              "—",
              "—",
              "—",
              "—",
              RAZON_NO_LABORAL,
              "—",
              "—",
              "—",
            ]
          : [
              workerNameById(f.workerId),
              formatDateES(f.workDate),
              "—",
              "—",
              "—",
              "—",
              "—",
              RAZON_SIN_IMPUTAR,
              "—",
              "—",
              "—",
            ];
    return cells.map(csvEscapeSemicolon).join(sep);
  });
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
