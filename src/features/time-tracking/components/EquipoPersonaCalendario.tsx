"use client";

import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EquipoTablaFila } from "@/features/time-tracking/types";
import {
  CALENDAR_CARD_CLASS,
  CALENDAR_WEEKDAY_HEADER,
  CAL_CELL_BASE,
  CAL_CELL_DAY_NUM,
  emptyCalendarPadClass,
  LEGEND_DOT,
  LEGEND_PILL,
} from "@/features/time-tracking/utils/equipoCalendarChrome";
import {
  buildEquipoCalTooltipModel,
  buildWeekGridForRange,
  dayOfMonthFromISO,
  equipoCalendarioStatusByDate,
  type EquipoCalCellKind,
} from "@/features/time-tracking/utils/equipoCalendar";

/** Misma serigrafía que los heatmaps de cumplimiento (L / M / X …). */
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"] as const;

const TOOLTIP_MAX_W = 320;
const VIEW_MARGIN = 10;
const TIP_GAP = 6;

function cellClass(kind: EquipoCalCellKind | undefined, inRange: boolean): string {
  if (!inRange) {
    return emptyCalendarPadClass();
  }
  const base = CAL_CELL_BASE;
  switch (kind) {
    case "no_laboral":
      return `${base} ring-slate-300/60 bg-slate-100 text-slate-700 dark:ring-slate-600 dark:bg-slate-800/65 dark:text-slate-200`;
    case "sin_imputar":
      return `${base} ring-rose-400/35 bg-rose-50 text-rose-900 dark:ring-rose-600/45 dark:bg-rose-950/55 dark:text-rose-100`;
    case "fichaje_con_parte":
      return `${base} ring-emerald-400/40 bg-emerald-50 text-emerald-950 dark:ring-emerald-600/45 dark:bg-emerald-950/55 dark:text-emerald-50`;
    case "fichaje_sin_parte":
      return `${base} ring-amber-400/40 bg-amber-50 text-amber-950 dark:ring-amber-600/45 dark:bg-amber-950/45 dark:text-amber-50`;
    case "vacaciones":
      return `${base} ring-sky-400/40 bg-sky-50 text-sky-950 dark:ring-sky-600/45 dark:bg-sky-950/50 dark:text-sky-50`;
    case "baja":
      return `${base} ring-violet-400/35 bg-violet-50 text-violet-950 dark:ring-violet-600/45 dark:bg-violet-950/45 dark:text-violet-50`;
    case "dia_no_laboral_reg":
      return `${base} ring-stone-400/35 bg-stone-50 text-stone-900 dark:ring-stone-600/45 dark:bg-stone-900/50 dark:text-stone-100`;
    default:
      return `${base} ring-slate-300/50 bg-slate-50 text-slate-600 dark:ring-slate-600 dark:bg-slate-800/55 dark:text-slate-300`;
  }
}

