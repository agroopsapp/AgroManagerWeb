/**
 * Aspecto visual compartido entre heatmaps de cumplimiento y calendario de persona (equipo).
 * Objetivo: tarjeta contenida, cabeceras claras y celdas menos «bloque» que la primera iteración.
 */

/** Contenedor del grid + leyenda inmediata debajo. */
export const CALENDAR_CARD_CLASS =
  "rounded-2xl border border-slate-200/85 bg-gradient-to-b from-white via-slate-50/40 to-slate-50/70 p-2 shadow-[0_2px_12px_rgba(15,23,42,0.055)] ring-1 ring-slate-900/[0.035] sm:rounded-3xl sm:p-2.5 dark:border-slate-700/75 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/80 dark:shadow-none dark:ring-white/[0.05]";

/** Título del mes / periodo encima de la rejilla (heatmaps + calendario persona). */
export const CALENDAR_GRID_MONTH_TITLE =
  "mb-1.5 text-center text-[13px] font-semibold leading-tight text-slate-800 sm:mb-2 sm:text-sm dark:text-slate-100";

/** Letras L M X… como chips discretos. */
export const CALENDAR_WEEKDAY_HEADER =
  "flex min-h-[2rem] items-center justify-center rounded-md bg-slate-100/95 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:min-h-[2.25rem] sm:rounded-lg sm:py-2 dark:bg-slate-800/90 dark:text-slate-300 dark:shadow-none";

/** Etiqueta de rango de semana (columna izquierda del heatmap): neutra, sin tinte verde. */
export const CALENDAR_WEEK_RANGE_LABEL =
  "flex min-h-[2.85rem] items-center rounded-xl border border-slate-200/90 bg-slate-50/90 px-2.5 py-1.5 text-[10px] font-medium leading-snug text-slate-700 shadow-sm dark:border-slate-600/70 dark:bg-slate-800/70 dark:text-slate-200 dark:shadow-none";

/** Base común de celda con día (heatmap + calendario persona). */
export const CAL_CELL_BASE =
  "flex aspect-square w-full min-h-0 min-w-0 flex-col items-center justify-center rounded-xl p-0.5 text-center tabular-nums outline-none ring-1 ring-slate-900/[0.06] transition duration-150 hover:z-[1] hover:shadow-md hover:ring-2 hover:ring-slate-400/35 focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-slate-500/45 dark:ring-white/[0.07] dark:hover:shadow-black/20 dark:hover:ring-slate-500/30 sm:rounded-2xl sm:p-1";

/** Huecos sin día en la rejilla ISO. */
export function emptyCalendarPadClass(): string {
  return "aspect-square w-full min-h-0 rounded-2xl bg-slate-100/55 ring-1 ring-inset ring-slate-300/45 dark:bg-slate-800/30 dark:ring-slate-600/35";
}

/** Tipografía del número del día (antes muy grande en sm). */
export const CAL_CELL_DAY_NUM =
  "text-sm font-semibold tabular-nums sm:text-[0.9375rem]";

export const LEGEND_PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-slate-200/75 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm dark:border-slate-600/65 dark:bg-slate-900/65 dark:text-slate-200";

export const LEGEND_DOT = "h-1.5 w-1.5 shrink-0 rounded-full";
