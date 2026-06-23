"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  MODAL_BACKDROP_CENTER,
  MODAL_SURFACE_PAD,
  modalScrollablePanel,
} from "@/components/modalShell";
import type { CompanyHolidayDto } from "@/services/company-holidays.service";
import { formatDateEsWeekdayDdMmYyyy } from "@/shared/utils/time";

export type FestivosEmpresaResumenProps = {
  count: number;
  year: number;
  loading?: boolean;
  countInVisibleRange?: number | null;
  holidays?: CompanyHolidayDto[];
  visibleRange?: { from: string; to: string } | null;
};

export function FestivosEmpresaResumen({
  count,
  year,
  loading = false,
  countInVisibleRange = null,
  holidays = [],
  visibleRange = null,
}: FestivosEmpresaResumenProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const n = Math.max(0, Math.round(count));
  const enRango =
    countInVisibleRange != null ? Math.max(0, Math.round(countInVisibleRange)) : null;

  const listItems = useMemo(() => {
    let items = [...holidays];
    if (visibleRange) {
      items = items.filter((h) => h.date >= visibleRange.from && h.date <= visibleRange.to);
    }
    return items.sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays, visibleRange]);

  const canOpenList = !loading && n > 0;

  const closeModal = useCallback(() => setModalOpen(false), []);

  useEffect(() => {
    setModalOpen(false);
  }, [year]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal]);

  const modalTitle = visibleRange
    ? `Festivos ${year} (rango visible)`
    : `Festivos de empresa · ${year}`;

  const countLabel = loading
    ? "…"
    : n === 1
      ? "1 festivo"
      : `${n} festivos`;

  return (
    <>
      <button
        type="button"
        disabled={!canOpenList}
        onClick={() => canOpenList && setModalOpen(true)}
        className={`w-full rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2.5 text-left transition dark:border-amber-700/40 dark:bg-amber-950/20 ${
          canOpenList
            ? "cursor-pointer hover:border-amber-300 hover:bg-amber-50 dark:hover:border-amber-600/50 dark:hover:bg-amber-950/30"
            : "cursor-default"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-amber-950/80 dark:text-amber-100/85">
            Festivos de empresa
          </span>
          <span className="text-[10px] tabular-nums text-amber-800/65 dark:text-amber-200/60">
            {year}
          </span>
        </div>

        <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-amber-950 dark:text-amber-50">
          {countLabel}
        </p>

        {!loading && n === 0 ? (
          <p className="mt-1 text-[11px] text-amber-800/70 dark:text-amber-200/65">
            Ninguno registrado este año
          </p>
        ) : canOpenList ? (
          <p className="mt-1 text-[11px] text-amber-800/75 underline-offset-2 hover:underline dark:text-amber-200/70">
            Ver lista
          </p>
        ) : loading ? (
          <p className="mt-1 text-[11px] text-amber-800/70 dark:text-amber-200/65">Cargando…</p>
        ) : null}

        {enRango != null && !loading && n > 0 ? (
          <p className="mt-1 text-[10px] text-amber-800/60 dark:text-amber-200/55">
            {enRango} en el rango visible
          </p>
        ) : null}
      </button>

      {modalOpen && canOpenList && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`fixed inset-0 z-[100] ${MODAL_BACKDROP_CENTER}`}
              onClick={closeModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="festivos-empresa-list-title"
            >
              <div
                className={modalScrollablePanel("md", { className: "flex flex-col" })}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200/90 px-4 py-3 dark:border-slate-600">
                  <div className="min-w-0">
                    <h2
                      id="festivos-empresa-list-title"
                      className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                    >
                      {modalTitle}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {listItems.length === 1 ? "1 día" : `${listItems.length} días`}
                      {visibleRange ? (
                        <>
                          {" "}
                          · {visibleRange.from} → {visibleRange.to}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="shrink-0 text-xs font-medium text-slate-600 underline-offset-2 hover:underline dark:text-slate-300"
                    aria-label="Cerrar"
                  >
                    Cerrar
                  </button>
                </div>

                <ul
                  className={`${MODAL_SURFACE_PAD} max-h-[min(60vh,420px)] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700/80`}
                >
                  {listItems.map((h) => (
                    <li key={h.id} className="py-2.5 first:pt-0 last:pb-0">
                      <p className="text-sm tabular-nums text-slate-800 dark:text-slate-200">
                        {formatDateEsWeekdayDdMmYyyy(h.date)}
                      </p>
                      <p className="mt-0.5 text-sm text-amber-950 dark:text-amber-100">{h.name}</p>
                      {h.notes?.trim() ? (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{h.notes}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
