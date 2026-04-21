"use client";

import { useCallback, useEffect, useState } from "react";
import { useFlashSuccess } from "@/contexts/FlashSuccessContext";
import { SignaturePadDialog } from "@/components/SignaturePadDialog";
import { MODAL_BACKDROP_CENTER, modalScrollablePanel } from "@/components/modalShell";
import { customerCompanyMock } from "@/lib/customerCompanyMock";
import { downloadWorkPartPdf } from "@/lib/workPartPdf";
import {
  getTasksFromRecord,
  getWorkPartsForWorker,
  updateWorkPartSignature,
  updateWorkPartTasks,
  type WorkPartRecord,
  type WorkPartTask,
} from "@/lib/workPartsStorage";
import { workServicesMock } from "@/lib/workServicesMock";
import type { Company, WorkService } from "@/types";
import {
  DEFAULT_STANDARD_WORKDAY_MINUTES,
  splitWorkedMinutesOrdinaryAndExtra,
} from "@/features/time-tracking/utils/formatters";

type Line = { lineId: string; companyId: string; serviceId: string; areaId: string };

function newLineId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatWorkDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMinutesShort(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 min";
  const h = Math.floor(totalMinutes / 60);
  const min = totalMinutes % 60;
  if (h === 0) return `${min} min`;
  if (min === 0) return `${h} h`;
  return `${h} h ${min} min`;
}

function tasksToLines(tasks: WorkPartTask[]): Line[] {
  return tasks.map((t) => ({
    lineId: newLineId(),
    companyId: t.companyId,
    serviceId: t.serviceId,
    areaId: t.areaId,
  }));
}

