"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

// --- Tipos y helpers locales (mock) ---

interface TimeEntryMock {
  id: number;
  workerId: number;
  workDate: string; // YYYY-MM-DD
  checkInUtc: string;
  checkOutUtc: string | null;
  isEdited: boolean;
  createdAtUtc: string;
  createdBy: number;
  updatedAtUtc: string | null;
  updatedBy: number | null;
  /** Minutos de descanso declarados por el trabajador al cerrar la jornada. */
  breakMinutes?: number;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateES(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTimeLocal(utcIso: string | null): string {
  if (!utcIso) return "—";
  const d = new Date(utcIso);
  return d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diffDurationMinutes(startUtc: string, endUtc: string | null): number | null {
  if (!endUtc) return null;
  const start = new Date(startUtc).getTime();
  const end = new Date(endUtc).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.round((end - start) / (1000 * 60));
}

function formatMinutesShort(totalMinutes: number | null): string {
  if (totalMinutes === null || totalMinutes <= 0) return "0 min";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

// Genera unos registros de ejemplo para los últimos días (solo front, sin servidor)
function createInitialMockEntries(): TimeEntryMock[] {
  const now = new Date();
  const baseWorkerId = 1;
  const baseCreatedBy = 1;

  const makeDay = (offsetDays: number, hasTwoShifts = false): TimeEntryMock[] => {
    const d = new Date(now);
    d.setDate(d.getDate() - offsetDays);
    const workDate = d.toISOString().slice(0, 10);

    const mk = (startHour: number, endHour: number | null, idx: number): TimeEntryMock => {
      const start = new Date(d);
      start.setHours(startHour, 0, 0, 0);
      const end =
        endHour != null
          ? new Date(new Date(d).setHours(endHour, 0, 0, 0)).toISOString()
          : null;
      return {
        id: Number(`${offsetDays}${idx}`),
        workerId: baseWorkerId,
        workDate,
        checkInUtc: start.toISOString(),
        checkOutUtc: end,
        isEdited: false,
        createdAtUtc: start.toISOString(),
        createdBy: baseCreatedBy,
        updatedAtUtc: null,
        updatedBy: null,
      };
    };

    if (hasTwoShifts) {
      return [mk(8, 12, 1), mk(13, 17, 2)];
    }
    return [mk(8, 16, 1)];
  };

  return [
    ...makeDay(1, true),
    ...makeDay(2),
    ...makeDay(3),
  ];
}

export default function TimeTrackingPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntryMock[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"checkin" | "checkout" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restModalStep, setRestModalStep] = useState<"closed" | "askRest" | "askAmount" | "summary">(
    "closed"
  );
  const [restAnswerHadBreak, setRestAnswerHadBreak] = useState<boolean | null>(null);
  const [restMinutes, setRestMinutes] = useState<number>(0);
  const [restCustomInput, setRestCustomInput] = useState<string>("");

  const today = todayISO();

  const todayEntries = useMemo(
    () => entries.filter((e) => e.workDate === today),
    [entries, today]
  );

  const openEntry = useMemo(
    () =>
      todayEntries
        .slice()
        .sort((a, b) => new Date(b.checkInUtc).getTime() - new Date(a.checkInUtc).getTime())
        .find((e) => e.checkOutUtc === null) ?? null,
    [todayEntries]
  );

  const hasOpenEntry = !!openEntry;

  useEffect(() => {
    // Carga inicial de datos mock (últimos días)
    setEntries(createInitialMockEntries());
    setLoading(false);
  }, []);

  const handleCheckIn = async () => {
    setActionLoading("checkin");
    setError(null);
    try {
      // En mock usamos la hora del navegador y un id incremental
      setEntries((prev) => {
        const now = new Date();
        const workDate = now.toISOString().slice(0, 10);
        const maxId = prev.reduce((max, e) => (e.id > max ? e.id : max), 0);
        const newEntry: TimeEntryMock = {
          id: maxId + 1,
          workerId: 1,
          workDate,
          checkInUtc: now.toISOString(),
          checkOutUtc: null,
          isEdited: false,
          createdAtUtc: now.toISOString(),
          createdBy: 1,
          updatedAtUtc: null,
          updatedBy: null,
        };
        return [...prev, newEntry];
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckOut = async () => {
    if (!openEntry) return;
    // Paso 1: preguntar si ha parado a comer o descansar
    setRestAnswerHadBreak(null);
    setRestMinutes(0);
    setRestCustomInput("");
    setRestModalStep("askRest");
  };

  // Convierte el texto libre de descanso a minutos (ej. "45", "1h30", "90m")
  const parseCustomRest = (): number => {
    const raw = restCustomInput.trim().toLowerCase();
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return parseInt(raw, 10); // solo número = minutos

    let total = 0;
    const hourMatch = raw.match(/(\d+)\s*h/);
    if (hourMatch) total += parseInt(hourMatch[1], 10) * 60;
    const minMatch = raw.match(/(\d+)\s*m/);
    if (minMatch) total += parseInt(minMatch[1], 10);

    if (total === 0) {
      const num = parseInt(raw.replace(/[^\d]/g, ""), 10);
      if (!Number.isNaN(num)) total = num;
    }
    return Number.isNaN(total) || total < 0 ? 0 : total;
  };

  const confirmRestAmountAndShowSummary = () => {
    const minutes =
      restAnswerHadBreak === false ? 0 : restMinutes > 0 ? restMinutes : parseCustomRest();
    setRestMinutes(minutes);
    setRestModalStep("summary");
  };

  const finalizeCheckOutWithRest = () => {
    if (!openEntry) {
      setRestModalStep("closed");
      return;
    }
    setActionLoading("checkout");
    setError(null);
    try {
      const nowIso = new Date().toISOString();
      const breakMin = restAnswerHadBreak === false ? 0 : restMinutes;
      setEntries((prev) =>
        prev.map((e) =>
          e.id === openEntry.id
            ? {
                ...e,
                checkOutUtc: nowIso,
                updatedAtUtc: nowIso,
                updatedBy: 1,
                breakMinutes: breakMin,
              }
            : e
        )
      );
    } finally {
      setActionLoading(null);
      setRestModalStep("closed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-agro-600 via-emerald-500 to-sky-500 px-5 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-agro-100/80">
              Registro de jornada
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white">Fichador</h1>
            <p className="mt-1 text-sm text-agro-50/90">
              Marca tu entrada y salida de forma sencilla y cumpliendo el registro horario.
            </p>
          </div>
          {user && (
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-agro-50 backdrop-blur">
                {user.email}
              </span>
              <span className="text-[11px] text-agro-50/80">
                Hoy: {formatDateES(today)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Estado de hoy
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
              {hasOpenEntry ? "Jornada en curso" : "Fuera de jornada"}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {hasOpenEntry ? (
                <>
                  Has fichado la entrada a las{" "}
                  <span className="font-semibold">
                    {formatTimeLocal(openEntry!.checkInUtc)}
                  </span>
                  . Cuando termines, pulsa &quot;Fichar salida&quot;.
                </>
              ) : (
                <>
                  Todavía no has marcado la entrada de hoy. Pulsa el botón inferior para
                  registrar el inicio de tu jornada.
                </>
              )}
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={hasOpenEntry ? handleCheckOut : handleCheckIn}
                disabled={actionLoading !== null}
                className={`inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  hasOpenEntry
                    ? "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500"
                    : "bg-agro-600 hover:bg-agro-700 focus:ring-agro-500"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {actionLoading === "checkin" && "Registrando entrada…"}
                {actionLoading === "checkout" && "Registrando salida…"}
                {actionLoading === null && (hasOpenEntry ? "Fichar salida" : "Fichar entrada")}
              </button>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Los horarios se guardan en hora UTC en el servidor para asegurar un registro
                coherente en todos los dispositivos.
              </p>
            </div>

            {error && (
              <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
                {error}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Resumen de hoy
            </p>
            {loading ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Cargando registros…
              </p>
            ) : todayEntries.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Hoy todavía no hay fichajes registrados.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                {todayEntries
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(a.checkInUtc).getTime() - new Date(b.checkInUtc).getTime()
                  )
                  .map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-600 dark:bg-slate-700/60"
                    >
                      <div className="flex flex-col">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Entrada:{" "}
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {formatTimeLocal(e.checkInUtc)}
                          </span>
                          {" · "}
                          Salida:{" "}
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {formatTimeLocal(e.checkOutUtc)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          Comida/descanso:{" "}
                          <span className="font-semibold">
                            {formatMinutesShort(e.breakMinutes ?? 0)}
                          </span>
                          {" · "}
                          Total trabajado:{" "}
                          <span className="font-semibold">
                            {formatMinutesShort(
                              (() => {
                                const total = diffDurationMinutes(
                                  e.checkInUtc,
                                  e.checkOutUtc
                                );
                                if (total === null) return null;
                                return Math.max(0, total - (e.breakMinutes ?? 0));
                              })()
                            )}
                          </span>
                        </p>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Histórico reciente
                </p>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                  Últimos 7 días de registro de jornada.
                </p>
              </div>
              {/* En modo mock no recargamos desde servidor, pero dejamos el botón para el futuro */}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
                Datos de demo (sin servidor)
              </span>
            </div>

            {loading ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Cargando histórico…
              </p>
            ) : entries.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                No hay registros de jornada en los últimos días.
              </p>
            ) : (
              <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-100 dark:border-slate-700">
                <table className="min-w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Entrada</th>
                      <th className="px-3 py-2">Salida</th>
                      <th className="px-3 py-2 text-right">Duración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries
                      .slice()
                      .sort((a, b) => (a.workDate < b.workDate ? 1 : a.workDate > b.workDate ? -1 : 0))
                      .map((e) => (
                        <tr
                          key={e.id}
                          className="border-t border-slate-100 bg-white/80 dark:border-slate-700 dark:bg-slate-800/80"
                        >
                          <td className="px-3 py-2 text-xs">
                            {formatDateES(e.workDate)}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {formatTimeLocal(e.checkInUtc)}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {formatTimeLocal(e.checkOutUtc)}
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-semibold">
                            {formatMinutesShort(
                              (() => {
                                const total = diffDurationMinutes(
                                  e.checkInUtc,
                                  e.checkOutUtc
                                );
                                if (total === null) return null;
                                return Math.max(0, total - (e.breakMinutes ?? 0));
                              })()
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modal flujo de descanso/comida al fichar salida */}
      {restModalStep !== "closed" && openEntry && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-800 dark:border dark:border-slate-600">
            {restModalStep === "askRest" && (
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
                      setRestAnswerHadBreak(false);
                      setRestMinutes(0);
                      setRestModalStep("summary");
                    }}
                  >
                    No, no he parado
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-50"
                    onClick={() => {
                      setRestAnswerHadBreak(true);
                      setRestMinutes(30);
                      setRestModalStep("askAmount");
                    }}
                  >
                    Sí, he parado
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestModalStep("closed")}
                    className="mt-1 text-xs text-slate-500 underline underline-offset-2"
                  >
                    Volver sin fichar salida
                  </button>
                </div>
              </>
            )}

            {restModalStep === "askAmount" && (
              <>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  ¿Cuánto tiempo has parado en total?
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Puedes elegir una de estas opciones o indicar otro tiempo.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[30, 60, 120].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setRestMinutes(m);
                        setRestCustomInput("");
                      }}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                        restMinutes === m
                          ? "bg-agro-600 text-white"
                          : "border border-slate-200 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-50"
                      }`}
                    >
                      {formatMinutesShort(m)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`col-span-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-50 ${
                      restCustomInput
                        ? "border border-agro-500 bg-agro-50 dark:border-agro-400 dark:bg-agro-900/30"
                        : "border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-700"
                    }`}
                  >
                    <span className="block text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      Otro
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="mt-0.5 w-full bg-transparent text-sm outline-none"
                      placeholder="Ej. 45 min, 1h30…"
                      value={restCustomInput}
                      onChange={(e) => setRestCustomInput(e.target.value)}
                    />
                  </button>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRestModalStep("askRest")}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={confirmRestAmountAndShowSummary}
                    className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white hover:bg-agro-700"
                  >
                    Continuar
                  </button>
                </div>
              </>
            )}

            {restModalStep === "summary" && (
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
                        onClick={() =>
                          restAnswerHadBreak ? setRestModalStep("askAmount") : setRestModalStep("askRest")
                        }
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        Cambiar
                      </button>
                      <button
                        type="button"
                        onClick={finalizeCheckOutWithRest}
                        className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white hover:bg-agro-700"
                      >
                        Confirmar y fichar salida
                      </button>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}

