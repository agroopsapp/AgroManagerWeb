import type { EquipoTablaFila, TimeEntryMock } from "@/features/time-tracking/types";
import { pickPreferredDayEntry } from "@/features/time-tracking/utils/timeEntrySessionMatch";
import { workerNameById } from "@/mocks/time-tracking.mock";

/**
 * Grid denso de horas del equipo — contrato con el API
 * ----------------------------------------------------
 * - El cliente envía `from` / `to` (alineados con el rango de filtros).
 * - El back devuelve fichajes reales y filas sintéticas (festivo / vacación planificada).
 * - Eje de personas: **userId** (GUID de usuario). «Todas» en UI → no mandar `userId` al filtro de filas.
 * - Cruce: por cada (persona × día), si hay entrada → `registro`; si no → `sinImputar` / `noLaboral`.
 */

export type EquipoCalendarDay = { workDate: string; isWeekend: boolean };

/** Normaliza GUID de persona para cruce estable (mayúsculas/minúsculas). */
export function normalizePersonKey(value: string | null | undefined): string | null {
  const t = (value ?? "").trim();
  if (!t) return null;
  if (t.toLowerCase().startsWith("legacy:")) return t.toLowerCase();
  return t.toLowerCase();
}

/** Id estable numérico para partes/modal cuando solo hay GUID (localStorage / compat). */
export function stableNumericIdFromUserId(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (Math.imul(31, h) + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

/** Clave de persona para indexar fichajes: prioriza `userId` del servidor; si no, `legacy:{workerId}`. */
export function entryStablePersonKey(e: TimeEntryMock): string | null {
  const uid = normalizePersonKey(e.userId);
  if (uid) return uid;
  if (Number.isFinite(e.workerId) && e.workerId > 0) return `legacy:${e.workerId}`;
  return null;
}

export function indexEquipoEntriesByPersonAndDate(
  entries: TimeEntryMock[],
  rangeStart: string,
  rangeEnd: string
): Map<string, TimeEntryMock> {
  const grouped = new Map<string, TimeEntryMock[]>();
  for (const e of entries) {
    if (e.workDate < rangeStart || e.workDate > rangeEnd) continue;
    const pk = entryStablePersonKey(e);
    if (!pk) continue;
    const key = `${pk}-${e.workDate}`;
    const list = grouped.get(key);
    if (list) list.push(e);
    else grouped.set(key, [e]);
  }
  const map = new Map<string, TimeEntryMock>();
  for (const [key, list] of Array.from(grouped.entries())) {
    const preferred = pickPreferredDayEntry(list);
    if (preferred) map.set(key, preferred);
  }
  return map;
}

/** Personas deducidas solo de fichajes (p. ej. sin catálogo de usuarios aún), orden lexicográfico. */
export function uniquePersonKeysInRange(
  entries: TimeEntryMock[],
  rangeStart: string,
  rangeEnd: string
): string[] {
  const s = new Set<string>();
  for (const e of entries) {
    if (e.workDate < rangeStart || e.workDate > rangeEnd) continue;
    const pk = entryStablePersonKey(e);
    if (pk) s.add(pk);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

/** Id numérico estable para partes en localStorage (misma lógica que en filas sintéticas). */
export function workerIdFromPersonKey(personKey: string): number {
  if (personKey.startsWith("legacy:")) {
    const n = Number(personKey.slice(7));
    return Number.isFinite(n) && n > 0 ? n : stableNumericIdFromUserId(personKey);
  }
  return stableNumericIdFromUserId(personKey);
}

function displayNameForPersonKey(
  personKey: string,
  nameByPersonKey: Map<string, string>
): string {
  const fromMap = nameByPersonKey.get(personKey);
  if (fromMap?.trim()) return fromMap.trim();
  if (personKey.startsWith("legacy:")) {
    const n = Number(personKey.slice(7));
    if (Number.isFinite(n) && n > 0) return workerNameById(n);
  }
  return personKey;
}

/**
 * Cruce calendario × personas (`userId` GUID o `legacy:{id}`) vs mapa de fichajes.
 */
export function buildEquipoDenseGridRows(input: {
  personKeys: string[];
  days: EquipoCalendarDay[];
  entryByPersonDate: Map<string, TimeEntryMock>;
  nameByPersonKey: Map<string, string>;
}): EquipoTablaFila[] {
  const { personKeys, days, entryByPersonDate, nameByPersonKey } = input;
  const filas: EquipoTablaFila[] = [];
  for (const personKey of personKeys) {
    const workerId = workerIdFromPersonKey(personKey);
    const displayName = displayNameForPersonKey(personKey, nameByPersonKey);
    for (const { workDate, isWeekend } of days) {
      const key = `${personKey}-${workDate}`;
      const e = entryByPersonDate.get(key);
      if (isWeekend) {
        if (e) filas.push({ kind: "registro", e });
        else
          filas.push({
            kind: "noLaboral",
            userId: personKey,
            workerId,
            workDate,
            displayName,
          });
      } else {
        if (e) filas.push({ kind: "registro", e });
        else
          filas.push({
            kind: "sinImputar",
            userId: personKey,
            workerId,
            workDate,
            displayName,
          });
      }
    }
  }
  return filas;
}

/** Clave de persona de una fila de rejilla (registro o sintética). */
export function equipoFilaStablePersonKey(fila: EquipoTablaFila): string | null {
  if (fila.kind === "registro") return entryStablePersonKey(fila.e);
  return normalizePersonKey(fila.userId);
}

/** Filas de una sola persona (cruce estable por userId / legacy). */
export function equipoFilasForPersonKey(
  filas: EquipoTablaFila[],
  personKey: string,
): EquipoTablaFila[] {
  const pk = normalizePersonKey(personKey);
  if (!pk) return [];
  return filas.filter((f) => equipoFilaStablePersonKey(f) === pk);
}
