"use client";

import { SignaturePadDialog } from "@/components/SignaturePadDialog";
import { MODAL_BACKDROP_CENTER, modalScrollablePanel } from "@/components/modalShell";
import type { TimeEntryMock } from "@/features/time-tracking/types";
import { effectiveWorkMinutesEntry } from "@/features/time-tracking/utils/formatters";
import { type WorkPartRecord } from "@/lib/workPartsStorage";
import { formatDateES, formatMinutesShort, formatTimeLocal } from "@/shared/utils/time";
import { type Company, type WorkService } from "@/types";
import { workerNameById } from "@/mocks/time-tracking.mock";

type EquipoPartLine = {
  lineId: string;
  companyId: string;
  serviceId: string;
  areaId: string;
};

interface EquipoPartModalProps {
  modal: {
    workerId: number;
    workDate: string;
    entry: TimeEntryMock;
    existing: WorkPartRecord | null;
  };
  companies: Company[];
  services: WorkService[];
  lines: EquipoPartLine[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  signatureDialogOpen: boolean;
  signatureTemp: string | null;
  pdfLoading: boolean;
  onClose: () => void;
  onAddLine: () => void;
  onPatchLine: (lineId: string, patch: Partial<Omit<EquipoPartLine, "lineId">>) => void;
  onRemoveLine: (lineId: string) => void;
  onSave: () => void;
  onSetSignatureDialogOpen: (v: boolean) => void;
  onSetSignatureTemp: (v: string | null) => void;
  onSetError: (e: string | null) => void;
  onGeneratePdf: () => Promise<void>;
}

export function EquipoPartModal({
  modal,
  companies,
  services,
  lines,
  loading,
  saving,
  error,
  signatureDialogOpen,
  signatureTemp,
  pdfLoading,
  onClose,
  onAddLine,
  onPatchLine,
  onRemoveLine,
  onSave,
  onSetSignatureDialogOpen,
  onSetSignatureTemp,
  onSetError: _onSetError,
  onGeneratePdf,
}: EquipoPartModalProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-[110] ${MODAL_BACKDROP_CENTER}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipo-part-title"
        onClick={(ev) => {
          if (ev.target === ev.currentTarget) onClose();
        }}
        onKeyDown={(ev) => {
          if (ev.key === "Escape") onClose();
        }}
      >
        <div
          className={modalScrollablePanel("xl")}
          onClick={(ev) => ev.stopPropagation()}
        >
          <h2
            id="equipo-part-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-50"
          >
            Parte del {formatDateES(modal.workDate)}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {workerNameById(modal.workerId)} · Edita solo tareas y firma (horas en solo
            lectura).
          </p>

          <div className="mt-3 space-y-1 rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Fichaje (solo lectura)
            </p>
            <p>
              Entrada:{" "}
              <span className="font-semibold">
                {formatTimeLocal(modal.entry.checkInUtc)}
              </span>{" "}
              · Salida:{" "}
              <span className="font-semibold">
                {formatTimeLocal(modal.entry.checkOutUtc)}
              </span>
            </p>
            <p>
              Descanso:{" "}
              <span className="font-semibold">
                {formatMinutesShort(modal.entry.breakMinutes ?? 0)}
              </span>{" "}
              · Total trabajado:{" "}
              <span className="font-semibold">
                {formatMinutesShort(effectiveWorkMinutesEntry(modal.entry))}
              </span>
            </p>
          </div>

          {loading ? (
            <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
              Cargando empresas y servicios…
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 dark:border-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Tareas
                </p>
                <button
                  type="button"
                  onClick={onAddLine}
                  disabled={services.length === 0 || companies.length === 0}
                  className="w-full rounded-lg border-2 border-agro-600 bg-agro-50 px-3 py-2 text-xs font-semibold text-agro-800 hover:bg-agro-100 disabled:opacity-40 dark:border-agro-500 dark:bg-agro-950/40 dark:text-agro-200 sm:w-auto"
                >
                  + Añadir tarea
                </button>
              </div>
              <ul className="space-y-3">
                {lines.map((line, idx) => {
                  const lineCompany = companies.find((c) => c.id === line.companyId);
                  return (
                    <li
                      key={line.lineId}
                      className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/40"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Tarea {idx + 1}
                        </span>
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onRemoveLine(line.lineId)}
                            className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label
                            htmlFor={`eqp-co-${line.lineId}`}
                            className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
                          >
                            Empresa
                          </label>
                          <select
                            id={`eqp-co-${line.lineId}`}
                            value={line.companyId}
                            onChange={(e) => {
                              const id = e.target.value;
                              const c = companies.find((x) => x.id === id);
                              onPatchLine(line.lineId, {
                                companyId: id,
                                areaId: c?.areas[0]?.id ?? "",
                              });
                            }}
                            disabled={companies.length === 0}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {companies.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          {lineCompany && lineCompany.areas.length === 0 && (
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                              Esta empresa no tiene áreas. Configúralas en Empresas → Editar.
                            </p>
                          )}
                        </div>
                        <div className="sm:col-span-1">
                          <label
                            htmlFor={`eqp-svc-${line.lineId}`}
                            className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
                          >
                            Servicio
                          </label>
                          <select
                            id={`eqp-svc-${line.lineId}`}
                            value={line.serviceId}
                            onChange={(e) =>
                              onPatchLine(line.lineId, { serviceId: e.target.value })
                            }
                            disabled={services.length === 0}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {services.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-1">
                          <label
                            htmlFor={`eqp-area-${line.lineId}`}
                            className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
                          >
                            Área
                          </label>
                          <select
                            id={`eqp-area-${line.lineId}`}
                            value={line.areaId}
                            onChange={(e) =>
                              onPatchLine(line.lineId, { areaId: e.target.value })
                            }
                            disabled={!lineCompany || lineCompany.areas.length === 0}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {(lineCompany?.areas ?? []).map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                                {a.observations
                                  ? ` — ${a.observations.slice(0, 28)}${a.observations.length > 28 ? "…" : ""}`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {signatureTemp ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/40">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Firma
              </p>
              <img
                src={signatureTemp}
                alt="Firma guardada"
                className="mt-2 max-h-24 rounded-lg border border-slate-200 bg-white dark:border-slate-600"
              />
            </div>
          ) : null}

          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-600">
            <div className="mr-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSetSignatureDialogOpen(true)}
                className="rounded-lg border border-slate-400 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Firmar
              </button>
              <button
                type="button"
                disabled={loading || pdfLoading}
                onClick={onGeneratePdf}
                className="rounded-lg border border-agro-600 bg-white px-3 py-2 text-xs font-semibold text-agro-800 hover:bg-agro-50 disabled:opacity-50 dark:border-agro-500 dark:bg-slate-800 dark:text-agro-200 dark:hover:bg-agro-900/30"
              >
                {pdfLoading ? "Generando PDF…" : "Descargar PDF"}
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={loading || saving || companies.length === 0 || services.length === 0}
              onClick={onSave}
              className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white hover:bg-agro-700 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar parte"}
            </button>
          </div>
        </div>
      </div>

      <SignaturePadDialog
        open={signatureDialogOpen}
        title="Firma del parte"
        initialDataUrl={signatureTemp}
        onClose={() => onSetSignatureDialogOpen(false)}
        onSave={(pngDataUrl) => {
          onSetSignatureTemp(pngDataUrl);
          onSetSignatureDialogOpen(false);
        }}
      />
    </>
  );
}
