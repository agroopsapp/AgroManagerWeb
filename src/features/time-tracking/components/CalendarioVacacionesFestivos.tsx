"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  inRange: boolean;
}): string {
  const { mark, isWeekend, isSelected, canEdit, inRange } = opts;
  const base =
    "flex aspect-square w-full min-h-0 flex-col items-center justify-center rounded-xl border p-1 text-center text-sm font-bold tabular-nums shadow-sm transition sm:text-base lg:text-lg";
  const cursor = canEdit ? "cursor-pointer hover:z-[1] hover:ring-2 hover:ring-agro-500/25" : "cursor-default";
  const ringSel = isSelected
    ? " ring-2 ring-agro-600 ring-offset-2 ring-offset-white dark:ring-agro-400 dark:ring-offset-slate-900"
    : "";
  const muted = !inRange ? " opacity-40 grayscale-[0.15]" : "";

  if (mark?.kind === "festivo") {
    return `${base} ${cursor} border-amber-400/90 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/45 dark:text-amber-50${ringSel}${muted}`;
  }
  if (mark?.kind === "vacaciones") {
    return `${base} ${cursor} border-sky-400/90 bg-sky-50 text-sky-950 dark:border-sky-600 dark:bg-sky-950/45 dark:text-sky-50${ringSel}${muted}`;
  }
  if (isWeekend) {
    return `${base} ${cursor} border-slate-200/80 bg-slate-100/90 text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300${ringSel}${muted}`;
  }
  return `${base} ${cursor} border-slate-200 bg-white text-slate-800 hover:bg-slate-50/80 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100 dark:hover:bg-slate-800/40${ringSel}${muted}`;
}

