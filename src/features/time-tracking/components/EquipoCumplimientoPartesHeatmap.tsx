"use client";

/**
 * Heatmap de disciplina de partes (semana ISO × días).
 * Mismo aspecto visual que `EquipoPersonaCalendario` y el heatmap de horas.
 */
import { Fragment, memo, useMemo } from "react";
import type {
  TimeEntryRowsHeatmapPartsDayDto,
  TimeEntryRowsHeatmapPartsDto,
  TimeEntryRowsHeatmapPartsWeekDto,
} from "@/services";
import {
  formatDateLongEs,
  HeatmapInteractiveCell,
  HeatmapTooltipProvider,
  type HeatmapTooltipRow,
} from "@/features/time-tracking/components/HeatmapTooltipScope";
import {
  CALENDAR_CARD_CLASS,
  CALENDAR_WEEK_RANGE_LABEL,
  CALENDAR_WEEKDAY_HEADER,
  CAL_CELL_BASE,
  CAL_CELL_DAY_NUM,
  emptyCalendarPadClass,
  LEGEND_DOT,
  LEGEND_PILL,
} from "@/features/time-tracking/utils/equipoCalendarChrome";
import { dayOfMonthFromISO } from "@/features/time-tracking/utils/equipoCalendar";

const WEEKDAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"] as const;

function partsHeatmapCellClass(day: TimeEntryRowsHeatmapPartsDayDto | undefined): string {
  if (!day) return emptyCalendarPadClass();
  const pct = day.compliancePct;
  if (pct != null) {
    if (pct >= 90) {
      return `${CAL_CELL_BASE} ring-emerald-400/40 bg-emerald-50 text-emerald-950 dark:ring-emerald-600/45 dark:bg-emerald-950/55 dark:text-emerald-50`;
    }
    if (pct >= 70) {
      return `${CAL_CELL_BASE} ring-amber-400/40 bg-amber-50 text-amber-950 dark:ring-amber-600/45 dark:bg-amber-950/45 dark:text-amber-50`;
    }
    return `${CAL_CELL_BASE} ring-rose-400/35 bg-rose-50 text-rose-900 dark:ring-rose-600/45 dark:bg-rose-950/55 dark:text-rose-100`;
  }
  if (!day.isWorkingDay) {
    return `${CAL_CELL_BASE} ring-slate-300/60 bg-slate-100 text-slate-700 dark:ring-slate-600 dark:bg-slate-800/65 dark:text-slate-200`;
  }
  return `${CAL_CELL_BASE} ring-slate-300/50 bg-slate-50 text-slate-600 dark:ring-slate-600 dark:bg-slate-800/55 dark:text-slate-300`;
}

function parseLocalISO(iso: string): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function deriveWeeksFromDays(
  days: TimeEntryRowsHeatmapPartsDayDto[],
): TimeEntryRowsHeatmapPartsWeekDto[] {
  const map = new Map<string, TimeEntryRowsHeatmapPartsWeekDto>();
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
        closedEntries: 0,
        entriesWithPart: 0,
        compliancePct: null,
      });
    }
    const w = map.get(key)!;
    w.closedEntries += d.closedEntries;
    w.entriesWithPart += d.entriesWithPart;
  }
  const out = Array.from(map.values());
  for (const w of out) {
    w.compliancePct =
      w.closedEntries > 0
        ? Math.round((w.entriesWithPart / w.closedEntries) * 100)
        : null;
  }
  return out.sort((a, b) => {
    if (a.isoWeekYear !== b.isoWeekYear) return a.isoWeekYear - b.isoWeekYear;
    return a.isoWeek - b.isoWeek;
  });
}

