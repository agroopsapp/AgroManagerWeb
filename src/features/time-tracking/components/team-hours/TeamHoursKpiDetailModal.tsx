"use client";

import { useEffect, useMemo, useState } from "react";
import { DatePickerPopoverField } from "@/components/DatePickerPopoverField";
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
  bajas: {
    kicker: "DETALLE",
    title: "Bajas",
    emptyHint: "No hay registros marcados como baja en este periodo.",
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
  rows: {
    rowKey: string;
    nombre: string;
    /** YYYY-MM-DD para filtro por día */
    fechaIso: string;
    fechaLabel: string;
    detalle?: string;
    detailLines: { label: string; value: string }[];
  }[];
};

export function TeamHoursKpiDetailModal({
  open,
  onClose,
  variant,
  periodoEtiqueta,
  rows,
}: TeamHoursKpiDetailModalProps) {
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const [filterNombre, setFilterNombre] = useState("");
  const [filterFechaIso, setFilterFechaIso] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setExpandedRowKey(null);
      setFilterNombre("");
      setFilterFechaIso("");
      return;
    }
    setFilterNombre("");
    setFilterFechaIso("");
    setExpandedRowKey(null);
  }, [open, variant]);

  const uniqueNombres = useMemo(() => {
    const s = new Set(rows.map((r) => r.nombre));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterNombre && r.nombre !== filterNombre) return false;
      if (filterFechaIso && r.fechaIso !== filterFechaIso) return false;
      return true;
    });
  }, [rows, filterNombre, filterFechaIso]);

  useEffect(() => {
    if (!expandedRowKey) return;
    if (!filteredRows.some((r) => r.rowKey === expandedRowKey)) {
      setExpandedRowKey(null);
    }
  }, [filteredRows, expandedRowKey]);

  const filtrosActivos = Boolean(filterNombre || filterFechaIso);

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

        {rows.length > 0 ? (
          <div className="shrink-0 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-600/50 dark:bg-slate-900/40">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Persona
                </span>
                <select
                  value={filterNombre}
                  onChange={(e) => setFilterNombre(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">Todas</option>
                  {uniqueNombres.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Fecha
                </span>
                <DatePickerPopoverField
                  value={filterFechaIso}
                  onChange={setFilterFechaIso}
                  emptyLabel="Todas las fechas"
                  allowClear
                />
              </label>
            </div>
            {filtrosActivos ? (
              <button
                type="button"
                onClick={() => {
                  setFilterNombre("");
                  setFilterFechaIso("");
                }}
                className="mt-3 text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
              >
                Quitar filtros
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              {meta.emptyHint}
            </p>
          ) : filteredRows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/80 px-4 py-6 text-center text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/35 dark:text-amber-100">
              Ningún resultado con los filtros aplicados. Prueba otra persona o fecha, o quita filtros.
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredRows.map((r) => {
                const expanded = expandedRowKey === r.rowKey;
                const hasDetail = r.detailLines.length > 0;
                return (
                  <li
                    key={r.rowKey}
                    className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/50"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedRowKey((k) => (k === r.rowKey ? null : r.rowKey))
                      }
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
                      aria-expanded={hasDetail ? expanded : undefined}
                      disabled={!hasDetail}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {r.nombre}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{r.fechaLabel}</p>
                        {r.detalle ? (
                          <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {r.detalle}
                          </p>
                        ) : null}
                        {hasDetail ? (
                          <p className="mt-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                            {expanded ? "Ocultar detalle" : "Ver detalle del día"}
                          </p>
                        ) : null}
                      </div>
                      {hasDetail ? (
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-500 shadow-sm transition dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 ${expanded ? "rotate-180" : ""}`}
                          aria-hidden
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            className="h-4 w-4"
                          >
                            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      ) : null}
                    </button>
                    {expanded && hasDetail ? (
                      <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-3 py-3 dark:border-slate-700 dark:from-slate-950/40 dark:to-slate-900/40">
                        <div className="border-l-2 border-emerald-500 pl-3">
                          <dl className="space-y-2.5">
                            {r.detailLines.map((line, idx) => (
                              <div key={`${line.label}-${idx}`}>
                                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  {line.label}
                                </dt>
                                <dd className="mt-0.5 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                                  {line.value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
