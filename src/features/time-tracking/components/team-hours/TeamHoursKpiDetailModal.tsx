"use client";

import { useEffect } from "react";
import { MODAL_BACKDROP_CENTER, MODAL_SURFACE } from "@/components/modalShell";
import type { TeamHoursKpiDetailKind } from "@/features/time-tracking/utils/teamHoursKpiDetail";

const META: Record<
  TeamHoursKpiDetailKind,
  { kicker: string; title: string; emptyHint: string }
> = {
  haFichado: {
    kicker: "DETALLE",
    title: "Han fichado",
    emptyHint: "No hay jornadas en esta categoría para el periodo y filtros actuales.",
  },
  sinFichar: {
    kicker: "DETALLE",
    title: "Sin fichar",
    emptyHint: "No hay días sin fichaje imputable en este periodo.",
  },
  vacaciones: {
    kicker: "DETALLE",
    title: "Vacaciones",
    emptyHint: "No hay registros marcados como vacaciones en este periodo.",
  },
  sinParte: {
    kicker: "DETALLE",
    title: "Sin parte en servidor",
    emptyHint: "No hay jornadas cerradas sin parte de trabajo en servidor en este periodo.",
  },
  horasImputadas: {
    kicker: "DETALLE",
    title: "Horas imputadas",
    emptyHint: "No hay jornadas con horas imputadas en este periodo.",
  },
  jornadasFichadas: {
    kicker: "DETALLE",
    title: "Jornadas fichadas",
    emptyHint: "No hay jornadas fichadas en este periodo para los filtros actuales.",
  },
  partesCompletados: {
    kicker: "DETALLE",
    title: "Partes completados",
    emptyHint: "No hay jornadas cerradas con parte de trabajo en servidor en este periodo.",
  },
  sinImputarMetric: {
    kicker: "DETALLE",
    title: "Sin imputar",
    emptyHint: "No hay días sin imputar en este periodo.",
  },
};

export type TeamHoursKpiDetailModalProps = {
  open: boolean;
  onClose: () => void;
  variant: TeamHoursKpiDetailKind | null;
  /** Texto del periodo (misma línea que la barra KPI). */
  periodoEtiqueta: string;
  rows: { nombre: string; fechaLabel: string; detalle?: string }[];
};

export function TeamHoursKpiDetailModal({
  open,
  onClose,
  variant,
  periodoEtiqueta,
  rows,
}: TeamHoursKpiDetailModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !variant) return null;

  const meta = META[variant];

  return (
    <div
      className={`fixed inset-0 z-[100] ${MODAL_BACKDROP_CENTER}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-hours-kpi-detail-title"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className={`my-auto flex max-h-[min(90vh,880px)] w-full max-w-md flex-col overflow-hidden ${MODAL_SURFACE}`}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200/90 px-4 pb-3 pt-4 dark:border-slate-600/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300/90">
                {meta.kicker}
              </p>
              <h2
                id="team-hours-kpi-detail-title"
                className="mt-1 text-lg font-bold tracking-tight text-slate-900 dark:text-white"
              >
                {meta.title}
              </h2>
              <p className="mt-1 text-sm leading-snug text-slate-500 dark:text-slate-400">
                {periodoEtiqueta.trim()
                  ? `${periodoEtiqueta.trim()} · Solo lectura.`
                  : "Solo lectura · Personas y día según filtros actuales."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              {meta.emptyHint}
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r, i) => (
                <li
                  key={`${r.nombre}-${r.fechaLabel}-${i}`}
                  className="rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/50"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{r.nombre}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{r.fechaLabel}</p>
                  {r.detalle ? (
                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">{r.detalle}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
