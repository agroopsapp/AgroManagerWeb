import {
  formatDateES,
  formatMinutesShort,
  formatTimeLocal,
  localCalendarISO,
} from "@/shared/utils/time";
import type { EquipoTablaFila } from "@/features/time-tracking/types";
import {
  effectiveWorkMinutesEntry,
  equipoAbsenceEtiquetaKind,
  formatRazon,
  formatRazonTablaEquipo,
  isSinJornadaImputableRazon,
  timeEntryConParteEnServidor,
  workReportParteApiSummary,
} from "@/features/time-tracking/utils/formatters";

/** Lunes = 0 … domingo = 6 (semana que empieza en lunes). */
export function mondayIndexFromLocalDate(d: Date): number {
  const x = d.getDay();
  return x === 0 ? 6 : x - 1;
}

/**
 * Matriz de semanas (7 columnas) que cubre desde el lunes anterior al rango
 * hasta el domingo posterior. Celdas fuera de [startISO, endISO] son `null`.
 */
export function buildWeekGridForRange(startISO: string, endISO: string): (string | null)[][] {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  };

  const gridStart = parse(startISO);
  gridStart.setDate(gridStart.getDate() - mondayIndexFromLocalDate(gridStart));

  const gridEnd = parse(endISO);
  gridEnd.setDate(gridEnd.getDate() + (6 - mondayIndexFromLocalDate(gridEnd)));

  const weeks: (string | null)[][] = [];
  const cur = new Date(gridStart);
  let row: (string | null)[] = [];

  while (cur <= gridEnd) {
    const iso = localCalendarISO(cur);
    row.push(iso >= startISO && iso <= endISO ? iso : null);
    if (row.length === 7) {
      weeks.push(row);
      row = [];
    }
    cur.setDate(cur.getDate() + 1);
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null);
    weeks.push(row);
  }
  return weeks;
}

export type EquipoCalCellKind =
  | "no_laboral"
  | "sin_imputar"
  | "fichaje_con_parte"
  | "fichaje_sin_parte"
  | "vacaciones"
  | "baja"
  | "festivo_empresa"
  | "dia_no_laboral_reg";

/** Una fila por fecha en la rejilla densa (una persona). */
export function equipoCalendarioStatusByDate(filas: EquipoTablaFila[]): Map<string, EquipoCalCellKind> {
  const m = new Map<string, EquipoCalCellKind>();
  for (const f of filas) {
    const wd = f.kind === "registro" ? f.e.workDate : f.workDate;
    if (f.kind === "noLaboral") {
      m.set(wd, "no_laboral");
    } else if (f.kind === "sinImputar") {
      m.set(wd, "sin_imputar");
    } else {
      const e = f.e;
      const ausencia = equipoAbsenceEtiquetaKind(e);
      if (ausencia === "festivo_empresa") {
        m.set(wd, "festivo_empresa");
      } else if (ausencia === "vacaciones") {
        m.set(wd, "vacaciones");
      } else if (ausencia === "baja") {
        m.set(wd, "baja");
      } else if (ausencia === "no_laboral") {
        m.set(wd, "dia_no_laboral_reg");
      } else {
        m.set(
          wd,
          timeEntryConParteEnServidor(e) ? "fichaje_con_parte" : "fichaje_sin_parte",
        );
      }
    }
  }
  return m;
}

export function dayOfMonthFromISO(iso: string): number {
  const d = iso.slice(8, 10);
  return Number.parseInt(d, 10) || 0;
}

export type EquipoCalTooltipRow = { label: string; value: string };

/** Texto para el tooltip grande del calendario de persona (fecha + filas clave). */
export function buildEquipoCalTooltipModel(
  dateISO: string,
  fila: EquipoTablaFila | undefined,
  kind: EquipoCalCellKind | undefined
): { title: string; rows: EquipoCalTooltipRow[] } {
  const title = formatDateES(dateISO);
  const rows: EquipoCalTooltipRow[] = [];

  if (!fila) {
    const estado =
      kind === "sin_imputar"
        ? "Día laborable sin fichaje"
        : kind === "no_laboral"
          ? "No laboral (fin de semana o rejilla)"
          : kind
            ? "Sin detalle en la vista"
            : "Sin datos";
    rows.push({ label: "Estado", value: estado });
    return { title, rows };
  }

  if (fila.kind === "sinImputar") {
    rows.push({ label: "Estado", value: "Día laborable sin fichaje" });
    return { title, rows };
  }

  if (fila.kind === "noLaboral") {
    rows.push({ label: "Estado", value: "No laboral (rejilla / fin de semana)" });
    return { title, rows };
  }

  const e = fila.e;
  if (
    e.timeEntryStatus === "FestivoEmpresa" ||
    isSinJornadaImputableRazon(e.razon)
  ) {
    rows.push({ label: "Tipo", value: formatRazonTablaEquipo(e) });
    return { title, rows };
  }

  rows.push({ label: "Entrada", value: formatTimeLocal(e.checkInUtc) });
  rows.push({
    label: "Salida",
    value: e.checkOutUtc ? formatTimeLocal(e.checkOutUtc) : "— (jornada abierta)",
  });
  rows.push({
    label: "Duración neta",
    value: formatMinutesShort(effectiveWorkMinutesEntry(e)),
  });
  rows.push({ label: "Imputación", value: formatRazon(e.razon) });
  const parte = workReportParteApiSummary(e);
  rows.push({
    label: "Parte en servidor",
    value: parte.tieneParte ? `Sí${parte.detalle ? ` · ${parte.detalle}` : ""}` : "No",
  });
  const desdeParte = e.workReportLinesSummary?.trim();
  const loc = e.workAreaName?.trim();
  const ubicacion = desdeParte || loc;
  rows.push({
    label: "Dónde ha trabajado",
    value:
      ubicacion ||
      (parte.tieneParte && (e.workReportLineCount ?? 0) > 0
        ? "Parte con líneas: el resumen aún no está disponible."
        : "No consta ubicación en el API para este fichaje"),
  });
  if (e.edicionNotaAdmin?.trim()) {
    rows.push({ label: "Nota administración", value: e.edicionNotaAdmin.trim() });
  }
  return { title, rows };
}

/** Parsea YYYY-MM-DD en fecha local (mediodía) para evitar desfases UTC. */
export function parseLocalDateISO(iso: string): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

export function toLocalDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Rango legible tipo «1 – 3 may» (misma lógica que heatmaps de cumplimiento).
 */
export function formatWeekRangeLabel(weekStart: string, weekEnd: string): string {
  const start = parseLocalDateISO(weekStart);
  const end = parseLocalDateISO(weekEnd);
  if (!start || !end) return `${weekStart} – ${weekEnd}`;
  const fmtDayMonth = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
  const fmtDay = new Intl.DateTimeFormat("es-ES", { day: "numeric" });
  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${fmtDay.format(start)} – ${fmtDayMonth.format(end).replace(".", "")}`;
  }
  return `${fmtDayMonth.format(start).replace(".", "")} – ${fmtDayMonth.format(end).replace(".", "")}`;
}

/** Etiqueta de fila del calendario de persona: solo días con fecha en el periodo. */
export function formatWeekRangeLabelForPersonaRow(row: (string | null)[]): string {
  const dates = row.filter((x): x is string => Boolean(x)).sort();
  if (dates.length === 0) return "—";
  return formatWeekRangeLabel(dates[0], dates[dates.length - 1]);
}
