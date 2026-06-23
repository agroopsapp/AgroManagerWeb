import type { TimeEntryMock } from "@/features/time-tracking/types";

/** GUID vacío que el API usa en filas sintéticas sin fichaje real. */
export function isEmptyGuid(value: string | null | undefined): boolean {
  const t = (value ?? "").trim();
  if (!t) return true;
  return /^0{8}-0{4}-0{4}-0{4}-0{12}$/i.test(t);
}

export type TimeEntryRowKind = "timeEntry" | "companyHoliday";

export function normalizeTimeEntryRowKind(raw: unknown): TimeEntryRowKind | null {
  const k = String(raw ?? "").trim();
  if (!k) return null;
  if (/^time[_]?entry$/i.test(k)) return "timeEntry";
  if (/^company[_]?holiday$/i.test(k)) return "companyHoliday";
  return null;
}

/** Festivo de empresa (sintético). */
export function isCompanyHolidayEntry(
  e: Pick<TimeEntryMock, "rowKind" | "timeEntryStatus">,
): boolean {
  return e.rowKind === "companyHoliday" || e.timeEntryStatus === "FestivoEmpresa";
}

/** Fichaje de vacaciones (timeEntry real con status Vacation). */
export function isVacationTimeEntry(
  e: Pick<TimeEntryMock, "timeEntryStatus" | "razon">,
): boolean {
  return e.timeEntryStatus === "Vacation" || e.razon === "ausencia_vacaciones";
}

/**
 * Id del fichaje en servidor (`TimeEntries.Id`) para PUT/DELETE.
 * No usar `id` numérico local del mock.
 */
export function resolveServerTimeEntryId(
  e: Pick<TimeEntryMock, "timeEntryId" | "rowKind" | "timeEntryStatus"> | null | undefined,
): string | null {
  if (!e || isCompanyHolidayEntry(e)) return null;
  const fromField = e.timeEntryId?.trim();
  if (fromField && !isEmptyGuid(fromField)) return fromField;
  return null;
}

/** Día con fila de registro en grid que debe persistirse con PUT, no POST. */
export function modalExistingRequiresUpdate(
  existing: TimeEntryMock | null | undefined,
): boolean {
  return existing != null && !isCompanyHolidayEntry(existing);
}

/**
 * Filas del calendario/grid que no se editan como jornada (solo festivo sintético).
 * Las vacaciones son fichajes reales y se gestionan vía `/api/UserVacations`.
 */
export function timeEntryFilaSinAccionesEdicion(e: TimeEntryMock): boolean {
  return isCompanyHolidayEntry(e);
}
