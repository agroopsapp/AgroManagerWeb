"use client";

import { memo } from "react";
import { parseHHMM, toHHMM } from "@/shared/utils/time";

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);

/** Hora en 24 h: dos combos (horas + minutos), sin AM/PM. */
export const TimeSelect24h = memo(function TimeSelect24h({
  value,
  onChange,
  idPrefix,
}: {
  value: string;
  onChange: (hm: string) => void;
  idPrefix: string;
}) {
  const { h, m } = parseHHMM(value);
  const sel =
    "mt-1 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-1 focus:ring-agro-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 sm:gap-3">
      <div className="min-w-[7rem] flex-1">
        <label
          htmlFor={`${idPrefix}-h`}
          className="text-xs font-medium text-slate-600 dark:text-slate-400"
        >
          Horas
        </label>
        <select
          id={`${idPrefix}-h`}
          className={sel}
          value={h}
          onChange={(e) => onChange(toHHMM(parseInt(e.target.value, 10), m))}
        >
          {HOURS_24.map((hr) => (
            <option key={hr} value={hr}>
              {String(hr).padStart(2, "0")}
            </option>
          ))}
        </select>
      </div>
      <span
        className="hidden pb-2 text-xl font-bold text-slate-400 sm:inline"
        aria-hidden
      >
        :
      </span>
      <div className="min-w-[7rem] flex-1">
        <label
          htmlFor={`${idPrefix}-m`}
          className="text-xs font-medium text-slate-600 dark:text-slate-400"
        >
          Minutos
        </label>
        <select
          id={`${idPrefix}-m`}
          className={sel}
          value={m}
          onChange={(e) => onChange(toHHMM(h, parseInt(e.target.value, 10)))}
        >
          {MINUTES_60.map((mn) => (
            <option key={mn} value={mn}>
              {String(mn).padStart(2, "0")}
            </option>
          ))}
        </select>
      </div>
      <p className="w-full text-center text-xs text-slate-500 dark:text-slate-400 sm:w-auto sm:pb-2">
        <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
          {toHHMM(h, m)}
        </span>
        <span className="ml-1">(24 h)</span>
      </p>
    </div>
  );
});
