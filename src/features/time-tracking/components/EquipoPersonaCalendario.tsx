"use client";

import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EquipoTablaFila } from "@/features/time-tracking/types";
import {
  buildEquipoCalTooltipModel,
  buildWeekGridForRange,
  dayOfMonthFromISO,
  equipoCalendarioStatusByDate,
  type EquipoCalCellKind,
} from "@/features/time-tracking/utils/equipoCalendar";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

const TOOLTIP_MAX_W = 320;
const VIEW_MARGIN = 10;
const TIP_GAP = 6;

function cellClass(kind: EquipoCalCellKind | undefined, inRange: boolean): string {
  /* Celdas cuadradas (aspect-square) + ancho máximo del grid: evita barras anchas vacías. */
  if (!inRange) {
    return "aspect-square w-full min-h-0 rounded-xl bg-slate-100/70 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800/40 dark:ring-slate-700/60";
  }
  const base =
    "flex aspect-square w-full min-h-0 flex-col items-center justify-center rounded-xl border p-1 text-center tabular-nums shadow-sm outline-none transition hover:z-[1] hover:ring-2 hover:ring-agro-500/25 focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-agro-500/40 dark:hover:ring-agro-400/20";
  switch (kind) {
    case "no_laboral":
      return `${base} border-slate-200/90 bg-slate-100 text-lg font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200 sm:text-xl`;
    case "sin_imputar":
      return `${base} border-rose-300/80 bg-rose-50 text-lg font-bold text-rose-900 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100 sm:text-xl`;
    case "fichaje_con_parte":
      return `${base} border-teal-400/80 bg-teal-50 text-lg font-bold text-teal-950 dark:border-teal-600 dark:bg-teal-950/50 dark:text-teal-50 sm:text-xl`;
    case "fichaje_sin_parte":
      return `${base} border-amber-400/80 bg-amber-50 text-lg font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-50 sm:text-xl`;
    case "vacaciones":
      return `${base} border-sky-300/80 bg-sky-50 text-lg font-bold text-sky-950 dark:border-sky-600 dark:bg-sky-950/45 dark:text-sky-50 sm:text-xl`;
    case "baja":
      return `${base} border-violet-300/80 bg-violet-50 text-lg font-bold text-violet-950 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-50 sm:text-xl`;
    case "dia_no_laboral_reg":
      return `${base} border-stone-300/80 bg-stone-50 text-lg font-bold text-stone-900 dark:border-stone-600 dark:bg-stone-900/45 dark:text-stone-100 sm:text-xl`;
    default:
      return `${base} border-slate-200 bg-slate-50 text-lg font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300 sm:text-xl`;
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
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const model = useMemo(
    () => buildEquipoCalTooltipModel(dateISO, fila, kind),
    [dateISO, fila, kind],
  );

  const clearHide = () => {
    if (hideTimer.current != null) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const showTip = () => {
    clearHide();
    setOpen(true);
  };

  const hideTip = () => {
    clearHide();
    hideTimer.current = setTimeout(() => {
      setOpen(false);
      setTipPos(null);
    }, 280);
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
      className="pointer-events-auto rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xl dark:border-slate-600 dark:bg-slate-800"
      style={{
        position: "fixed",
        top: tipPos?.top ?? -9999,
        left: tipPos?.left ?? 0,
        visibility: tipPos ? "visible" : "hidden",
        zIndex: 10050,
        maxWidth: `min(20rem, calc(100vw - ${VIEW_MARGIN * 2}px))`,
      }}
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
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
        <span>{dayOfMonthFromISO(dateISO)}</span>
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
      <div className="mb-4 sm:mb-5">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl">
          Calendario · {nombrePersona}
        </h3>
        <details className="group mt-2 max-w-2xl rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-600/80 dark:bg-slate-900/40">
          <summary className="cursor-pointer list-none text-sm font-medium text-agro-800 outline-none marker:hidden dark:text-agro-400 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              Cómo leer este calendario
              <span className="text-xs font-normal text-slate-400 group-open:hidden dark:text-slate-500">
                (mostrar)
              </span>
              <span className="hidden text-xs font-normal text-slate-400 group-open:inline dark:text-slate-500">
                (ocultar)
              </span>
            </span>
          </summary>
          <p className="mt-2 border-t border-slate-100 pt-2 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-300">
            Fichaje laboral en dos estados: <strong className="text-teal-800 dark:text-teal-300">con parte</strong> en
            servidor (verde azulado) o <strong className="text-amber-800 dark:text-amber-300">sin parte</strong>{" "}
            (ámbar). Pasa el ratón o enfoca un día para ver el detalle y la ubicación si el API la envía.
          </p>
        </details>
      </div>

      <div className="mx-auto w-full max-w-md sm:max-w-lg md:max-w-xl">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="pb-2 text-center text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 sm:pb-2.5 sm:text-sm"
            >
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

      <ul
        className="mx-auto mt-5 grid max-w-xl grid-cols-1 gap-x-6 gap-y-2.5 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-2 sm:gap-y-3 md:grid-cols-3"
        aria-label="Leyenda del calendario"
      >
        <li className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-4 w-4 shrink-0 rounded-md border-2 border-teal-400 bg-teal-50 shadow-sm dark:border-teal-500 dark:bg-teal-950/55"
            aria-hidden
          />
          <span className="font-medium leading-snug">Fichaje con parte</span>
        </li>
        <li className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-4 w-4 shrink-0 rounded-md border-2 border-amber-400 bg-amber-50 shadow-sm dark:border-amber-500 dark:bg-amber-950/45"
            aria-hidden
          />
          <span className="font-medium leading-snug">Fichaje sin parte</span>
        </li>
        <li className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-4 w-4 shrink-0 rounded-md border-2 border-rose-300 bg-rose-100 shadow-sm dark:border-rose-600 dark:bg-rose-950/55"
            aria-hidden
          />
          <span className="font-medium leading-snug">Sin imputar</span>
        </li>
        <li className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-4 w-4 shrink-0 rounded-md border-2 border-slate-300 bg-slate-100 shadow-sm dark:border-slate-500 dark:bg-slate-800/70"
            aria-hidden
          />
          <span className="font-medium leading-snug">No laboral (rejilla)</span>
        </li>
        <li className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-4 w-4 shrink-0 rounded-md border-2 border-sky-300 bg-sky-100 shadow-sm dark:border-sky-600 dark:bg-sky-950/50"
            aria-hidden
          />
          <span className="font-medium leading-snug">Vacaciones</span>
        </li>
        <li className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-4 w-4 shrink-0 rounded-md border-2 border-violet-300 bg-violet-100 shadow-sm dark:border-violet-600 dark:bg-violet-950/45"
            aria-hidden
          />
          <span className="font-medium leading-snug">Baja</span>
        </li>
      </ul>
    </div>
  );
});