export function CalendarioVacacionesFestivos(props: {
  /** Si true: permite seleccionar día y guardar marcas (según `mode`). */
  canEditHolidays: boolean;
  canEditVacations: boolean;
  /** Festivos empresa (siempre se muestran). */
  holidaysByDate: Record<string, CalendarioLaboralDayMark>;
  /** Vacaciones del usuario seleccionado (se muestran junto a festivos). */
  vacationsByDate: Record<string, CalendarioLaboralDayMark>;
  onSetHoliday: (dateISO: string, mark: CalendarioLaboralDayMark | null) => void;
  onSetVacation: (dateISO: string, mark: CalendarioLaboralDayMark | null) => void;
  /** Si se pasa, se atenúan los días fuera del rango y no se pueden marcar. */
  visibleRange?: { from: string; to: string } | null;
}) {
  const {
    canEditHolidays,
    canEditVacations,
    holidaysByDate,
    vacationsByDate,
    onSetHoliday,
    onSetVacation,
    visibleRange,
  } = props;
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [selected, setSelected] = useState<string | null>(null);
  const [holidayNoteDraft, setHolidayNoteDraft] = useState("");
  const [vacationNoteDraft, setVacationNoteDraft] = useState("");

  const goPrevYear = () => {
    setY((v) => v - 1);
    setSelected(null);
  };

  const goNextYear = () => {
    setY((v) => v + 1);
    setSelected(null);
  };

  const handlePickDay = (iso: string) => {
    if (!canEditHolidays && !canEditVacations) return;
    if (visibleRange && (iso < visibleRange.from || iso > visibleRange.to)) return;
    setSelected(iso);
    setHolidayNoteDraft(holidaysByDate[iso]?.note ?? "");
    setVacationNoteDraft(vacationsByDate[iso]?.note ?? "");
  };

  const applyHoliday = (kind: "festivo" | null) => {
    if (!selected || !canEditHolidays) return;
    const trimmed = holidayNoteDraft.trim();
    const mark =
      kind == null
        ? null
        : ({
            kind,
            note: trimmed ? trimmed.slice(0, 120) : undefined,
          } satisfies CalendarioLaboralDayMark);
    onSetHoliday(selected, mark);
    if (kind == null) setHolidayNoteDraft("");
  };

  const applyVacation = (kind: "vacaciones" | null) => {
    if (!selected || !canEditVacations) return;
    const trimmed = vacationNoteDraft.trim();
    const mark =
      kind == null
        ? null
        : ({
            kind,
            note: trimmed ? trimmed.slice(0, 120) : undefined,
          } satisfies CalendarioLaboralDayMark);
    onSetVacation(selected, mark);
    if (kind == null) setVacationNoteDraft("");
  };

  return (
    <div className="min-w-0 space-y-5">
      <div className="mx-auto w-full max-w-md space-y-4 sm:max-w-3xl lg:max-w-6xl">
        <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50/70 px-4 py-3 shadow-sm dark:border-slate-700/70 dark:from-slate-900/80 dark:to-slate-950/40 sm:px-5 sm:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrevYear}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label="Año anterior"
            >
              ←
            </button>
            <button
              type="button"
              onClick={goNextYear}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label="Año siguiente"
            >
              →
            </button>
          </div>
          <h2 className="min-w-0 flex-1 text-center text-lg font-extrabold leading-tight tracking-tight text-slate-900 sm:text-xl lg:text-2xl dark:text-white">
            <span className="inline-flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-gradient-to-r from-agro-500 via-emerald-500 to-teal-500"
                aria-hidden
              />
              {y}
            </span>
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
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const monthName = new Date(y, month - 1, 1).toLocaleDateString("es-ES", { month: "long" });
            const grid = buildMonthGridCells(y, month);
            return (
              <section
                key={month}
                className="min-w-0 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 shadow-sm ring-1 ring-slate-200/40 dark:border-slate-700/70 dark:bg-slate-900/70 dark:ring-slate-700/60"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-agro-500/10 via-emerald-500/10 to-teal-500/10 px-4 py-2.5 dark:border-slate-700 dark:from-agro-500/10 dark:via-emerald-500/10 dark:to-teal-500/10">
                  <h3 className="text-sm font-extrabold capitalize tracking-tight text-slate-900 dark:text-white">
                    {monthName}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {y}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-2 px-4 pb-4 pt-3">
                  {WEEKDAYS.map((d) => (
                    <div
                      key={`${month}-${d}`}
                      className="flex min-h-[1.5rem] items-end justify-center pb-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                    >
                      {d}
                    </div>
                  ))}
                  {grid.map((cell, idx) => {
                    if (cell.dateISO == null) {
                      return <div key={`pad-${month}-${idx}`} className="aspect-square min-h-0" aria-hidden />;
                    }
                    const iso = cell.dateISO;
                    const inRange = !visibleRange || (iso >= visibleRange.from && iso <= visibleRange.to);
                    // Visualización: festivo empresa prevalece sobre vacaciones si coinciden.
                    const mark = holidaysByDate[iso] ?? vacationsByDate[iso];
                    const hasHoliday = Boolean(holidaysByDate[iso]);
                    const hasVacation = Boolean(vacationsByDate[iso]);
                    const wk = workDateIsWeekend(iso);
                    const dayNum = Number(iso.slice(8, 10));
                    const titleParts: string[] = [];
                    if (holidaysByDate[iso]) {
                      titleParts.push(labelCalendarioMarkKind(holidaysByDate[iso].kind));
                      if (holidaysByDate[iso].note) titleParts.push(holidaysByDate[iso].note);
                    }
                    if (vacationsByDate[iso]) {
                      titleParts.push(labelCalendarioMarkKind(vacationsByDate[iso].kind));
                      if (vacationsByDate[iso].note) titleParts.push(vacationsByDate[iso].note);
                    }
                    if (!holidaysByDate[iso] && !vacationsByDate[iso] && wk) {
                      titleParts.push("Fin de semana");
                    }
                    const cls = cellClasses({
                      mark,
                      isWeekend: wk,
                      isSelected: selected === iso,
                      canEdit: canEditHolidays || canEditVacations,
                      inRange,
                    });
                    const title = titleParts.length ? titleParts.join(" · ") : undefined;
                    if (canEditHolidays || canEditVacations) {
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => handlePickDay(iso)}
                          title={title}
                          className={cls}
                          disabled={!inRange}
                        >
                          <span className="leading-none">{dayNum}</span>
                          {(hasHoliday || hasVacation) && (
                            <span className="mt-1 flex items-center gap-1" aria-hidden>
                              {hasHoliday ? <span className="h-2 w-2 rounded-full bg-amber-500" /> : null}
                              {hasVacation ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : null}
                            </span>
                          )}
                        </button>
                      );
                    }
                    return (
                      <div key={iso} className={cls} title={title}>
                        <span className="leading-none">{dayNum}</span>
                        {(hasHoliday || hasVacation) && (
                          <span className="mt-1 flex items-center gap-1" aria-hidden>
                            {hasHoliday ? <span className="h-2 w-2 rounded-full bg-amber-500" /> : null}
                            {hasVacation ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : null}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {(canEditHolidays || canEditVacations) && selected && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-x-0 bottom-0 z-[120] px-3 pb-3 sm:px-6 sm:pb-6">
              <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-[0_18px_48px_-16px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5 sm:py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Día seleccionado
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                      <time dateTime={selected} className="tabular-nums">
                        {new Date(selected + "T12:00:00").toLocaleDateString("es-ES", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </time>
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Marca festivo y/o vacaciones. Las notas son opcionales.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    aria-label="Cerrar"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="max-h-[min(55vh,28rem)] overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 dark:border-amber-800/50 dark:bg-amber-950/25">
                      <p className="text-sm font-bold text-amber-950 dark:text-amber-50">Festivo (empresa)</p>
                      <label className="mt-3 block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-amber-900/70 dark:text-amber-100/70">
                          Nota (opcional)
                        </span>
                        <input
                          type="text"
                          value={holidayNoteDraft}
                          onChange={(e) => setHolidayNoteDraft(e.target.value)}
                          maxLength={120}
                          placeholder="Ej. Festividad local, cierre…"
                          disabled={!canEditHolidays}
                          className="mt-1.5 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-800/50 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>
                      <div className="mt-3.5 flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          disabled={!canEditHolidays}
                          onClick={() => applyHoliday("festivo")}
                          className="rounded-xl border border-amber-400/80 bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:bg-amber-900/35"
                        >
                          Marcar festivo
                        </button>
                        <button
                          type="button"
                          disabled={!canEditHolidays}
                          onClick={() => applyHoliday(null)}
                          className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-50 dark:hover:bg-slate-800"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-sky-200/70 bg-sky-50/70 p-4 dark:border-sky-800/50 dark:bg-sky-950/25">
                      <p className="text-sm font-bold text-sky-950 dark:text-sky-50">Vacaciones (usuario)</p>
                      <label className="mt-3 block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-sky-900/70 dark:text-sky-100/70">
                          Nota (opcional)
                        </span>
                        <input
                          type="text"
                          value={vacationNoteDraft}
                          onChange={(e) => setVacationNoteDraft(e.target.value)}
                          maxLength={120}
                          placeholder="Ej. Semana Santa, viaje…"
                          disabled={!canEditVacations}
                          className="mt-1.5 w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800/50 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </label>
                      <div className="mt-3.5 flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          disabled={!canEditVacations}
                          onClick={() => applyVacation("vacaciones")}
                          className="rounded-xl border border-sky-400/80 bg-sky-100 px-4 py-2.5 text-sm font-semibold text-sky-950 shadow-sm transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-50 dark:hover:bg-sky-900/35"
                        >
                          Marcar vacaciones
                        </button>
                        <button
                          type="button"
                          disabled={!canEditVacations}
                          onClick={() => applyVacation(null)}
                          className="rounded-xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-semibold text-sky-950 shadow-sm transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-50 dark:hover:bg-slate-800"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {!canEditHolidays && !canEditVacations && (
        <p className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 text-base text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
          Solo puedes <strong>consultar</strong> el calendario. Para añadir o cambiar festivos y vacaciones,
          contacta con administración.
        </p>
      )}
    </div>
  );
}
