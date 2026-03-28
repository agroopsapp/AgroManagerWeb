"use client";

import type { TimeEntryMock } from "@/features/time-tracking/types";
import {
  diffDurationMinutes,
  formatMinutesShort,
  formatTimeLocal,
  minutesToClockParts,
} from "@/shared/utils/time";
import { type Company, type WorkService } from "@/types";
import { BreakDurationClock } from "./BreakDurationClock";

type RestStep = "closed" | "askRest" | "askAmount" | "summary" | "workPart";
type WorkPartLine = { lineId: string; companyId: string; serviceId: string; areaId: string };

type WorkPartOverrideEntry = {
  workDate: string;
  workerId: number;
  checkInUtc: string;
  checkOutUtc: string;
  breakMinutes: number;
};

interface BreakModalProps {
  step: RestStep;
  openEntry: TimeEntryMock | null;
  workPartOverrideEntry: WorkPartOverrideEntry | null;
  restAnswerHadBreak: boolean | null;
  restMinutes: number;
  restClockHour: number;
  restClockMinute: number;
  restClockPhase: "hour" | "minute";
  askAmountError: string | null;
  workPartDataLoading: boolean;
  workPartCompanies: Company[];
  workPartServices: WorkService[];
  workPartLines: WorkPartLine[];
  workPartError: string | null;
  onSetStep: (s: RestStep) => void;
  onSetRestAnswerHadBreak: (v: boolean) => void;
  onSetRestMinutes: (v: number) => void;
  onSetRestClockHour: (v: number) => void;
  onSetRestClockMinute: (v: number) => void;
  onSetRestClockPhase: (v: "hour" | "minute") => void;
  onSetAskAmountError: (e: string | null) => void;
  onConfirmRestAmount: () => void;
  onConfirmWorkPart: () => void;
  onAddWorkPartLine: () => void;
  onPatchWorkPartLine: (lineId: string, patch: Partial<Omit<WorkPartLine, "lineId">>) => void;
  onRemoveWorkPartLine: (lineId: string) => void;
  onSetWorkPartLines: (lines: WorkPartLine[]) => void;
  onSetWorkPartOverrideEntry: (e: null) => void;
}

