"use client";

import { memo } from "react";
import { formatMinutesShort } from "@/shared/utils/time";

const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);
const BREAK_DURATION_HOURS = Array.from({ length: 9 }, (_, i) => i);

/** Duración de descanso: horas (0–8) + minutos (0–59). */
export const BreakDurationCombos = memo(function BreakDurationCombos({
  hours,
  minutes,
  onHoursChange,
  onMinutesChange,
  onUserEdit,
  idPrefix,
}: {
  hours: number;
  minutes: number;
  onHoursChange: (h: number) => void;
  onMinutesChange: (m: number) => void;
  onUserEdit: () => void;
  idPrefix: string;
}) {
  const sel =
    "mt-1 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
  const totalMin = hours * 60 + minutes;
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 sm:gap-3">
      <div className="min-w-[6.5rem] flex-1">
        <label
          htmlFor={`${idPrefix}-bh`}
          className="text-xs font-medium text-slate-600 dark:text-slate-400"
        >
          Horas
        </label>
        <select
          id={`${idPrefix}-bh`}
          className={sel}
          value={hours}
          onChange={(e) => {
            onUserEdit();
            onHoursChange(parseInt(e.target.value, 10));
          }}
        >
          {BREAK_DURATION_HOURS.map((hr) => (
            <option key={hr} value={hr}>
              {hr} h
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[6.5rem] flex-1">
        <label
          htmlFor={`${idPrefix}-bm`}
          className="text-xs font-medium text-slate-600 dark:text-slate-400"
        >
          Minutos
        </label>
        <select
          id={`${idPrefix}-bm`}
          className={sel}
          value={minutes}
          onChange={(e) => {
            onUserEdit();
            onMinutesChange(parseInt(e.target.value, 10));
          }}
        >
          {MINUTES_60.map((mn) => (
            <option key={mn} value={mn}>
              {String(mn).padStart(2, "0")}
            </option>
          ))}
        </select>
      </div>
      <p className="w-full text-center text-xs text-slate-600 dark:text-slate-400">
        Descanso elegido:{" "}
        <span className="font-semibold text-rose-800 dark:text-rose-300">
          {formatMinutesShort(totalMin)}
        </span>
      </p>
    </div>
  );
});
