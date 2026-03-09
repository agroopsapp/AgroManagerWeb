"use client";

import { useState, useMemo, useEffect } from "react";

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Lunes = 0, Domingo = 6 */
const DÍAS_SEMANA_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function parseISO(iso: string): Date {
  return new Date(iso + "T12:00:00");
}

/** Fecha en hora local como YYYY-MM-DD (evita que UTC cambie el día) */
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** getDay() en JS: 0=Dom, 1=Lun, ... 6=Sáb. Convertimos a 0=Lun, 6=Dom */
function getLunesBasedDay(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 6 : js - 1;
}

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
}

export default function DatePicker({ value, onChange, min, max, className = "" }: DatePickerProps) {
  const initial = useMemo(() => parseISO(value || toISO(new Date())), [value]);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useEffect(() => {
    const d = parseISO(value || toISO(new Date()));
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value]);

  const firstOfMonth = useMemo(() => new Date(viewYear, viewMonth, 1), [viewYear, viewMonth]);
  const lastOfMonth = useMemo(() => new Date(viewYear, viewMonth + 1, 0), [viewYear, viewMonth]);
  const startPadding = getLunesBasedDay(firstOfMonth);
  const daysInMonth = lastOfMonth.getDate();

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const todayISO = toISO(new Date());
  const selectedISO = value || todayISO;

  const cells = useMemo(() => {
    const list: { type: "empty" | "day"; day?: number; iso?: string; isToday?: boolean; isSelected?: boolean }[] = [];
    for (let i = 0; i < startPadding; i++) list.push({ type: "empty" });
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toISO(new Date(viewYear, viewMonth, day));
      list.push({
        type: "day",
        day,
        iso,
        isToday: iso === todayISO,
        isSelected: iso === selectedISO,
      });
    }
    return list;
  }, [startPadding, daysInMonth, viewYear, viewMonth, todayISO, selectedISO]);

  const minDate = min ? parseISO(min).getTime() : null;
  const maxDate = max ? parseISO(max).getTime() : null;

  return (
    <div className={`min-w-[280px] rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600"
          aria-label="Mes anterior"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {MESES_ES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600"
          aria-label="Mes siguiente"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DÍAS_SEMANA_ES.map((label) => (
          <div
            key={label}
            className="min-w-0 py-1 text-xs font-medium text-slate-500 whitespace-nowrap dark:text-slate-400"
          >
            {label}
          </div>
        ))}
        {cells.map((cell, i) =>
          cell.type === "empty" ? (
            <div key={`e-${i}`} className="aspect-square min-w-0" />
          ) : (
            <button
              key={cell.iso}
              type="button"
              disabled={
                (minDate != null && new Date(cell.iso!).getTime() < minDate) ||
                (maxDate != null && new Date(cell.iso!).getTime() > maxDate)
              }
              onClick={() => onChange(cell.iso!)}
              className={`aspect-square min-w-0 rounded text-sm transition ${
                cell.isSelected
                  ? "bg-agro-600 text-white hover:bg-agro-700 dark:bg-agro-500 dark:hover:bg-agro-600"
                  : cell.isToday
                    ? "bg-agro-100 font-semibold text-agro-800 hover:bg-agro-200 dark:bg-agro-900/50 dark:text-agro-200 dark:hover:bg-agro-900/70"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-600"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {cell.day}
            </button>
          )
        )}
      </div>

      <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-2 dark:border-slate-600">
        <button
          type="button"
          onClick={() => onChange(todayISO)}
          className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-600"
        >
          Hoy
        </button>
      </div>
    </div>
  );
}
