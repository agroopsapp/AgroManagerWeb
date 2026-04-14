"use client";

import type { TimeEntryApiStatus } from "@/features/time-tracking/types";
import {
  timeEntryApiStatusBadgeClass,
} from "@/features/time-tracking/utils/timeEntryApiStatus";

type Props = {
  status: TimeEntryApiStatus | "unknown" | null | undefined;
  className?: string;
};

export function TimeEntryStatusBadge({ status, className = "" }: Props) {
  if (status === null || status === undefined) {
    return (
      <span className={`text-slate-400 dark:text-slate-500 ${className}`.trim()}>—</span>
    );
  }
  const label = status === "unknown" ? "Desconocido" : status;
  return (
    <span
      className={`inline-flex max-w-full rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-tight ${timeEntryApiStatusBadgeClass(status)} ${className}`.trim()}
      title={
        status === "unknown"
          ? "Valor de estado no reconocido (revisar API o datos antiguos)"
          : `API status: ${status}`
      }
    >
      {label}
    </span>
  );
}
