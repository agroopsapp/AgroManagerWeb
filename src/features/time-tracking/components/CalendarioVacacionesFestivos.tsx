"use client";

import { useMemo, useState } from "react";
import type { CalendarioLaboralDayMark } from "@/features/time-tracking/types";
import {
  buildMonthGridCells,
  labelCalendarioMarkKind,
} from "@/features/time-tracking/utils/calendarioLaboral";
import { workDateIsWeekend } from "@/shared/utils/time";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

function cellClasses(opts: {
  mark: CalendarioLaboralDayMark | undefined;
  isWeekend: boolean;
  isSelected: boolean;
  canEdit: boolean;
}): string {
  const { mark, isWeekend, isSelected, canEdit } = opts;
  const base =
    "flex aspect-square w-full min-h-0 flex-col items-center justify-center rounded-xl border p-1 text-center text-sm font-bold tabular-nums shadow-sm transition sm:text-base lg:text-lg";
  const cursor = canEdit ? "cursor-pointer hover:z-[1] hover:ring-2 hover:ring-agro-500/25" : "cursor-default";
  const ringSel = isSelected
    ? " ring-2 ring-agro-600 ring-offset-2 ring-offset-white dark:ring-agro-400 dark:ring-offset-slate-900"
    : "";

  if (mark?.kind === "festivo") {
    return `${base} ${cursor} border-amber-400/90 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/45 dark:text-amber-50${ringSel}`;
  }
  if (mark?.kind === "vacaciones") {
    return `${base} ${cursor} border-sky-400/90 bg-sky-50 text-sky-950 dark:border-sky-600 dark:bg-sky-950/45 dark:text-sky-50${ringSel}`;
  }
  if (isWeekend) {
    return `${base} ${cursor} border-slate-200/80 bg-slate-100/90 text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300${ringSel}`;
  }
  return `${base} ${cursor} border-slate-200 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100${ringSel}`;
}

export function CalendarioVacacionesFestivos(props: {
  canEdit: boolean;
  marks: Record<string, CalendarioLaboralDayMark>;
  onSetDayKind: (dateISO: string, kind: "festivo" | "vacaciones" | null, note?: string) => void;
}) {
  const { canEdit, marks, onSetDayKind } = props;
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth() + 1);
  const [selected, setSelected] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const grid = useMemo(() => buildMonthGridCells(y, m), [y, m]);

  const monthTitle = useMemo(
    () =>
      new Date(y, m - 1, 1).toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      }),
    [y, m],
  );

  const goPrev = () => {
    if (m <= 1) {
      setM(12);
      setY((v) => v - 1);
    } else setM((v) => v - 1);
    setSelected(null);
  };

  const goNext = () => {
    if (m >= 12) {
      setM(1);
      setY((v) => v + 1);
    } else setM((v) => v + 1);
    setSelected(null);
  };

  const handlePickDay = (iso: string) => {
    if (!canEdit) return;
    setSelected(iso);
    setNoteDraft(marks[iso]?.note ?? "");
  };

  const applyKind = (kind: "festivo" | "vacaciones" | null) => {
    if (!selected) return;
    onSetDayKind(selected, kind, kind ? noteDraft : undefined);
    if (kind == null) setNoteDraft("");
  };

  return (
    <div className="min-w-0 space-y-5">
      <div className="mx-auto w-full max-w-md space-y-4 sm:max-w-xl lg:max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label="Mes anterior"
            >
              ←
            </button>
            <button
              type="button"
              onClick={goNext}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label="Mes siguiente"
            >
              →
            </button>
          </div>
          <h2 className="min-w-0 flex-1 text-center text-lg font-bold capitalize leading-tight tracking-tight text-slate-900 sm:text-xl lg:text-2xl dark:text-white">
            {monthTitle}
          </h2>
          <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-2.5 text-sm sm:w-auto sm:justify-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-amber-50 px-3 py-1 font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
              Festivo
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/80 bg-sky-50 px-3 py-1 font-medium text-sky-900 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-100">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" aria-hidden />
              Vacaciones
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="flex min-h-[2rem] items-end justify-center pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:min-h-[2.25rem] sm:text-xs dark:text-slate-400"
            >
              {d}
            </div>
          ))}
        {grid.map((cell, idx) => {
          if (cell.dateISO == null) {
            return <div key={`pad-${idx}`} className="aspect-square min-h-0" aria-hidden />;
          }
          const iso = cell.dateISO;
          const mark = marks[iso];
          const wk = workDateIsWeekend(iso);
          const dayNum = Number(iso.slice(8, 10));
          const titleParts: string[] = [];
          if (mark) {
            titleParts.push(labelCalendarioMarkKind(mark.kind));
            if (mark.note) titleParts.push(mark.note);
          } else if (wk) titleParts.push("Fin de semana");
          const cls = cellClasses({
            mark,
            isWeekend: wk,
            isSelected: selected === iso,
            canEdit,
          });
          const title = titleParts.length ? titleParts.join(" · ") : undefined;
          if (canEdit) {
            return (
              <button
                key={iso}
                type="button"
                onClick={() => handlePickDay(iso)}
                title={title}
                className={cls}
              >
                <span>{dayNum}</span>
              </button>
            );
          }
          return (
            <div key={iso} className={cls} title={title}>
              <span>{dayNum}</span>
            </div>
          );
        })}
        </div>
      </div>

      {canEdit && selected && (
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/95 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/60 sm:p-5">
          <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Día seleccionado:{" "}
            <time dateTime={selected} className="tabular-nums text-agro-700 dark:text-agro-300">
              {new Date(selected + "T12:00:00").toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </p>
          <p className="mt-1.5 text-sm leading-snug text-slate-500 dark:text-slate-400">
            Marca el tipo de día. Opcionalmente añade una nota (p. ej. nombre del festivo).
          </p>
          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Nota (opcional)
            </span>
            <input
              type="text"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              maxLength={120}
              placeholder="Ej. Festividad local, cierre…"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-agro-500/50 focus:ring-2 focus:ring-agro-500/15 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => applyKind("festivo")}
              className="rounded-xl border border-amber-400/80 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50 dark:hover:bg-amber-900/40"
            >
              Guardar como festivo
            </button>
            <button
              type="button"
              onClick={() => applyKind("vacaciones")}
              className="rounded-xl border border-sky-400/80 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-950 shadow-sm transition hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-50 dark:hover:bg-sky-900/40"
            >
              Guardar como vacaciones
            </button>
            <button
              type="button"
              onClick={() => applyKind(null)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Quitar marca
            </button>
          </div>
        </div>
      )}

      {!canEdit && (
        <p className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 text-base text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
          Solo puedes <strong>consultar</strong> el calendario. Para añadir o cambiar festivos y vacaciones,
          contacta con administración.
        </p>
      )}
    </div>
  );
}
