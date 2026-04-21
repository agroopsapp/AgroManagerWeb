/** Utilidades puras: rejilla mensual y persistencia del calendario laboral (festivos / vacaciones). */

import type { CalendarioLaboralDayMark, CalendarioLaboralMarkKind } from "@/features/time-tracking/types";

export const CALENDARIO_LABORAL_STORAGE_VERSION = 2;

export type CalendarioLaboralPersisted = {
  v: typeof CALENDARIO_LABORAL_STORAGE_VERSION;
  /** Festivos / no laborables de empresa: YYYY-MM-DD → marca */
  holidaysByDate: Record<string, CalendarioLaboralDayMark>;
  /** Vacaciones por usuario: userId → (YYYY-MM-DD → marca) */
  vacationsByUserId: Record<string, Record<string, CalendarioLaboralDayMark>>;
};

export function calendarioLaboralStorageKey(companyId: string | null | undefined): string {
  const id = companyId?.trim() || "default";
  return `agro_calendario_laboral_v${CALENDARIO_LABORAL_STORAGE_VERSION}:${id}`;
}

function normalizeMarksMap(rawMap: unknown): Record<string, CalendarioLaboralDayMark> {
  if (!rawMap || typeof rawMap !== "object") return {};
  const out: Record<string, CalendarioLaboralDayMark> = {};
  for (const [k, v] of Object.entries(rawMap as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    const kind = (v as { kind?: string })?.kind;
    if (kind !== "festivo" && kind !== "vacaciones") continue;
    const note = (v as { note?: string }).note;
    out[k] = {
      kind,
      note: typeof note === "string" && note.trim() ? note.trim().slice(0, 120) : undefined,
    };
  }
  return out;
}

export function parseCalendarioLaboralJson(
  raw: string | null | undefined,
): {
  holidaysByDate: Record<string, CalendarioLaboralDayMark>;
  vacationsByUserId: Record<string, Record<string, CalendarioLaboralDayMark>>;
} {
  if (raw == null || raw === "") return { holidaysByDate: {}, vacationsByUserId: {} };
  try {
    const o = JSON.parse(raw) as CalendarioLaboralPersisted | Record<string, unknown>;
    if (o && typeof o === "object") {
      // Formato nuevo (v2)
      if ("holidaysByDate" in o && "vacationsByUserId" in o) {
        const holidaysByDate = normalizeMarksMap((o as CalendarioLaboralPersisted).holidaysByDate);
        const vacRaw = (o as CalendarioLaboralPersisted).vacationsByUserId;
        const vacationsByUserId: Record<string, Record<string, CalendarioLaboralDayMark>> = {};
        if (vacRaw && typeof vacRaw === "object") {
          for (const [userId, map] of Object.entries(vacRaw)) {
            const id = String(userId ?? "").trim();
            if (!id) continue;
            vacationsByUserId[id] = normalizeMarksMap(map);
          }
        }
        return { holidaysByDate, vacationsByUserId };
      }

      // Compat: formato antiguo (v1) { byDate: { ... } } → tratarlo como festivos de empresa
      if ("byDate" in o && (o as { byDate?: unknown }).byDate && typeof (o as { byDate?: unknown }).byDate === "object") {
        const holidaysByDate = normalizeMarksMap((o as { byDate?: unknown }).byDate);
        return { holidaysByDate, vacationsByUserId: {} };
      }
    }
  } catch {
    /* ignore */
  }
  return { holidaysByDate: {}, vacationsByUserId: {} };
}

export function serializeCalendarioLaboral(payload: {
  holidaysByDate: Record<string, CalendarioLaboralDayMark>;
  vacationsByUserId: Record<string, Record<string, CalendarioLaboralDayMark>>;
}): string {
  const out: CalendarioLaboralPersisted = {
    v: CALENDARIO_LABORAL_STORAGE_VERSION,
    holidaysByDate: payload.holidaysByDate,
    vacationsByUserId: payload.vacationsByUserId,
  };
  return JSON.stringify(out);
}

/** Primer y último día del mes (YYYY-MM-DD, calendario local). */
export function monthRangeISO(year: number, month1to12: number): { start: string; end: string } {
  const m = String(month1to12).padStart(2, "0");
  const start = `${year}-${m}-01`;
  const last = new Date(year, month1to12, 0).getDate();
  const end = `${year}-${m}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

/** Celdas del mes: `null` = hueco antes del día 1 (semana empieza en lunes). */
export function buildMonthGridCells(year: number, month1to12: number): Array<{ dateISO: string | null }> {
  const first = new Date(year, month1to12 - 1, 1, 12, 0, 0, 0);
  const jsDow = first.getDay();
  const pad = (jsDow + 6) % 7;
  const lastDay = new Date(year, month1to12, 0).getDate();
  const cells: Array<{ dateISO: string | null }> = [];
  for (let i = 0; i < pad; i++) cells.push({ dateISO: null });
  const ym = `${year}-${String(month1to12).padStart(2, "0")}`;
  for (let d = 1; d <= lastDay; d++) {
    cells.push({ dateISO: `${ym}-${String(d).padStart(2, "0")}` });
  }
  return cells;
}

export function labelCalendarioMarkKind(kind: CalendarioLaboralMarkKind): string {
  return kind === "festivo" ? "Festivo" : "Vacaciones";
}

/** Cuenta días marcados como vacaciones en el mapa local (una entrada = un día). */
export function countVacationDaysInMarks(marks: Record<string, CalendarioLaboralDayMark>): number {
  return Object.values(marks).filter((m) => m.kind === "vacaciones").length;
}

/** Itera fechas ISO YYYY-MM-DD inclusivas (calendario local, mediodía para evitar DST). */
export function listIsoDaysInclusive(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return [];
  if (from > to) return [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return [];
  const start = new Date(fy, fm - 1, fd, 12, 0, 0, 0);
  const end = new Date(ty, tm - 1, td, 12, 0, 0, 0);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const out: string[] = [];
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
    if (out.length > 3700) break; // hard stop
  }
  return out;
}
