"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import DatePicker from "@/components/DatePicker";
import { formatDateEsWeekdayDdMmYyyy, localTodayISO } from "@/shared/utils/time";

const DEFAULT_TRIGGER =
  "flex w-full min-h-[42px] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm outline-none transition hover:border-slate-300 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500";

const COMPACT_TRIGGER =
  "flex w-full min-h-[30px] items-center justify-between gap-2 rounded-md border border-slate-200/80 bg-white px-2 py-1 text-left text-xs text-slate-900 shadow-sm outline-none transition hover:border-slate-300 focus-visible:border-emerald-600 focus-visible:ring-1 focus-visible:ring-emerald-600/20 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100";

const PANEL_W = 320;
const VIEW_MARGIN = 12;
/** Por encima del modal del dashboard (z-100) y del drawer móvil (z-50). */
const Z_POPOVER = 10_000;

function viewportWidthPx(): number {
  if (typeof document === "undefined") return PANEL_W;
  const d = document.documentElement;
  return d.clientWidth || window.innerWidth;
}

function clampPopoverPosition(buttonEl: HTMLElement): {
  top: number;
  left: number;
  width: number;
} {
  const r = buttonEl.getBoundingClientRect();
  const vw = viewportWidthPx();
  const vh = window.innerHeight;
  const panelW = Math.min(PANEL_W, vw - 2 * VIEW_MARGIN);
  let left = r.left;
  if (left + panelW > vw - VIEW_MARGIN) {
    left = vw - VIEW_MARGIN - panelW;
  }
  if (left < VIEW_MARGIN) {
    left = VIEW_MARGIN;
  }

  const estH = 380;
  let top = r.bottom + 6;
  if (top + estH > vh - VIEW_MARGIN) {
    top = Math.max(VIEW_MARGIN, r.top - estH - 6);
  }
  if (top < VIEW_MARGIN) {
    top = VIEW_MARGIN;
  }

  return { top, left, width: panelW };
}

/** Corrige `left` si el panel real (borde + sombras) sobresale del viewport. */
function snapPopoverIntoView(popEl: HTMLElement, prevLeft: number): number {
  const vw = viewportWidthPx();
  const box = popEl.getBoundingClientRect();
  let left = prevLeft;
  if (box.right > vw - VIEW_MARGIN) {
    left += vw - VIEW_MARGIN - box.right;
  }
  if (box.left + (left - prevLeft) < VIEW_MARGIN) {
    left = VIEW_MARGIN;
  }
  return left;
}

type Props = {
  value: string;
  onChange: (iso: string) => void;
  emptyLabel?: string;
  allowClear?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
  variant?: "default" | "compact";
  triggerClassName?: string;
  id?: string;
};

export function DatePickerPopoverField({
  value,
  onChange,
  emptyLabel = "Todas las fechas",
  allowClear = true,
  min,
  max,
  disabled = false,
  variant = "default",
  triggerClassName = "",
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const placePopover = useCallback(() => {
    if (!buttonRef.current) return;
    setCoords(clampPopoverPosition(buttonRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    placePopover();
    let cancelled = false;
    const idRaf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled || !popoverRef.current) return;
        setCoords((prev) => {
          if (!prev || !popoverRef.current) return prev;
          const nextLeft = snapPopoverIntoView(popoverRef.current, prev.left);
          if (nextLeft === prev.left) return prev;
          return { ...prev, left: nextLeft };
        });
      });
    });
    const onWin = () => placePopover();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(idRaf);
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, placePopover]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  const baseTrigger = variant === "compact" ? COMPACT_TRIGGER : DEFAULT_TRIGGER;
  const hasValue = value.trim() !== "";
  const labelText = hasValue ? formatDateEsWeekdayDdMmYyyy(value) : emptyLabel;
  const pickerValue = hasValue ? value : localTodayISO();

  const popover =
    open && !disabled && coords && typeof document !== "undefined" ? (
      <div
        ref={popoverRef}
        className="max-w-[calc(100vw-24px)] box-border overflow-visible"
        style={{
          position: "fixed",
          top: coords.top,
          left: coords.left,
          width: coords.width,
          zIndex: Z_POPOVER,
        }}
      >
        <DatePicker
          value={pickerValue}
          onChange={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
          min={min}
          max={max}
          className="shadow-2xl ring-1 ring-slate-900/10 dark:ring-white/10"
        />
        {allowClear && hasValue ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Quitar fecha
          </button>
        ) : null}
      </div>
    ) : null;

  return (
    <div ref={wrapRef} className="relative w-full">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
        className={`${baseTrigger} disabled:cursor-not-allowed disabled:opacity-45 ${triggerClassName}`.trim()}
      >
        <span className="min-w-0 flex-1 truncate">{labelText}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18" strokeLinecap="round" />
        </svg>
      </button>

      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
