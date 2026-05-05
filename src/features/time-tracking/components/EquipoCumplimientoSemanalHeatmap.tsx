"use client";

/**
 * Heatmap de cumplimiento horas teóricas (semana ISO × días).
 * Estilo visual alineado con `EquipoPersonaCalendario`: cabeceras L M X J V S D,
 * celdas cuadradas con borde + número del día, leyenda en grid con iconos.
 */
import { Fragment, memo, useMemo } from "react";
import type {
  TimeEntryRowsHeatmapDayDto,
  TimeEntryRowsHeatmapDto,
  TimeEntryRowsHeatmapWeekDto,
} from "@/services";
import { dayOfMonthFromISO } from "@/features/time-tracking/utils/equipoCalendar";

const WEEKDAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"] as const;

/* Estilo de leyenda en pills: idéntico al del calendario y al heatmap de partes. */
const LEGEND_PILL =
  "inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200";
const LEGEND_DOT = "h-1.5 w-1.5 shrink-0 rounded-full";

const CAL_CELL_BASE =
  "flex aspect-square w-full min-h-0 flex-col items-center justify-center rounded-xl border p-0.5 text-center tabular-nums shadow-sm outline-none transition hover:z-[1] hover:ring-2 hover:ring-agro-500/25 focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-agro-500/40 dark:hover:ring-agro-400/20 sm:p-1";

function emptyPadCellClass(): string {
  return "aspect-square w-full min-h-0 rounded-xl bg-slate-100/70 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800/40 dark:ring-slate-700/60";
}

/** Misma lógica cromática que el calendario (teal / ámbar / rosa / gris). */
function hoursHeatmapCellClass(day: TimeEntryRowsHeatmapDayDto | undefined): string {
  if (!day) return emptyPadCellClass();
  const pct = day.compliancePct;
  if (pct != null) {
    if (pct >= 90) {
      return `${CAL_CELL_BASE} border-teal-400/80 bg-teal-50 text-base font-bold text-teal-950 dark:border-teal-600 dark:bg-teal-950/50 dark:text-teal-50 sm:text-lg`;
    }
    if (pct >= 70) {
      return `${CAL_CELL_BASE} border-amber-400/80 bg-amber-50 text-base font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-50 sm:text-lg`;
    }
    return `${CAL_CELL_BASE} border-rose-300/80 bg-rose-50 text-base font-bold text-rose-900 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100 sm:text-lg`;
  }
  if (!day.isWorkingDay) {
    return `${CAL_CELL_BASE} border-slate-200/90 bg-slate-100 text-base font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200 sm:text-lg`;
  }
  return `${CAL_CELL_BASE} border-slate-200 bg-slate-50 text-base font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300 sm:text-lg`;
}