function CalDayCell({
  dateISO,
  kind,
  columnIndex,
  fila,
}: {
  dateISO: string;
  kind: EquipoCalCellKind | undefined;
  columnIndex: number;
  fila: EquipoTablaFila | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const model = useMemo(
    () => buildEquipoCalTooltipModel(dateISO, fila, kind),
    [dateISO, fila, kind],
  );

  /**
   * Mostrar/ocultar inmediato: sin retraso para que al pasar el ratón de una celda
   * a otra no queden tooltips solapados. El tooltip es pointer-events-none, así
   * que no captura el cursor: el `mouseleave` de la celda siempre dispara el cierre.
   */
  const showTip = () => setOpen(true);
  const hideTip = () => {
    setOpen(false);
    setTipPos(null);
  };

  const placeTooltip = useCallback(() => {
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!wrap || !tip) return;
    const r = wrap.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(TOOLTIP_MAX_W, vw - 2 * VIEW_MARGIN);
    tip.style.width = `${w}px`;
    const h = tip.offsetHeight;

    let top = r.bottom + TIP_GAP;
    if (top + h > vh - VIEW_MARGIN) {
      top = r.top - TIP_GAP - h;
    }
    top = Math.max(VIEW_MARGIN, Math.min(top, vh - h - VIEW_MARGIN));

    let left = columnIndex >= 4 ? r.right - w : r.left;
    left = Math.max(VIEW_MARGIN, Math.min(left, vw - w - VIEW_MARGIN));

    setTipPos({ top, left });
  }, [columnIndex]);

  useLayoutEffect(() => {
    if (!open) {
      setTipPos(null);
      return;
    }
    placeTooltip();
    const id = requestAnimationFrame(placeTooltip);
    const onReposition = () => placeTooltip();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, placeTooltip, model]);

  const tipContent = (
    <div
      ref={tipRef}
      role="tooltip"
      className="pointer-events-none rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xl dark:border-slate-600 dark:bg-slate-800"
      style={{
        position: "fixed",
        top: tipPos?.top ?? -9999,
        left: tipPos?.left ?? 0,
        visibility: tipPos ? "visible" : "hidden",
        zIndex: 10050,
        maxWidth: `min(20rem, calc(100vw - ${VIEW_MARGIN * 2}px))`,
      }}
    >
      <p className="border-b border-slate-100 pb-2 text-base font-bold text-slate-900 dark:border-slate-600 dark:text-white">
        {model.title}
      </p>
      <dl className="mt-2.5 max-h-[min(45vh,18rem)] space-y-2.5 overflow-y-auto pr-0.5">
        {model.rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {r.label}
            </dt>
            <dd className="mt-1 text-sm leading-snug text-slate-800 dark:text-slate-100">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className="relative outline-none"
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
      onFocus={showTip}
      onBlur={hideTip}
      tabIndex={0}
    >
      <div className={cellClass(kind, true)}>
        <span className={CAL_CELL_DAY_NUM}>{dayOfMonthFromISO(dateISO)}</span>
      </div>
      {open && typeof document !== "undefined"
        ? createPortal(tipContent, document.body)
        : null}
    </div>
  );
}

/**
 * Vista calendario del periodo filtrado para **una sola persona**
 * (mismos colores lógicos que la tabla de registros).
 */
export const EquipoPersonaCalendario = memo(function EquipoPersonaCalendario({
  filas,
  rangeStart,
  rangeEnd,
  nombrePersona,
}: {
  filas: EquipoTablaFila[];
  rangeStart: string;
  rangeEnd: string;
  nombrePersona: string;
}) {
  const weeks = useMemo(
    () => buildWeekGridForRange(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );
  const statusByDate = useMemo(() => equipoCalendarioStatusByDate(filas), [filas]);
  const filaByDate = useMemo(() => {
    const m = new Map<string, EquipoTablaFila>();
    for (const f of filas) {
      const wd = f.kind === "registro" ? f.e.workDate : f.workDate;
      m.set(wd, f);
    }
    return m;
  }, [filas]);

  if (weeks.length === 0) return null;

  return (
    <div className="min-w-0" aria-label={`Calendario de ${nombrePersona}`}>
      <div className="mx-auto w-full max-w-md sm:max-w-lg md:max-w-xl">
        <div className={CALENDAR_CARD_CLASS}>
        <div className="grid grid-cols-7 items-stretch gap-x-2 gap-y-2 sm:gap-x-2.5 sm:gap-y-2.5">
          {WEEKDAYS.map((d) => (
            <div key={d} className={`${CALENDAR_WEEKDAY_HEADER} min-h-[2.25rem] sm:min-h-[2.5rem]`}>
              {d}
            </div>
          ))}
          {weeks.flatMap((row, wi) =>
            row.map((dateISO, di) => {
              const inRange = dateISO != null;
              const kind = dateISO ? statusByDate.get(dateISO) : undefined;
              if (!inRange || !dateISO) {
                return (
                  <div
                    key={dateISO ?? `pad-${wi}-${di}`}
                    className={cellClass(kind, false)}
                    aria-hidden
                  />
                );
              }
              return (
                <CalDayCell
                  key={dateISO}
                  dateISO={dateISO}
                  kind={kind}
                  columnIndex={di}
                  fila={filaByDate.get(dateISO)}
                />
              );
            }),
          )}
        </div>
        </div>
      </div>

      <ul
        className="mx-auto mt-4 flex max-w-xl flex-wrap gap-2"
        aria-label="Leyenda del calendario"
      >
        <li className={LEGEND_PILL}>
          <span className={`${LEGEND_DOT} bg-emerald-500 dark:bg-emerald-400`} aria-hidden />
          Fichaje con parte
        </li>
        <li className={LEGEND_PILL}>
          <span className={`${LEGEND_DOT} bg-amber-400 dark:bg-amber-300`} aria-hidden />
          Fichaje sin parte
        </li>
        <li className={LEGEND_PILL}>
          <span className={`${LEGEND_DOT} bg-rose-400 dark:bg-rose-300`} aria-hidden />
          Sin imputar
        </li>
        <li className={LEGEND_PILL}>
          <span className={`${LEGEND_DOT} bg-slate-400 dark:bg-slate-500`} aria-hidden />
          No laboral (rejilla)
        </li>
        <li className={LEGEND_PILL}>
          <span className={`${LEGEND_DOT} bg-sky-400 dark:bg-sky-300`} aria-hidden />
          Vacaciones
        </li>
        <li className={LEGEND_PILL}>
          <span className={`${LEGEND_DOT} bg-violet-400 dark:bg-violet-300`} aria-hidden />
          Baja
        </li>
      </ul>
    </div>
  );
});
