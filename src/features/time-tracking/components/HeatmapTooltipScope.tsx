"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const TIP_ATTR = "data-heatmap-tip";
const TOOLTIP_MAX_W = 300;
const VIEW_MARGIN = 10;
const TIP_GAP = 8;

type ScopeCtx = {
  activeKey: string | null;
  setActiveKey: (key: string | null) => void;
};

const HeatmapTooltipScopeContext = createContext<ScopeCtx | null>(null);

export function HeatmapTooltipProvider({ children }: { children: ReactNode }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const value = useMemo(() => ({ activeKey, setActiveKey }), [activeKey]);
  return (
    <HeatmapTooltipScopeContext.Provider value={value}>{children}</HeatmapTooltipScopeContext.Provider>
  );
}

function useHeatmapTooltipScope(): ScopeCtx {
  const ctx = useContext(HeatmapTooltipScopeContext);
  if (!ctx) {
    throw new Error("HeatmapInteractiveCell debe ir dentro de HeatmapTooltipProvider");
  }
  return ctx;
}

export type HeatmapTooltipRow = { label: string; value: string };

function formatDateLongEs(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export { formatDateLongEs };

type HeatmapInteractiveCellProps = {
  cellKey: string;
  columnIndex: number;
  className: string;
  /** Contenido visible de la celda (número del día o vacío). */
  children: ReactNode;
  tooltipTitle: string;
  tooltipRows: HeatmapTooltipRow[];
  /** Resumen corto para lectores de pantalla y botón. */
  ariaLabel: string;
};

/** Celda de heatmap con tooltip en portal; clic abre/cierra (otra celda o fuera cierra). */
export function HeatmapInteractiveCell({
  cellKey,
  columnIndex,
  className,
  children,
  tooltipTitle,
  tooltipRows,
  ariaLabel,
}: HeatmapInteractiveCellProps) {
  const { activeKey, setActiveKey } = useHeatmapTooltipScope();
  const open = activeKey === cellKey;
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);
  const tipId = useId();

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
    /** Cualquier scroll cierra el tooltip: evita que quede “pegado” y siga reposicionándose. */
    const onScrollClose = () => setActiveKey(null);
    const onResize = () => placeTooltip();
    window.addEventListener("scroll", onScrollClose, true);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", onScrollClose, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, placeTooltip, setActiveKey, tooltipTitle, tooltipRows]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      const el = t instanceof Element ? t : null;
      if (el?.closest(`[${TIP_ATTR}]`)) return;
      setActiveKey(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveKey(null);
    };
    document.addEventListener("mousedown", onDoc, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setActiveKey]);

  const onToggleClick = () => {
    setActiveKey(open ? null : cellKey);
  };

  const closeTip = () => setActiveKey(null);

  const tipContent = (
    <div
      ref={tipRef}
      id={tipId}
      role="tooltip"
      {...{ [TIP_ATTR]: "" }}
      className="rounded-2xl border border-slate-200/90 bg-white/95 pb-3 pl-3 pr-2 pt-2.5 text-left shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/[0.04] backdrop-blur-md dark:border-slate-600/90 dark:bg-slate-900/95 dark:shadow-black/40 dark:ring-white/[0.06]"
      style={{
        position: "fixed",
        top: tipPos?.top ?? -9999,
        left: tipPos?.left ?? 0,
        visibility: tipPos ? "visible" : "hidden",
        zIndex: 10050,
        maxWidth: `min(${TOOLTIP_MAX_W}px, calc(100vw - ${VIEW_MARGIN * 2}px))`,
      }}
    >
      <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-gradient-to-b from-emerald-500 to-emerald-700" aria-hidden />
      <div className="flex items-start gap-1 pl-2">
        <p className="min-w-0 flex-1 text-[13px] font-semibold capitalize leading-snug text-slate-900 dark:text-white">
          {tooltipTitle}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            closeTip();
          }}
          className="-mr-0.5 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:focus-visible:ring-emerald-400"
          aria-label="Cerrar detalle del día"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <dl className="mt-2 space-y-2 pl-2 pr-1">
        {tooltipRows.map((row) => (
          <div key={row.label}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {row.label}
            </dt>
            <dd className="mt-0.5 text-xs leading-snug text-slate-700 dark:text-slate-200">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <div ref={wrapRef} className="relative min-h-0 outline-none" {...{ [TIP_ATTR]: "" }}>
      <button
        type="button"
        className={`touch-manipulation ${className}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onToggleClick();
        }}
      >
        {children}
      </button>
      {open && typeof document !== "undefined" ? createPortal(tipContent, document.body) : null}
    </div>
  );
}