export function BreakModal({
  step,
  openEntry,
  workPartOverrideEntry,
  restAnswerHadBreak,
  restMinutes,
  restClockHour,
  restClockMinute,
  restClockPhase,
  askAmountError,
  workPartDataLoading,
  workPartCompanies,
  workPartServices,
  workPartLines,
  workPartError,
  onSetStep,
  onSetRestAnswerHadBreak,
  onSetRestMinutes,
  onSetRestClockHour,
  onSetRestClockMinute,
  onSetRestClockPhase,
  onSetAskAmountError,
  onConfirmRestAmount,
  onConfirmWorkPart,
  onAddWorkPartLine,
  onPatchWorkPartLine,
  onRemoveWorkPartLine,
  onSetWorkPartLines,
  onSetWorkPartOverrideEntry,
}: BreakModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div
        className={`w-full rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-800 dark:border dark:border-slate-600 ${
          step === "workPart" ? "max-w-xl" : "max-w-sm"
        }`}
      >
        {step === "askRest" && openEntry && (
          <>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              ¿Has parado para comer o descansar hoy?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Cuenta solo el tiempo en el que no has estado trabajando.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-xl bg-agro-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                onClick={() => {
                  onSetRestAnswerHadBreak(false);
                  onSetRestMinutes(0);
                  onSetStep("summary");
                }}
              >
                No, no he parado
              </button>
              <button
                type="button"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-50"
                onClick={() => {
                  onSetRestAnswerHadBreak(true);
                  onSetRestClockHour(0);
                  onSetRestClockMinute(30);
                  onSetRestClockPhase("hour");
                  onSetAskAmountError(null);
                  onSetStep("askAmount");
                }}
              >
                Sí, he parado
              </button>
              <button
                type="button"
                onClick={() => onSetStep("closed")}
                className="mt-1 text-xs text-slate-500 underline underline-offset-2"
              >
                Volver sin fichar salida
              </button>
            </div>
          </>
        )}

        {step === "askAmount" && openEntry && (
          <>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              ¿Cuánto tiempo has parado en total?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Usa el reloj: elige primero las <strong>horas</strong> y luego los{" "}
              <strong>minutos</strong> (cada 5 min).
            </p>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-2 py-3 dark:border-slate-600 dark:bg-slate-800/80">
              <BreakDurationClock
                phase={restClockPhase}
                hoursSel={restClockHour}
                minutesSel={restClockMinute}
                onPhaseChange={onSetRestClockPhase}
                onHourChange={(h) => {
                  onSetRestClockHour(h);
                  onSetAskAmountError(null);
                }}
                onMinuteChange={(m) => {
                  onSetRestClockMinute(m);
                  onSetAskAmountError(null);
                }}
              />
              <p className="mt-1 text-center text-sm font-semibold text-agro-700 dark:text-agro-400">
                Total: {formatMinutesShort(restClockHour * 60 + restClockMinute)}
              </p>
              {askAmountError && (
                <p className="mt-2 text-center text-xs text-red-600 dark:text-red-400">
                  {askAmountError}
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onSetStep("askRest")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={onConfirmRestAmount}
                className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white hover:bg-agro-700"
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === "summary" &&
          openEntry &&
          (() => {
            const now = new Date();
            const salidaPreview = formatTimeLocal(now.toISOString());
            const totalMinutes = diffDurationMinutes(openEntry.checkInUtc, now.toISOString());
            const breakMin = restAnswerHadBreak === false ? 0 : restMinutes;
            const workedMinutes =
              totalMinutes === null ? null : Math.max(0, totalMinutes - breakMin);
            return (
              <>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  Revisar jornada de hoy
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Antes de guardar, comprueba que los datos son correctos.
                </p>
                <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
                  <p>
                    Entrada:{" "}
                    <span className="font-semibold">
                      {formatTimeLocal(openEntry.checkInUtc)}
                    </span>
                  </p>
                  <p>
                    Salida: <span className="font-semibold">{salidaPreview}</span>
                  </p>
                  <p>
                    Comida/descanso:{" "}
                    <span className="font-semibold">{formatMinutesShort(breakMin)}</span>
                  </p>
                  <p>
                    Total trabajado:{" "}
                    <span className="font-semibold">
                      {formatMinutesShort(workedMinutes)}
                    </span>
                  </p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (restAnswerHadBreak) {
                        const { h, m } = minutesToClockParts(restMinutes);
                        onSetRestClockHour(h);
                        onSetRestClockMinute(m);
                        onSetRestClockPhase("hour");
                        onSetAskAmountError(null);
                        onSetStep("askAmount");
                      } else {
                        onSetStep("askRest");
                      }
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const lid =
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                          ? crypto.randomUUID()
                          : `ln-${Date.now()}`;
                      onSetWorkPartLines([
                        { lineId: lid, companyId: "", serviceId: "", areaId: "" },
                      ]);
                      onSetStep("workPart");
                    }}
                    className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white hover:bg-agro-700"
                  >
                    Confirmar y fichar salida
                  </button>
                </div>
              </>
            );
          })()}

        {step === "workPart" &&
          (openEntry || workPartOverrideEntry) &&
          (() => {
            const entry = workPartOverrideEntry
              ? {
                  checkInUtc: workPartOverrideEntry.checkInUtc,
                  checkOutUtc: workPartOverrideEntry.checkOutUtc,
                }
              : openEntry!;
            const nowIso = workPartOverrideEntry
              ? workPartOverrideEntry.checkOutUtc
              : new Date().toISOString();
            const salidaPreview = formatTimeLocal(nowIso);
            const totalMinutes = diffDurationMinutes(entry.checkInUtc, nowIso);
            const breakMin = workPartOverrideEntry
              ? workPartOverrideEntry.breakMinutes
              : restAnswerHadBreak === false
                ? 0
                : restMinutes;
            const workedMinutes =
              totalMinutes === null ? null : Math.max(0, totalMinutes - breakMin);
            const workPartSaveBlocked =
              workPartLines.length === 0 ||
              workPartLines.some((line) => {
                const c = workPartCompanies.find((x) => x.id === line.companyId);
                return (
                  !c ||
                  c.areas.length === 0 ||
                  !line.areaId ||
                  !workPartServices.some((s) => s.id === line.serviceId)
                );
              });
            return (
              <>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  Partes de trabajo
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Indica para quién y qué has hecho con el tiempo registrado en el fichaje. En cada
                  tarea eliges empresa, servicio y área; puedes trabajar para varias empresas en el
                  mismo parte y usar «Añadir tarea» para más filas.
                </p>
                <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Resumen del fichaje
                  </p>
                  <p>
                    Entrada:{" "}
                    <span className="font-semibold">
                      {formatTimeLocal(entry.checkInUtc)}
                    </span>
                  </p>
                  <p>
                    Salida: <span className="font-semibold">{salidaPreview}</span>
                  </p>
                  <p>
                    Comida/descanso:{" "}
                    <span className="font-semibold">{formatMinutesShort(breakMin)}</span>
                  </p>
                  <p>
                    Total trabajado:{" "}
                    <span className="font-semibold">
                      {formatMinutesShort(workedMinutes)}
                    </span>
                  </p>
                </div>

                {workPartDataLoading ? (
                  <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
                    Cargando empresas y servicios…
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="space-y-2 border-b border-slate-200 pb-3 dark:border-slate-600">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Tareas del día
                        </p>
                        <button
                          type="button"
                          onClick={onAddWorkPartLine}
                          disabled={
                            workPartServices.length === 0 || workPartCompanies.length === 0
                          }
                          className="w-full shrink-0 rounded-lg border-2 border-agro-600 bg-agro-50 px-3 py-2 text-xs font-semibold text-agro-800 hover:bg-agro-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-agro-500 dark:bg-agro-950/40 dark:text-agro-200 dark:hover:bg-agro-900/50 sm:w-auto sm:py-1.5"
                        >
                          + Añadir tarea
                        </button>
                      </div>
                      {(workPartServices.length === 0 || workPartCompanies.length === 0) && (
                        <p className="text-xs text-amber-800 dark:text-amber-300/90">
                          Hace falta al menos una empresa y la lista de servicios cargada. Revisa
                          Empresas y Servicios en el menú Jornada.
                        </p>
                      )}
                    </div>

                    <ul className="space-y-3">
                      {workPartLines.map((line, idx) => {
                        const lineCompany = workPartCompanies.find(
                          (c) => c.id === line.companyId
                        );
                        return (
                          <li
                            key={line.lineId}
                            className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/40"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                Tarea {idx + 1}
                              </span>
                              {workPartLines.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => onRemoveWorkPartLine(line.lineId)}
                                  className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                                >
                                  Quitar
                                </button>
                              )}
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="sm:col-span-2">
                                <label
                                  htmlFor={`work-part-co-${line.lineId}`}
                                  className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
                                >
                                  Empresa
                                </label>
                                <select
                                  id={`work-part-co-${line.lineId}`}
                                  value={line.companyId}
                                  onChange={(e) => {
                                    const id = e.target.value;
                                    const c = workPartCompanies.find((x) => x.id === id);
                                    onPatchWorkPartLine(line.lineId, {
                                      companyId: id,
                                      areaId: c?.areas[0]?.id ?? "",
                                    });
                                  }}
                                  disabled={workPartCompanies.length === 0}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                >
                                  {workPartCompanies.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                                {lineCompany && lineCompany.areas.length === 0 && (
                                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                    Esta empresa no tiene áreas. Añádelas en{" "}
                                    <strong>Empresas</strong> → Editar.
                                  </p>
                                )}
                              </div>
                              <div className="sm:col-span-1">
                                <label
                                  htmlFor={`work-part-svc-${line.lineId}`}
                                  className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
                                >
                                  Servicio
                                </label>
                                <select
                                  id={`work-part-svc-${line.lineId}`}
                                  value={line.serviceId}
                                  onChange={(e) =>
                                    onPatchWorkPartLine(line.lineId, {
                                      serviceId: e.target.value,
                                    })
                                  }
                                  disabled={workPartServices.length === 0}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                >
                                  {workPartServices.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="sm:col-span-1">
                                <label
                                  htmlFor={`work-part-area-${line.lineId}`}
                                  className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
                                >
                                  Área
                                </label>
                                <select
                                  id={`work-part-area-${line.lineId}`}
                                  value={line.areaId}
                                  onChange={(e) =>
                                    onPatchWorkPartLine(line.lineId, {
                                      areaId: e.target.value,
                                    })
                                  }
                                  disabled={
                                    !lineCompany || lineCompany.areas.length === 0
                                  }
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

                {workPartError && (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-400">{workPartError}</p>
                )}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (workPartOverrideEntry) {
                        onSetStep("closed");
                        onSetWorkPartOverrideEntry(null);
                      } else {
                        onSetStep("summary");
                      }
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {workPartOverrideEntry ? "Cerrar" : "Atrás"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      workPartDataLoading ||
                      workPartCompanies.length === 0 ||
                      workPartServices.length === 0 ||
                      workPartSaveBlocked
                    }
                    onClick={onConfirmWorkPart}
                    className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white hover:bg-agro-700 disabled:opacity-50"
                  >
                    {workPartOverrideEntry
                      ? "Guardar parte"
                      : "Guardar parte y fichar salida"}
                  </button>
                </div>
              </>
            );
          })()}
      </div>
    </div>
  );
}
