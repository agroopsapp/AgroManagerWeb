"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  MODAL_BACKDROP_CENTER,
  MODAL_SURFACE_PAD,
  modalScrollablePanel,
} from "@/components/modalShell";
import type { CompanyVacationAllowanceDto } from "@/services/company-vacation-allowances.service";

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;
const DAYS_MIN = 0;
const DAYS_MAX = 366;

type EditingRow = CompanyVacationAllowanceDto | null;

export type CupoVacacionesResumenProps = {
  /** Año actualmente visible en el calendario, usado para destacar el cupo. */
  year: number;
  allowances: CompanyVacationAllowanceDto[];
  loading: boolean;
  saving: boolean;
  /** Solo admin-like puede crear / editar / borrar. */
  canMutate: boolean;
  error?: string | null;
  onCreate: (body: { year: number; daysAllowed: number }) => Promise<unknown>;
  onUpdate: (id: string, daysAllowed: number) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onClearError?: () => void;
};

export function CupoVacacionesResumen({
  year,
  allowances,
  loading,
  saving,
  canMutate,
  error = null,
  onCreate,
  onUpdate,
  onDelete,
  onClearError,
}: CupoVacacionesResumenProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<EditingRow>(null);
  const [formYear, setFormYear] = useState<string>(String(year));
  const [formDays, setFormDays] = useState<string>("22");
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currentYearAllowance = useMemo(
    () => allowances.find((a) => a.year === year) ?? null,
    [allowances, year],
  );

  const sortedAllowances = useMemo(
    () => [...allowances].sort((a, b) => b.year - a.year),
    [allowances],
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingRow(null);
    setFormError(null);
    onClearError?.();
  }, [onClearError]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal]);

  const openCreateForm = () => {
    setEditingRow(null);
    setFormYear(String(year));
    setFormDays(String(currentYearAllowance?.daysAllowed ?? 22));
    setFormError(null);
    onClearError?.();
  };

  const openEditForm = (row: CompanyVacationAllowanceDto) => {
    setEditingRow(row);
    setFormYear(String(row.year));
    setFormDays(String(row.daysAllowed));
    setFormError(null);
    onClearError?.();
  };

  const cancelForm = () => {
    setEditingRow(null);
    setFormError(null);
  };

  const validate = (): { year: number; daysAllowed: number } | null => {
    const y = Number(formYear);
    const d = Number(formDays);
    if (!Number.isInteger(y) || y < YEAR_MIN || y > YEAR_MAX) {
      setFormError(`El año debe estar entre ${YEAR_MIN} y ${YEAR_MAX}.`);
      return null;
    }
    if (!Number.isFinite(d) || d < DAYS_MIN || d > DAYS_MAX) {
      setFormError(`Los días deben estar entre ${DAYS_MIN} y ${DAYS_MAX}.`);
      return null;
    }
    return { year: y, daysAllowed: Math.trunc(d) };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate || saving) return;
    const parsed = validate();
    if (!parsed) return;
    setFormError(null);
    try {
      if (editingRow) {
        await onUpdate(editingRow.id, parsed.daysAllowed);
        setEditingRow(null);
      } else {
        await onCreate({ year: parsed.year, daysAllowed: parsed.daysAllowed });
        setEditingRow(null);
        setFormYear(String(year));
      }
    } catch {
      // El error de servidor lo expone el hook (`error`). No relanzamos aquí.
    }
  };

  const handleDelete = async (row: CompanyVacationAllowanceDto) => {
    if (!canMutate || saving) return;
    setDeletingId(row.id);
    try {
      await onDelete(row.id);
    } catch {
      // Mismo criterio: error visible vía `error`.
    } finally {
      setDeletingId(null);
    }
  };

  const cupoActualLabel = loading
    ? "…"
    : currentYearAllowance
      ? `${currentYearAllowance.daysAllowed} días`
      : "Sin cupo";

  const canOpen = !loading;

  return (
    <>
      <button
        type="button"
        disabled={!canOpen}
        onClick={() => canOpen && setModalOpen(true)}
        className={`w-full rounded-lg border border-sky-200/70 bg-sky-50/50 px-3 py-2.5 text-left transition dark:border-sky-700/40 dark:bg-sky-950/20 ${
          canOpen
            ? "cursor-pointer hover:border-sky-300 hover:bg-sky-50 dark:hover:border-sky-600/50 dark:hover:bg-sky-950/30"
            : "cursor-default"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-sky-950/85 dark:text-sky-100/85">
            Cupo anual de vacaciones
          </span>
          <span className="text-[10px] tabular-nums text-sky-800/65 dark:text-sky-200/60">
            {year}
          </span>
        </div>

        <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-sky-950 dark:text-sky-50">
          {cupoActualLabel}
        </p>

        {!loading && !currentYearAllowance ? (
          <p className="mt-1 text-[11px] text-sky-800/75 dark:text-sky-200/65">
            {canMutate ? "Pulsa para crearlo" : "No hay cupo definido"}
          </p>
        ) : !loading ? (
          <p className="mt-1 text-[11px] text-sky-800/75 underline-offset-2 hover:underline dark:text-sky-200/70">
            {canMutate ? "Gestionar cupos" : "Ver cupos"}
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-sky-800/70 dark:text-sky-200/65">Cargando…</p>
        )}
      </button>

      {modalOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`fixed inset-0 z-[100] ${MODAL_BACKDROP_CENTER}`}
              onClick={closeModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cupo-vacaciones-title"
            >
              <div
                className={modalScrollablePanel("lg", { className: "flex flex-col" })}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200/90 px-4 py-3 dark:border-slate-600">
                  <div className="min-w-0">
                    <h2
                      id="cupo-vacaciones-title"
                      className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                    >
                      Cupo anual de vacaciones
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {canMutate
                        ? "Define cuántos días puede gastar cada empleado por año natural."
                        : "Días concedidos por año natural en tu empresa (solo consulta)."}
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

                <div className={`${MODAL_SURFACE_PAD} overflow-y-auto`}>
                  {error ? (
                    <div
                      role="alert"
                      className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
                    >
                      {error}
                    </div>
                  ) : null}

                  {canMutate ? (
                    <form
                      onSubmit={handleSubmit}
                      className="mb-4 grid grid-cols-1 gap-2 rounded-md border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-700/70 dark:bg-slate-900/40 sm:grid-cols-[6rem_6rem_1fr_auto]"
                    >
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Año
                        </span>
                        <input
                          type="number"
                          min={YEAR_MIN}
                          max={YEAR_MAX}
                          step={1}
                          value={formYear}
                          onChange={(e) => setFormYear(e.target.value)}
                          disabled={Boolean(editingRow) || saving}
                          required
                          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Días
                        </span>
                        <input
                          type="number"
                          min={DAYS_MIN}
                          max={DAYS_MAX}
                          step={1}
                          value={formDays}
                          onChange={(e) => setFormDays(e.target.value)}
                          required
                          disabled={saving}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </label>
                      <div className="flex flex-col justify-end">
                        {formError ? (
                          <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
                            {formError}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {editingRow
                              ? `Editando cupo del ${editingRow.year}. El año no se puede cambiar.`
                              : "Crea un cupo para un año nuevo. Si ya existe, edítalo desde la lista."}
                          </p>
                        )}
                      </div>
                      <div className="flex items-end gap-2">
                        {editingRow ? (
                          <button
                            type="button"
                            onClick={cancelForm}
                            disabled={saving}
                            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Cancelar
                          </button>
                        ) : null}
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-400"
                        >
                          {saving
                            ? "Guardando…"
                            : editingRow
                              ? "Guardar cambios"
                              : "Crear cupo"}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <div className="overflow-x-auto rounded-md border border-slate-200/80 dark:border-slate-700/70">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Año</th>
                          <th className="px-3 py-2 font-semibold">Días</th>
                          <th className="px-3 py-2 text-right font-semibold">
                            {canMutate ? "Acciones" : ""}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                        {loading ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400"
                            >
                              Cargando cupos…
                            </td>
                          </tr>
                        ) : sortedAllowances.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400"
                            >
                              No hay cupos definidos.
                            </td>
                          </tr>
                        ) : (
                          sortedAllowances.map((row) => {
                            const isCurrent = row.year === year;
                            return (
                              <tr
                                key={row.id}
                                className={
                                  isCurrent
                                    ? "bg-sky-50/40 dark:bg-sky-950/20"
                                    : undefined
                                }
                              >
                                <td className="px-3 py-2 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                                  {row.year}
                                  {isCurrent ? (
                                    <span className="ml-2 rounded-full bg-sky-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-sky-900 dark:bg-sky-900/50 dark:text-sky-100">
                                      Año visible
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">
                                  {row.daysAllowed} días
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {canMutate ? (
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => openEditForm(row)}
                                        disabled={saving}
                                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(row)}
                                        disabled={saving}
                                        className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60"
                                      >
                                        {deletingId === row.id ? "Eliminando…" : "Eliminar"}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {!canMutate ? (
                    <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                      Solo Manager, Admin o SuperAdmin pueden crear, editar o borrar el cupo.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
