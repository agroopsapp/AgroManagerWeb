import type { TimeEntryApiStatus } from "@/features/time-tracking/types";

const ALLOWED = new Set<string>([
  "Open",
  "Closed",
  "Vacation",
  "SickLeave",
  "NonWorkingDay",
]);

/**
 * Interpreta el campo `status` del API. Cualquier cadena fuera de la lista blanca → `"unknown"`.
 */
export function parseTimeEntryApiStatus(
  raw: unknown,
): TimeEntryApiStatus | "unknown" | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (ALLOWED.has(s)) return s as TimeEntryApiStatus;
  return "unknown";
}

/** Texto para exportación CSV/PDF (valores API exactos; desconocido legible). */
export function formatTimeEntryStatusForExport(
  status: TimeEntryApiStatus | "unknown" | null | undefined,
): string {
  if (status === null || status === undefined) return "—";
  if (status === "unknown") return "Desconocido";
  return status;
}

export function timeEntryApiStatusBadgeClass(
  status: TimeEntryApiStatus | "unknown",
): string {
  switch (status) {
    case "Open":
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-100";
    case "Closed":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/35 dark:text-emerald-100";
    case "Vacation":
      return "bg-sky-100 text-sky-900 dark:bg-sky-900/35 dark:text-sky-100";
    case "SickLeave":
      return "bg-violet-100 text-violet-900 dark:bg-violet-900/35 dark:text-violet-100";
    case "NonWorkingDay":
      return "bg-stone-200/90 text-stone-900 dark:bg-stone-700/50 dark:text-stone-100";
    case "unknown":
    default:
      return "bg-zinc-200/90 text-zinc-700 dark:bg-zinc-600/40 dark:text-zinc-200";
  }
}