function buildPartsHeatmapTooltip(day: TimeEntryRowsHeatmapPartsDayDto | undefined): {
  title: string;
  rows: HeatmapTooltipRow[];
  ariaLabel: string;
} {
  if (!day) {
    return {
      title: "Fuera del periodo",
      rows: [
        {
          label: "Detalle",
          value: "Esta celda no tiene día del periodo filtrado (hueco de semana ISO).",
        },
      ],
      ariaLabel: "Celda fuera del periodo seleccionado",
    };
  }

  const title = formatDateLongEs(day.date);
  const rows: HeatmapTooltipRow[] = [];

  if (day.compliancePct != null) {
    rows.push({
      label: "Disciplina de partes",
      value: `${day.compliancePct}% de fichajes cerrados que ya tienen parte en servidor.`,
    });
    rows.push({
      label: "Cierre administrativo",
      value: `${day.entriesWithPart} de ${day.closedEntries} fichajes cerrados llevan parte cargado.`,
    });
    if (day.entriesWithoutPart > 0) {
      rows.push({
        label: "Pendientes",
        value: `${day.entriesWithoutPart} fichajes cerrados aún sin parte asociado.`,
      });
    }
  } else if (day.closedEntries === 0) {
    rows.push({
      label: "Actividad",
      value: day.isWorkingDay
        ? "No hay fichajes en estado cerrado este día; no se puede medir el cumplimiento de partes."
        : "Día no laboral · sin fichajes cerrados que evaluar.",
    });
  } else if (!day.isWorkingDay) {
    rows.push({
      label: "Calendario",
      value: "Día no laboral en la configuración del periodo.",
    });
  } else {
    rows.push({
      label: "Datos",
      value: "Sin métrica de partes para este día con los datos actuales.",
    });
  }

  const ariaLabel =
    day.compliancePct != null
      ? `${title}. Partes al ${day.compliancePct} por ciento. Pulsa para ver detalle.`
      : `${title}. ${rows[0]?.value.slice(0, 80) ?? ""}`;

  return { title, rows, ariaLabel };
}

export const EquipoCumplimientoPartesHeatmap = memo(
  function EquipoCumplimientoPartesHeatmap({
    data,
    loading,
    error,
  }: {
    data: TimeEntryRowsHeatmapPartsDto | null;
    loading: boolean;
    error: string | null;
  }) {
    const weeks = useMemo<TimeEntryRowsHeatmapPartsWeekDto[]>(() => {
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
      const map = new Map<string, TimeEntryRowsHeatmapPartsDayDto>();
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
          Cargando disciplina de partes…
        </div>
      );
    }

    if (!data || weeks.length === 0) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400">
          No hay datos de partes para el rango seleccionado.
        </div>
      );
    }

    const gridTemplate = "max-content repeat(7, minmax(0, 1fr))";

    return (
      <div className="min-w-0">
        <HeatmapTooltipProvider>
          <div className="mx-auto w-full max-w-md sm:max-w-lg md:max-w-xl">
          <div className={CALENDAR_CARD_CLASS}>
          <div
            className="grid items-stretch gap-x-2 gap-y-2 sm:gap-x-2.5 sm:gap-y-2.5"
            style={{ gridTemplateColumns: gridTemplate }}
            role="grid"
            aria-label="Heatmap de disciplina de partes por semana y día"
          >
            <div className="min-h-[2.25rem] sm:min-h-[2.5rem]" aria-hidden />
            {WEEKDAY_SHORT.map((d) => (
              <div key={d} className={`${CALENDAR_WEEKDAY_HEADER} min-h-[2.25rem] sm:min-h-[2.5rem]`}>
                {d}
              </div>
            ))}

            {weeks.map((w) => (
              <Fragment key={`${w.isoWeekYear}-${w.isoWeek}`}>
                <div className={CALENDAR_WEEK_RANGE_LABEL}>{formatWeekRangeLabel(w.weekStart, w.weekEnd)}</div>
                {WEEKDAY_SHORT.map((_, i) => {
                  const weekday = i + 1;
                  const day = dayIndex.get(`${w.isoWeekYear}-${w.isoWeek}-${weekday}`);
                  const cls = partsHeatmapCellClass(day);
                  const tip = buildPartsHeatmapTooltip(day);
                  const cellKey = `parts-${w.isoWeekYear}-${w.isoWeek}-${weekday}`;
                  return (
                    <HeatmapInteractiveCell
                      key={cellKey}
                      cellKey={cellKey}
                      columnIndex={i}
                      className={cls}
                      tooltipTitle={tip.title}
                      tooltipRows={tip.rows}
                      ariaLabel={tip.ariaLabel}
                    >
                      {day ? (
                        <span className={CAL_CELL_DAY_NUM}>{dayOfMonthFromISO(day.date)}</span>
                      ) : null}
                    </HeatmapInteractiveCell>
                  );
                })}
              </Fragment>
            ))}
          </div>
          </div>

          <ul
            className="mx-auto mt-4 flex max-w-xl flex-wrap gap-2"
            aria-label="Leyenda de disciplina de partes"
          >
            <li className={LEGEND_PILL}>
              <span className={`${LEGEND_DOT} bg-emerald-500 dark:bg-emerald-400`} aria-hidden />
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
        </HeatmapTooltipProvider>
      </div>
    );
  },
);