export function WorkPartsSavedPanel({
  workerId,
  workerDisplayName,
}: {
  workerId: number;
  /** Nombre para el PDF y cabeceras (opcional). */
  workerDisplayName?: string;
}) {
  const { showSuccess } = useFlashSuccess();
  const [parts, setParts] = useState<WorkPartRecord[]>([]);
  const [editing, setEditing] = useState<WorkPartRecord | null>(null);
  const [editCompanies, setEditCompanies] = useState<Company[]>([]);
  const [editServices, setEditServices] = useState<WorkService[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editLines, setEditLines] = useState<Line[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const refresh = useCallback(() => {
    setParts(getWorkPartsForWorker(workerId));
  }, [workerId]);

  useEffect(() => {
    refresh();
    const fn = () => refresh();
    window.addEventListener("agromanager-workparts-changed", fn);
    return () => window.removeEventListener("agromanager-workparts-changed", fn);
  }, [refresh]);

  const openEditor = (record: WorkPartRecord) => {
    setEditing(record);
    setEditError(null);
    const tasks = getTasksFromRecord(record);
    setEditLines(
      tasks.length > 0
        ? tasksToLines(tasks)
        : [{ lineId: newLineId(), companyId: "", serviceId: "", areaId: "" }]
    );
    setEditLoading(true);
    (async () => {
      try {
        const [c, s] = await Promise.all([
          customerCompanyMock.getAll(),
          workServicesMock.getAll(),
        ]);
        setEditCompanies(c);
        setEditServices(s);
      } catch {
        setEditError("No se pudieron cargar empresas o servicios.");
        setEditCompanies([]);
        setEditServices([]);
      } finally {
        setEditLoading(false);
      }
    })();
  };

  useEffect(() => {
    if (!editing || editCompanies.length === 0) return;
    setEditLines((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((l) => {
        const valid = editCompanies.find((x) => x.id === l.companyId);
        const c = valid ?? editCompanies[0];
        const areaId =
          l.areaId && c.areas.some((a) => a.id === l.areaId)
            ? l.areaId
            : c.areas[0]?.id ?? "";
        return { ...l, companyId: c.id, areaId };
      });
    });
  }, [editing?.id, editCompanies]);

  useEffect(() => {
    if (!editing || editServices.length === 0) return;
    setEditLines((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((l) => ({
        ...l,
        serviceId:
          l.serviceId && editServices.some((s) => s.id === l.serviceId)
            ? l.serviceId
            : editServices[0].id,
      }));
    });
  }, [editing?.id, editServices]);

  useEffect(() => {
    if (!editing || editLoading) return;
    if (editCompanies.length === 0 || editServices.length === 0) return;
    setEditLines((prev) => {
      if (prev.length > 0) return prev;
      const c = editCompanies[0];
      return [
        {
          lineId: newLineId(),
          companyId: c?.id ?? "",
          serviceId: editServices[0]?.id ?? "",
          areaId: c?.areas[0]?.id ?? "",
        },
      ];
    });
  }, [editing?.id, editLoading, editCompanies, editServices]);

  const addLine = () => {
    setEditLines((prev) => {
      const last = prev[prev.length - 1];
      const fallback = editCompanies[0];
      const cid =
        last && editCompanies.some((x) => x.id === last.companyId)
          ? last.companyId
          : fallback?.id ?? "";
      const c = editCompanies.find((x) => x.id === cid) ?? fallback;
      return [
        ...prev,
        {
          lineId: newLineId(),
          companyId: cid,
          serviceId: editServices[0]?.id ?? "",
          areaId: c?.areas[0]?.id ?? "",
        },
      ];
    });
  };

  const removeLine = (lineId: string) => {
    setEditLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.lineId !== lineId)));
  };

  const patchLine = (
    lineId: string,
    patch: Partial<{ companyId: string; serviceId: string; areaId: string }>
  ) => {
    setEditLines((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l))
    );
  };

  const buildTasksFromLines = (): WorkPartTask[] | null => {
    if (!editing) return null;
    const tasks: WorkPartTask[] = [];
    for (const line of editLines) {
      const company = editCompanies.find((c) => c.id === line.companyId);
      if (!company) return null;
      if (!company.areas.length) return null;
      const svc = editServices.find((s) => s.id === line.serviceId);
      const ar = company.areas.find((a) => a.id === line.areaId);
      if (!svc || !ar) return null;
      tasks.push({
        companyId: company.id,
        companyName: company.name,
        serviceId: svc.id,
        serviceName: svc.name,
        areaId: ar.id,
        areaName: ar.name,
        areaObservations: ar.observations ?? "",
      });
    }
    return tasks;
  };

  const saveEdit = () => {
    if (!editing) return;
    const tasks = buildTasksFromLines();
    if (!tasks || tasks.length === 0) {
      setEditError("Revisa cada fila: empresa con área, servicio y área elegidos.");
      return;
    }
    setEditError(null);
    setEditSaving(true);
    try {
      const ok = updateWorkPartTasks(editing.id, tasks);
      if (!ok) {
        setEditError("No se pudo guardar el parte.");
        return;
      }
      setEditing(null);
      refresh();
      showSuccess("Parte local guardado correctamente.");
    } finally {
      setEditSaving(false);
    }
  };

  const editBlocked =
    editLines.length === 0 ||
    editLines.some((line) => {
      const c = editCompanies.find((x) => x.id === line.companyId);
      return (
        !c ||
        c.areas.length === 0 ||
        !line.areaId ||
        !editServices.some((s) => s.id === line.serviceId)
      );
    });

  if (parts.length === 0) {
    return (
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800/90 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Partes de trabajo guardados
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Cuando fichés la salida y guardes un parte, aparecerá aquí para consultarlo o corregir las
          tareas.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800/90 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Partes de trabajo guardados
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
          Tus partes recientes
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Puedes ver el resumen del fichaje y editar únicamente las tareas (empresa, servicio y
          área).
        </p>
        <ul className="mt-3 space-y-2">
          {parts.map((p) => {
            const n = getTasksFromRecord(p).length;
            return (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-slate-900 dark:text-slate-50">
                    {formatWorkDateLabel(p.workDate)}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {p.entradaDisplay} – {p.salidaDisplay} · Descanso{" "}
                    {formatMinutesShort(p.breakMinutes)} · Trabajado{" "}
                    {formatMinutesShort(p.workedMinutes)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {n === 1 ? "1 tarea" : `${n} tareas`}
                    {p.companyName ? ` · ${p.companyName}` : ""}
                    {p.signaturePngDataUrl ? " · Firma guardada" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openEditor(p)}
                  className="shrink-0 rounded-lg border border-agro-600 px-3 py-2 text-xs font-semibold text-agro-800 hover:bg-agro-50 dark:border-agro-500 dark:text-agro-200 dark:hover:bg-agro-950/50"
                >
                  Ver / editar tareas
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {editing && (
        <div className={`fixed inset-0 z-[60] ${MODAL_BACKDROP_CENTER}`}>
          <div
            className={modalScrollablePanel("xl")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="work-part-edit-title"
          >
            <h2
              id="work-part-edit-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-50"
            >
              Parte del {formatWorkDateLabel(editing.workDate)}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Horas y fecha del fichaje no se pueden cambiar aquí; solo las tareas imputadas.
            </p>

            <div className="mt-3 space-y-1 rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Fichaje (solo lectura)
              </p>
              <p>
                Entrada: <span className="font-semibold">{editing.entradaDisplay}</span> · Salida:{" "}
                <span className="font-semibold">{editing.salidaDisplay}</span>
              </p>
              <p>
                Descanso:{" "}
                <span className="font-semibold">{formatMinutesShort(editing.breakMinutes)}</span>
              </p>
              {(() => {
                const { ordinary, extra, total } = splitWorkedMinutesOrdinaryAndExtra(
                  editing.workedMinutes,
                  DEFAULT_STANDARD_WORKDAY_MINUTES,
                );
                const topeH = DEFAULT_STANDARD_WORKDAY_MINUTES / 60;
                return (
                  <div className="mt-1 space-y-0.5 border-t border-slate-200/80 pt-1.5 dark:border-slate-600/80">
                    <p>
                      Jornada ordinaria{" "}
                      <span className="text-slate-500 dark:text-slate-400">(tope {topeH} h)</span>:{" "}
                      <span className="font-semibold">{formatMinutesShort(ordinary)}</span>
                    </p>
                    <p>
                      Horas extra:{" "}
                      <span className="font-semibold">{formatMinutesShort(extra)}</span>
                    </p>
                    <p>
                      Total trabajado:{" "}
                      <span className="font-semibold">{formatMinutesShort(total)}</span>
                    </p>
                  </div>
                );
              })()}
            </div>

            {editLoading ? (
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
                    onClick={addLine}
                    disabled={editServices.length === 0 || editCompanies.length === 0}
                    className="w-full rounded-lg border-2 border-agro-600 bg-agro-50 px-3 py-2 text-xs font-semibold text-agro-800 hover:bg-agro-100 disabled:opacity-40 dark:border-agro-500 dark:bg-agro-950/40 dark:text-agro-200 sm:w-auto"
                  >
                    + Añadir tarea
                  </button>
                </div>
                <ul className="space-y-3">
                  {editLines.map((line, idx) => {
                    const lineCompany = editCompanies.find((c) => c.id === line.companyId);
                    return (
                      <li
                        key={line.lineId}
                        className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/40"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            Tarea {idx + 1}
                          </span>
                          {editLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLine(line.lineId)}
                              className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label
                              htmlFor={`edit-co-${line.lineId}`}
                              className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
                            >
                              Empresa
                            </label>
                            <select
                              id={`edit-co-${line.lineId}`}
                              value={line.companyId}
                              onChange={(e) => {
                                const id = e.target.value;
                                const c = editCompanies.find((x) => x.id === id);
                                patchLine(line.lineId, {
                                  companyId: id,
                                  areaId: c?.areas[0]?.id ?? "",
                                });
                              }}
                              disabled={editCompanies.length === 0}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            >
                              {editCompanies.map((c) => (
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
                              htmlFor={`edit-svc-${line.lineId}`}
                              className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
                            >
                              Servicio
                            </label>
                            <select
                              id={`edit-svc-${line.lineId}`}
                              value={line.serviceId}
                              onChange={(e) =>
                                patchLine(line.lineId, { serviceId: e.target.value })
                              }
                              disabled={editServices.length === 0}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            >
                              {editServices.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-1">
                            <label
                              htmlFor={`edit-area-${line.lineId}`}
                              className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
                            >
                              Área
                            </label>
                            <select
                              id={`edit-area-${line.lineId}`}
                              value={line.areaId}
                              onChange={(e) =>
                                patchLine(line.lineId, { areaId: e.target.value })
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

            {editError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{editError}</p>
            )}

            {editing.signaturePngDataUrl ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/40">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Firma en el parte
                </p>
                <img
                  src={editing.signaturePngDataUrl}
                  alt="Firma guardada"
                  className="mt-2 max-h-24 rounded-lg border border-slate-200 bg-white dark:border-slate-600"
                />
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-600">
              <div className="mr-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSignatureDialogOpen(true)}
                  className="rounded-lg border border-slate-400 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  Firmar
                </button>
                <button
                  type="button"
                  disabled={pdfLoading || editLoading}
                  onClick={async () => {
                    setPdfLoading(true);
                    try {
                      let tasks = buildTasksFromLines();
                      if (!tasks || tasks.length === 0) {
                        tasks = getTasksFromRecord(editing);
                      }
                      if (!tasks.length) {
                        setEditError("No hay tareas válidas para incluir en el PDF.");
                        return;
                      }
                      const nEmp = Array.from(new Set(tasks.map((t) => t.companyId))).length;
                      await downloadWorkPartPdf(
                        {
                          ...editing,
                          companyId: tasks[0].companyId,
                          companyName:
                            nEmp === 1
                              ? tasks[0].companyName
                              : `Varias empresas (${nEmp})`,
                          tasks,
                        },
                        tasks,
                        {
                          workerDisplayName,
                          companies: editCompanies,
                        }
                      );
                      setEditError(null);
                    } catch {
                      setEditError("No se pudo generar el PDF. Inténtalo de nuevo.");
                    } finally {
                      setPdfLoading(false);
                    }
                  }}
                  className="rounded-lg border border-agro-600 bg-white px-3 py-2 text-xs font-semibold text-agro-800 hover:bg-agro-50 disabled:opacity-50 dark:border-agro-500 dark:bg-slate-800 dark:text-agro-200 dark:hover:bg-agro-900/30"
                >
                  {pdfLoading ? "Generando PDF…" : "Descargar PDF"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setEditError(null);
                  setSignatureDialogOpen(false);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={editLoading || editSaving || editBlocked}
                onClick={saveEdit}
                className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white hover:bg-agro-700 disabled:opacity-50"
              >
                {editSaving ? "Guardando…" : "Guardar tareas"}
              </button>
            </div>
          </div>
        </div>
      )}

      <SignaturePadDialog
        open={Boolean(editing && signatureDialogOpen)}
        title="Firma del parte"
        initialDataUrl={editing?.signaturePngDataUrl}
        onClose={() => setSignatureDialogOpen(false)}
        onSave={(pngDataUrl) => {
          if (!editing) return;
          updateWorkPartSignature(editing.id, pngDataUrl);
          refresh();
          const fresh = getWorkPartsForWorker(workerId).find((p) => p.id === editing.id);
          if (fresh) setEditing(fresh);
          setSignatureDialogOpen(false);
        }}
      />
    </>
  );
}