function formatWeekRangeLabel(weekStart: string, weekEnd: string): string {
  const start = parseLocalISO(weekStart);
  const end = parseLocalISO(weekEnd);
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

function parseLocalISO(iso: string): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

function deriveWeeksFromDays(
  days: TimeEntryRowsHeatmapDayDto[],
): TimeEntryRowsHeatmapWeekDto[] {
  const map = new Map<string, TimeEntryRowsHeatmapWeekDto>();
  for (const d of days) {
    const key = `${d.isoWeekYear}-${d.isoWeek}`;
    if (!map.has(key)) {
      const date = parseLocalISO(d.date);
      let weekStart = d.date;
      let weekEnd = d.date;
      if (date) {
        const start = new Date(date);
        start.setDate(date.getDate() - (d.weekday - 1));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        weekStart = toLocalISO(start);
        weekEnd = toLocalISO(end);
      }
      map.set(key, {
        isoWeekYear: d.isoWeekYear,
        isoWeek: d.isoWeek,
        weekStart,
        weekEnd,
        workedHours: 0,
        theoreticalHours: 0,
        compliancePct: null,
      });
    }
    const w = map.get(key)!;
    w.workedHours += d.workedHours;
    w.theoreticalHours += d.theoreticalHours;
  }
  const out = Array.from(map.values());
  for (const w of out) {
    w.compliancePct =
      w.theoreticalHours > 0
        ? Math.round((w.workedHours / w.theoreticalHours) * 100)
        : null;
  }
  return out.sort((a, b) => {
    if (a.isoWeekYear !== b.isoWeekYear) return a.isoWeekYear - b.isoWeekYear;
    return a.isoWeek - b.isoWeek;
  });
}

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const EquipoCumplimientoSemanalHeatmap = memo(
  function EquipoCumplimientoSemanalHeatmap({
    data,
    loading,
    error,
  }: {
    data: TimeEntryRowsHeatmapDto | null;
    loading: boolean;
    error: string | null;
  }) {
    const weeks = useMemo<TimeEntryRowsHeatmapWeekDto[]>(() => {
      if (!data) return [];
      if (data.weeks && data.weeks.length > 0) {
        return [...data.weeks].sort((a, b) => {
          if (a.isoWeekYear !== b.isoWeekYear) return a.isoWeekYear - b.isoWeekYear;
          return a.isoWeek - b.isoWeek;
        });
      }
      return deriveWeeksFromDays(data.days);
    }, [data]);

    const dayIndex = useMemo(() => {
      const map = new Map<string, TimeEntryRowsHeatmapDayDto>();
      if (!data) return map;
      for (const d of data.days) {
        map.set(`${d.isoWeekYear}-${d.isoWeek}-${d.weekday}`, d);
      }
      return map;
    }, [data]);

    if (error) {
      return (
        <div
          role="status"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/60 dark:bg-rose-950/40 dark:text-rose-200"
        >
          {error}
        </div>
      );
    }

    if (loading && !data) {
      return (
        <div
          aria-busy
          className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400"
        >
          Cargando cumplimiento semanal…
        </div>
      );
    }

    if (!data || weeks.length === 0) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400">
          No hay datos de cumplimiento para el rango seleccionado.
        </div>
      );
    }

    const gridTemplate = "max-content repeat(7, minmax(0, 1fr))";

    return (
      <div className="min-w-0">
        <div className="mx-auto w-full max-w-md sm:max-w-lg md:max-w-xl">
          <div
            className="grid items-stretch gap-x-1.5 gap-y-1.5 sm:gap-2"
            style={{ gridTemplateColumns: gridTemplate }}
            role="grid"
            aria-label="Heatmap de cumplimiento por semana y día"
          >
            <div className="pb-2 sm:pb-2.5" aria-hidden />
            {WEEKDAY_SHORT.map((d) => (
              <div
                key={d}
                className="pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:pb-2.5"
              >
                {d}
              </div>
            ))}

            {weeks.map((w) => (
              <Fragment key={`${w.isoWeekYear}-${w.isoWeek}`}>
                <div className="flex items-center pr-2 text-[11px] font-normal tabular-nums text-slate-500 dark:text-slate-400">
                  {formatWeekRangeLabel(w.weekStart, w.weekEnd)}
                </div>
                {WEEKDAY_SHORT.map((_, i) => {
                  const weekday = i + 1;
                  const day = dayIndex.get(`${w.isoWeekYear}-${w.isoWeek}-${weekday}`);
                  const cls = hoursHeatmapCellClass(day);
                  const titleParts: string[] = [];
                  if (day?.date) titleParts.push(day.date);
                  if (day) {
                    if (day.compliancePct != null) {
                      titleParts.push(`Cumplimiento ${day.compliancePct}%`);
                      titleParts.push(
                        `${day.workedHours.toFixed(1)} h / ${day.theoreticalHours.toFixed(1)} h`,
                      );
                      if (day.peopleExpected > 0) {
                        titleParts.push(`${day.peopleWorked}/${day.peopleExpected} personas`);
                      }
                    } else if (!day.isWorkingDay) {
                      titleParts.push("No laboral");
                    } else {
                      titleParts.push("Sin datos");
                    }
                  } else {
                    titleParts.push("Fuera de rango");
                  }
                  return (
                    <div
                      key={`${w.isoWeekYear}-${w.isoWeek}-${weekday}`}
                      className={cls}
                      title={titleParts.join(" · ")}
                      aria-label={titleParts.join(" · ")}
                    >
                      {day ? (
                        <span className="tabular-nums">{dayOfMonthFromISO(day.date)}</span>
                      ) : null}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>

          <ul
            className="mx-auto mt-4 flex max-w-xl flex-wrap gap-2"
            aria-label="Leyenda de cumplimiento"
          >
            <li className={LEGEND_PILL}>
              <span className={`${LEGEND_DOT} bg-teal-500 dark:bg-teal-400`} aria-hidden />
              ≥ 90%
            </li>
            <li className={LEGEND_PILL}>
              <span className={`${LEGEND_DOT} bg-amber-400 dark:bg-amber-300`} aria-hidden />
              70 – 89%
            </li>
            <li className={LEGEND_PILL}>
              <span className={`${LEGEND_DOT} bg-rose-400 dark:bg-rose-300`} aria-hidden />
              &lt; 70%
            </li>
            <li className={LEGEND_PILL}>
              <span className={`${LEGEND_DOT} bg-slate-400 dark:bg-slate-500`} aria-hidden />
              Sin datos
            </li>
          </ul>
        </div>
      </div>
    );
  },
);
