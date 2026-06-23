import type { CalendarioLaboralDayMark } from "@/features/time-tracking/types";
import type { UserVacationDto } from "@/services/user-vacations.service";

/** Convierte filas del API a marcas de calendario (`kind: vacaciones`). */
export function userVacationsToMarks(
  rows: UserVacationDto[],
): Record<string, CalendarioLaboralDayMark> {
  const out: Record<string, CalendarioLaboralDayMark> = {};
  for (const row of rows) {
    out[row.date] = { kind: "vacaciones" };
  }
  return out;
}

/** Agrupa vacaciones por `userId` → mapa fecha → marca. */
export function userVacationsByUserId(
  rows: UserVacationDto[],
): Record<string, Record<string, CalendarioLaboralDayMark>> {
  const byUser: Record<string, UserVacationDto[]> = {};
  for (const row of rows) {
    if (!byUser[row.userId]) byUser[row.userId] = [];
    byUser[row.userId].push(row);
  }
  const out: Record<string, Record<string, CalendarioLaboralDayMark>> = {};
  for (const [uid, list] of Object.entries(byUser)) {
    out[uid] = userVacationsToMarks(list);
  }
  return out;
}

/** Índice `userId → date → timeEntryId` para borrados. */
export function userVacationIdIndex(
  rows: UserVacationDto[],
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    if (!out[row.userId]) out[row.userId] = {};
    out[row.userId][row.date] = row.id;
  }
  return out;
}

/** Detecta error 400 por solapamiento con festivo de empresa. */
export function isCompanyHolidayOverlapError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("festivo") && (m.includes("coincid") || m.includes("solap"));
}
