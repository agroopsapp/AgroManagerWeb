/** Utilidades puras: rejilla mensual y persistencia del calendario laboral (festivos / vacaciones). */

import type { CalendarioLaboralDayMark, CalendarioLaboralMarkKind } from "@/features/time-tracking/types";

export const CALENDARIO_LABORAL_STORAGE_VERSION = 1;

export type CalendarioLaboralPersisted = {
  v: typeof CALENDARIO_LABORAL_STORAGE_VERSION;
  /** YYYY-MM-DD → marca */
  byDate: Record<string, CalendarioLaboralDayMark>;
};

export function calendarioLaboralStorageKey(companyId: string | null | undefined): string {
  const id = companyId?.trim() || "default";
  return `agro_calendario_laboral_v${CALENDARIO_LABORAL_STORAGE_VERSION}:${id}`;
}

export function parseCalendarioLaboralJson(raw: string | null | undefined): Record<string, CalendarioLaboralDayMark> {
  if (raw == null || raw === "") return {};
  try {
    const o = JSON.parse(raw) as CalendarioLaboralPersisted | Record<string, unknown>;
    if (o && typeof o === "object" && "byDate" in o && o.byDate && typeof o.byDate === "object") {
      const out: Record<string, CalendarioLaboralDayMark> = {};
      for (const [k, v] of Object.entries(o.byDate as Record<string, unknown>)) {
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
  } catch {
    /* ignore */
  }
  return {};
}

export function serializeCalendarioLaboral(byDate: Record<string, CalendarioLaboralDayMark>): string {
  const payload: CalendarioLaboralPersisted = {
    v: CALENDARIO_LABORAL_STORAGE_VERSION,
    byDate,
  };
  return JSON.stringify(payload);
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
