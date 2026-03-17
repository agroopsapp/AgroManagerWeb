"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

// --- Tipos y helpers locales (mock) ---

/** Motivo de imputación del registro horario. */
export type TimeEntryRazon = "imputacion_normal" | "imputacion_manual_error";

const RAZON_LABELS: Record<TimeEntryRazon, string> = {
  imputacion_normal: "Imputación normal",
  imputacion_manual_error: "Imputación manual por error",
};

function formatRazon(razon: TimeEntryRazon | undefined): string {
  return RAZON_LABELS[razon ?? "imputacion_normal"];
}

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
  /** Cómo se ha imputado la jornada (fichaje normal vs corrección manual). */
  razon?: TimeEntryRazon;
  /** Entrada registrada vía “Olvidé fichar” (solo entrada); pendiente de salida normal. */
  entradaManual?: boolean;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayISO() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** workDate (YYYY-MM-DD) + HH:mm local → ISO UTC */
function dateTimeLocalToUtcIso(workDate: string, timeHHMM: string): string {
  const [Y, M, D] = workDate.split("-").map(Number);
  const [h, m] = timeHHMM.split(":").map(Number);
  return new Date(Y, M - 1, D, h, m, 0, 0).toISOString();
}

/** Hora de fin el mismo día laborable; si es ≤ entrada, se asume día siguiente. */
function checkoutLocalIsoAfterCheckin(
  workDate: string,
  checkInUtcIso: string,
  endTimeHHMM: string
): string {
  const [Y, M, D] = workDate.split("-").map(Number);
  const [eh, em] = endTimeHHMM.split(":").map(Number);
  let end = new Date(Y, M - 1, D, eh, em, 0, 0);
  const start = new Date(checkInUtcIso);
  if (end.getTime() <= start.getTime()) {
    end = new Date(Y, M - 1, D + 1, eh, em, 0, 0);
  }
  return end.toISOString();
}

function parseForgotBreakCustom(raw: string): number {
  const s = raw.trim().toLowerCase();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  let total = 0;
  const hourMatch = s.match(/(\d+)\s*h/);
  if (hourMatch) total += parseInt(hourMatch[1], 10) * 60;
  const minMatch = s.match(/(\d+)\s*m/);
  if (minMatch) total += parseInt(minMatch[1], 10);
  if (total === 0) {
    const num = parseInt(s.replace(/[^\d]/g, ""), 10);
    if (!Number.isNaN(num)) total = num;
  }
  return Number.isNaN(total) || total < 0 ? 0 : total;
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

const BREAK_CLOCK_HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const BREAK_CLOCK_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function minutesToClockParts(totalMinutes: number): { h: number; m: number } {
  const capped = Math.min(8 * 60 + 55, Math.max(0, totalMinutes));
  const h = Math.min(8, Math.floor(capped / 60));
  let m = capped % 60;
  m = Math.round(m / 5) * 5;
  if (m >= 60) return { h: Math.min(8, h + 1), m: 0 };
  return { h, m };
}

/** Reloj circular para elegir duración de descanso (horas + minutos). */
function BreakDurationClock({
  phase,
  hoursSel,
  minutesSel,
  onPhaseChange,
  onHourChange,
  onMinuteChange,
}: {
  phase: "hour" | "minute";
  hoursSel: number;
  minutesSel: number;
  onPhaseChange: (p: "hour" | "minute") => void;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
}) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const rLabels = 92;
  const rHand = 72;

  const opts = phase === "hour" ? BREAK_CLOCK_HOURS : BREAK_CLOCK_MINUTES;
  const selected = phase === "hour" ? hoursSel : minutesSel;
  const idx = opts.indexOf(selected);
  const handAngleDeg = idx >= 0 ? -90 + (360 / opts.length) * idx : -90;

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 flex rounded-full border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-600 dark:bg-slate-900/50">
        <button
          type="button"
          onClick={() => onPhaseChange("hour")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            phase === "hour"
              ? "bg-agro-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300"
          }`}
        >
          Horas
        </button>
        <button
          type="button"
          onClick={() => onPhaseChange("minute")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
            phase === "minute"
              ? "bg-agro-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300"
          }`}
        >
          Minutos
        </button>
      </div>

      <div className="relative rounded-full bg-gradient-to-b from-slate-50 to-slate-100 p-2 shadow-inner dark:from-slate-800 dark:to-slate-900">
        <svg width={size} height={size} className="block" aria-hidden>
          <circle
            cx={cx}
            cy={cy}
            r={rLabels + 8}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            className="text-slate-200 dark:text-slate-600"
          />
          <circle cx={cx} cy={cy} r={3} className="fill-agro-600" />
          <line
            x1={cx}
            y1={cy}
            x2={cx + rHand * Math.cos((handAngleDeg * Math.PI) / 180)}
            y2={cy + rHand * Math.sin((handAngleDeg * Math.PI) / 180)}
            strokeWidth={3}
            strokeLinecap="round"
            className="stroke-agro-600"
          />
          {opts.map((val, i) => {
            const deg = -90 + (360 / opts.length) * i;
            const rad = (deg * Math.PI) / 180;
            const lx = cx + rLabels * Math.cos(rad);
            const ly = cy + rLabels * Math.sin(rad);
            const isOn = val === selected;
            const onPick = () => {
              if (phase === "hour") onHourChange(val);
              else onMinuteChange(val);
            };
            return (
              <g key={`${phase}-${val}`}>
                <circle
                  cx={lx}
                  cy={ly}
                  r={isOn ? 22 : 18}
                  className={`cursor-pointer transition ${
                    isOn
                      ? "fill-agro-600"
                      : "fill-white stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-500"
                  }`}
                  strokeWidth={isOn ? 0 : 1}
                  onClick={onPick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick();
                    }
                  }}
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`pointer-events-none text-[13px] font-semibold select-none ${
                    isOn ? "fill-white" : "fill-slate-700 dark:fill-slate-200"
                  }`}
                >
                  {phase === "minute" && val < 10 ? `0${val}` : val}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
        {phase === "hour"
          ? "Toca un número para las horas de descanso."
          : "Toca un número para los minutos (cada 5 min)."}
      </p>
    </div>
  );
}

// Genera unos registros de ejemplo para los últimos días (solo front, sin servidor)
function createInitialMockEntries(): TimeEntryMock[] {
  const now = new Date();
  const baseWorkerId = 1;
  const baseCreatedBy = 1;

  const makeDay = (
    offsetDays: number,
    startHour: number,
    endHour: number,
    breakMinutes: number,
    razon: TimeEntryRazon = "imputacion_normal"
  ): TimeEntryMock => {
    const d = new Date(now);
    d.setDate(d.getDate() - offsetDays);
    const workDate = d.toISOString().slice(0, 10);

    const start = new Date(d);
    start.setHours(startHour, 0, 0, 0);
    const end = new Date(d);
    end.setHours(endHour, 0, 0, 0);

    return {
      id: Number(`${offsetDays}1`),
      workerId: baseWorkerId,
      workDate,
      checkInUtc: start.toISOString(),
      checkOutUtc: end.toISOString(),
      isEdited: false,
      createdAtUtc: start.toISOString(),
      createdBy: baseCreatedBy,
      updatedAtUtc: end.toISOString(),
      updatedBy: baseCreatedBy,
      breakMinutes,
      razon,
    };
  };

  return [
    // Ayer: jornada larga con 2h de descanso (corrección manual de ejemplo)
    makeDay(1, 8, 18, 120, "imputacion_manual_error"),
    // Hace 2 días: 1h de descanso
    makeDay(2, 8, 17, 60, "imputacion_normal"),
    // Hace 3 días: sin descanso
    makeDay(3, 8, 16, 0, "imputacion_normal"),
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
  const [restClockHour, setRestClockHour] = useState(0);
  const [restClockMinute, setRestClockMinute] = useState(30);
  const [restClockPhase, setRestClockPhase] = useState<"hour" | "minute">("hour");
  const [askAmountError, setAskAmountError] = useState<string | null>(null);

  type ForgotStep =
    | "closed"
    | "pick_day"
    | "pick_type"
    | "solo_time"
    | "full_start"
    | "full_end"
    | "full_rest"
    | "full_rest_amount";

  const [forgotStep, setForgotStep] = useState<ForgotStep>("closed");
  const [forgotTargetDate, setForgotTargetDate] = useState<string | null>(null);
  const [forgotSoloTime, setForgotSoloTime] = useState("09:00");
  const [forgotFullStart, setForgotFullStart] = useState("09:00");
  const [forgotFullEnd, setForgotFullEnd] = useState("18:00");
  const [forgotFullHadBreak, setForgotFullHadBreak] = useState<boolean | null>(null);
  const [forgotFullBreakMins, setForgotFullBreakMins] = useState(30);
  const [forgotFullBreakCustom, setForgotFullBreakCustom] = useState("");
  const [forgotBreakOtro, setForgotBreakOtro] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState<"solo_hoy" | "full_hoy" | "full_ayer" | null>(null);

  const today = todayISO();
  const ayer = yesterdayISO();

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

  /** Jornada de hoy ya cerrada (entrada + salida). Solo se permite un ciclo por día. */
  const closedTodayEntry = useMemo(
    () =>
      todayEntries
        .filter((e) => e.checkOutUtc !== null)
        .sort((a, b) => new Date(b.checkOutUtc!).getTime() - new Date(a.checkOutUtc!).getTime())[0] ??
      null,
    [todayEntries]
  );

  const jornadaCompletadaHoy = closedTodayEntry !== null && !hasOpenEntry;

  const hasEntryFor = (workDate: string) => entries.some((e) => e.workDate === workDate);

  const olvideFicharDisponible =
    !hasEntryFor(ayer) || !hasEntryFor(today);

  const resetForgotModal = () => {
    setForgotStep("closed");
    setForgotTargetDate(null);
    setForgotSoloTime("09:00");
    setForgotFullStart("09:00");
    setForgotFullEnd("18:00");
    setForgotFullHadBreak(null);
    setForgotFullBreakMins(30);
    setForgotFullBreakCustom("");
    setForgotBreakOtro(false);
    setForgotError(null);
    setForgotMode(null);
  };

  const openForgotModal = () => {
    setForgotError(null);
    setForgotTargetDate(null);
    setForgotStep("pick_day");
  };

  const submitForgotSoloEntrada = () => {
    if (!forgotTargetDate) return;
    if (forgotTargetDate !== today) {
      setForgotError("Solo puedes registrar solo la entrada para el día de hoy.");
      return;
    }
    if (hasEntryFor(forgotTargetDate)) {
      setForgotError("Ya existe un fichaje para ese día.");
      return;
    }
    const checkInUtc = dateTimeLocalToUtcIso(forgotTargetDate, forgotSoloTime);
    setEntries((prev) => {
      const maxId = prev.reduce((max, e) => (e.id > max ? e.id : max), 0);
      const nowIso = new Date().toISOString();
      return [
        ...prev,
        {
          id: maxId + 1,
          workerId: 1,
          workDate: forgotTargetDate,
          checkInUtc,
          checkOutUtc: null,
          isEdited: true,
          createdAtUtc: nowIso,
          createdBy: 1,
          updatedAtUtc: null,
          updatedBy: null,
          razon: "imputacion_manual_error",
          entradaManual: true,
          breakMinutes: 0,
        },
      ];
    });
    resetForgotModal();
  };

  const submitForgotJornadaCompleta = (forcedBreakMinutes?: number) => {
    if (!forgotTargetDate) return;
    if (hasEntryFor(forgotTargetDate)) {
      setForgotError("Ya existe un fichaje para ese día.");
      return;
    }
    const checkInUtc = dateTimeLocalToUtcIso(forgotTargetDate, forgotFullStart);
    const checkOutUtc = checkoutLocalIsoAfterCheckin(forgotTargetDate, checkInUtc, forgotFullEnd);
    let breakMin = 0;
    if (typeof forcedBreakMinutes === "number") {
      breakMin = forcedBreakMinutes;
    } else if (forgotFullHadBreak === true) {
      breakMin = forgotBreakOtro
        ? parseForgotBreakCustom(forgotFullBreakCustom)
        : forgotFullBreakMins;
      if (breakMin <= 0) {
        setForgotError(
          forgotBreakOtro
            ? "Escribe el tiempo de descanso (ej. 45 min, 1h30)."
            : "Elige cuánto tiempo has parado."
        );
        return;
      }
    }
    setEntries((prev) => {
      const maxId = prev.reduce((max, e) => (e.id > max ? e.id : max), 0);
      const nowIso = new Date().toISOString();
      return [
        ...prev,
        {
          id: maxId + 1,
          workerId: 1,
          workDate: forgotTargetDate,
          checkInUtc,
          checkOutUtc,
          isEdited: true,
          createdAtUtc: nowIso,
          createdBy: 1,
          updatedAtUtc: nowIso,
          updatedBy: 1,
          razon: "imputacion_manual_error",
          entradaManual: false,
          breakMinutes: breakMin,
        },
      ];
    });
    resetForgotModal();
  };

  useEffect(() => {
    // Carga inicial de datos mock (últimos días)
    setEntries(createInitialMockEntries());
    setLoading(false);
  }, []);

  const handleCheckIn = async () => {
    setError(null);
    const workDate = new Date().toISOString().slice(0, 10);
    const yaHayFichajeHoy = entries.some((e) => e.workDate === workDate);
    if (yaHayFichajeHoy) {
      setError(
        "Solo puedes fichar la entrada una vez al día. Si ya cerraste la jornada, mañana podrás volver a fichar."
      );
      return;
    }
    setActionLoading("checkin");
    try {
      setEntries((prev) => {
        const now = new Date();
        const wd = now.toISOString().slice(0, 10);
        if (prev.some((e) => e.workDate === wd)) {
          return prev;
        }
        const maxId = prev.reduce((max, e) => (e.id > max ? e.id : max), 0);
        const newEntry: TimeEntryMock = {
          id: maxId + 1,
          workerId: 1,
          workDate: wd,
          checkInUtc: now.toISOString(),
          checkOutUtc: null,
          isEdited: false,
          createdAtUtc: now.toISOString(),
          createdBy: 1,
          updatedAtUtc: null,
          updatedBy: null,
          razon: "imputacion_normal",
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
    setRestClockHour(0);
    setRestClockMinute(30);
    setRestClockPhase("hour");
    setAskAmountError(null);
    setRestModalStep("askRest");
  };

  const confirmRestAmountAndShowSummary = () => {
    const minutes = restClockHour * 60 + restClockMinute;
    if (minutes <= 0) {
      setAskAmountError("Selecciona al menos unos minutos en el reloj.");
      return;
    }
    setAskAmountError(null);
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
            {hasOpenEntry && openEntry?.entradaManual && (
              <div
                className="mt-2 flex items-center gap-2 rounded-lg border border-amber-600 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-500 dark:bg-amber-950/50 dark:text-amber-100"
                role="status"
              >
                <span aria-hidden>⚠️</span>
                Entrada registrada manualmente — cuando termines, fichá la salida con normalidad.
              </div>
            )}
            <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
              {hasOpenEntry
                ? "Jornada en curso"
                : jornadaCompletadaHoy
                  ? "Jornada completada"
                  : "Fuera de jornada"}
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
              ) : jornadaCompletadaHoy && closedTodayEntry ? (
                <>
                  Ya registraste la jornada de hoy: entrada{" "}
                  <span className="font-semibold">
                    {formatTimeLocal(closedTodayEntry.checkInUtc)}
                  </span>
                  , salida{" "}
                  <span className="font-semibold">
                    {formatTimeLocal(closedTodayEntry.checkOutUtc)}
                  </span>
                  . Solo se permite <strong>un fichaje al día</strong>; mañana podrás fichar de
                  nuevo.
                </>
              ) : (
                <>
                  Todavía no has marcado la entrada de hoy. Pulsa el botón inferior para
                  registrar el inicio de tu jornada.
                </>
              )}
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {!jornadaCompletadaHoy && (
                <button
                  type="button"
                  onClick={hasOpenEntry ? handleCheckOut : handleCheckIn}
                  disabled={actionLoading !== null || forgotStep !== "closed"}
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
              )}
              <button
                type="button"
                onClick={openForgotModal}
                disabled={
                  !olvideFicharDisponible || actionLoading !== null || forgotStep !== "closed"
                }
                className="inline-flex items-center justify-center rounded-xl border-2 border-dashed border-amber-600/70 bg-amber-50/80 px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
              >
                Olvidé fichar
              </button>
              {!olvideFicharDisponible && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ya hay registro para hoy y ayer. Correcciones de días anteriores las gestiona un
                  responsable.
                </p>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {jornadaCompletadaHoy
                  ? "Normativa: un solo registro de entrada y salida por día natural."
                  : "Los horarios se guardan en hora UTC en el servidor para asegurar un registro coherente en todos los dispositivos."}
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
                      <th className="px-3 py-2">Descanso</th>
                      <th className="px-3 py-2">Razón</th>
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
                          <td className="px-3 py-2 text-xs">
                            {formatMinutesShort(e.breakMinutes ?? 0)}
                          </td>
                          <td className="max-w-[10rem] px-3 py-2 text-xs leading-snug">
                            <span
                              className={
                                e.razon === "imputacion_manual_error"
                                  ? "rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
                                  : "text-slate-700 dark:text-slate-200"
                              }
                            >
                              {formatRazon(e.razon)}
                            </span>
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

      {/* Modal: Olvidé fichar (solo hoy / ayer) */}
      {forgotStep !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl dark:border dark:border-slate-600 dark:bg-slate-800">
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Corrección de fichaje
              </p>
              <button
                type="button"
                onClick={resetForgotModal}
                className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Cerrar
              </button>
            </div>

            {forgotStep === "pick_day" && (
              <>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  ¿De qué día es el fichaje?
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Solo puedes corregir <strong>hoy</strong> o <strong>ayer</strong>. Otros días los
                  gestiona un responsable.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={hasEntryFor(today)}
                    onClick={() => {
                      setForgotError(null);
                      setForgotTargetDate(today);
                      setForgotStep("pick_type");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-50"
                  >
                    Hoy
                    {hasEntryFor(today) && (
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        Ya hay fichaje para hoy
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={hasEntryFor(ayer)}
                    onClick={() => {
                      setForgotError(null);
                      setForgotTargetDate(ayer);
                      setForgotMode("full_ayer");
                      setForgotStep("full_start");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-50"
                  >
                    Ayer
                    {hasEntryFor(ayer) && (
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        Ya hay fichaje para ayer
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}

            {forgotStep === "pick_type" && forgotTargetDate === today && (
              <>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  ¿Qué olvidaste?
                </h2>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError(null);
                      setForgotMode("solo_hoy");
                      setForgotStep("solo_time");
                    }}
                    className="w-full rounded-xl bg-agro-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    Solo la entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError(null);
                      setForgotMode("full_hoy");
                      setForgotStep("full_start");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-50"
                  >
                    Toda la jornada
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotTargetDate(null);
                      setForgotStep("pick_day");
                    }}
                    className="mt-1 text-xs text-slate-500 underline underline-offset-2"
                  >
                    Atrás
                  </button>
                </div>
              </>
            )}

            {forgotStep === "solo_time" && (
              <>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  ¿A qué hora empezaste?
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Se registrará una entrada manual. La jornada quedará abierta hasta que fichés la
                  salida.
                </p>
                <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Hora de entrada
                  <input
                    type="time"
                    value={forgotSoloTime}
                    onChange={(e) => setForgotSoloTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base dark:border-slate-600 dark:bg-slate-900"
                  />
                </label>
                {forgotError && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{forgotError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError(null);
                      setForgotStep("pick_type");
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium dark:border-slate-500"
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={submitForgotSoloEntrada}
                    className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Guardar entrada
                  </button>
                </div>
              </>
            )}

            {forgotStep === "full_start" && (
              <>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  ¿A qué hora empezaste?
                </h2>
                <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Hora de inicio
                  <input
                    type="time"
                    value={forgotFullStart}
                    onChange={(e) => setForgotFullStart(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base dark:border-slate-600 dark:bg-slate-900"
                  />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError(null);
                      if (forgotMode === "full_ayer") {
                        setForgotMode(null);
                        setForgotTargetDate(null);
                        setForgotStep("pick_day");
                      } else {
                        setForgotStep("pick_type");
                      }
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium dark:border-slate-500"
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError(null);
                      setForgotStep("full_end");
                    }}
                    className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Siguiente
                  </button>
                </div>
              </>
            )}

            {forgotStep === "full_end" && (
              <>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  ¿A qué hora terminaste?
                </h2>
                <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Hora de fin
                  <input
                    type="time"
                    value={forgotFullEnd}
                    onChange={(e) => setForgotFullEnd(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base dark:border-slate-600 dark:bg-slate-900"
                  />
                </label>
                {forgotError && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{forgotError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError(null);
                      setForgotStep("full_start");
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium dark:border-slate-500"
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError(null);
                      setForgotStep("full_rest");
                    }}
                    className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Siguiente
                  </button>
                </div>
              </>
            )}

            {forgotStep === "full_rest" && (
              <>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  ¿Paraste para comer o descansar?
                </h2>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError(null);
                      submitForgotJornadaCompleta(0);
                    }}
                    className="w-full rounded-xl bg-agro-600 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError(null);
                      setForgotFullHadBreak(true);
                      setForgotFullBreakMins(30);
                      setForgotBreakOtro(false);
                      setForgotFullBreakCustom("");
                      setForgotStep("full_rest_amount");
                    }}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-600"
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotStep("full_end")}
                    className="mt-1 text-xs text-slate-500 underline"
                  >
                    Atrás
                  </button>
                </div>
              </>
            )}

            {forgotStep === "full_rest_amount" && (
              <>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  ¿Cuánto tiempo?
                </h2>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {([30, 60, 120] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setForgotBreakOtro(false);
                        setForgotFullBreakMins(m);
                      }}
                      className={`rounded-xl px-2 py-2 text-xs font-semibold ${
                        !forgotBreakOtro && forgotFullBreakMins === m
                          ? "bg-agro-600 text-white"
                          : "border border-slate-200 dark:border-slate-600"
                      }`}
                    >
                      {m === 30 ? "30 min" : m === 60 ? "1 h" : "2 h"}
                    </button>
                  ))}
                </div>
                <div
                  className={`mt-2 rounded-xl border p-2 ${
                    forgotBreakOtro ? "border-agro-500 bg-agro-50/50 dark:bg-agro-900/20" : "border-slate-200 dark:border-slate-600"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase text-slate-500">Otro</span>
                  <input
                    type="text"
                    placeholder="Ej. 45 min, 1h30…"
                    value={forgotFullBreakCustom}
                    onChange={(e) => {
                      setForgotBreakOtro(true);
                      setForgotFullBreakCustom(e.target.value);
                    }}
                    onFocus={() => setForgotBreakOtro(true)}
                    className="mt-1 w-full bg-transparent text-sm outline-none dark:text-slate-100"
                  />
                </div>
                {forgotError && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{forgotError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError(null);
                      setForgotStep("full_rest");
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-500"
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => submitForgotJornadaCompleta()}
                    className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Registrar jornada
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
                      setRestClockHour(0);
                      setRestClockMinute(30);
                      setRestClockPhase("hour");
                      setAskAmountError(null);
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
                  Usa el reloj: elige primero las <strong>horas</strong> y luego los{" "}
                  <strong>minutos</strong> (cada 5 min).
                </p>
                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-2 py-3 dark:border-slate-600 dark:bg-slate-800/80">
                  <BreakDurationClock
                    phase={restClockPhase}
                    hoursSel={restClockHour}
                    minutesSel={restClockMinute}
                    onPhaseChange={setRestClockPhase}
                    onHourChange={(h) => {
                      setRestClockHour(h);
                      setAskAmountError(null);
                    }}
                    onMinuteChange={(m) => {
                      setRestClockMinute(m);
                      setAskAmountError(null);
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
                        onClick={() => {
                          if (restAnswerHadBreak) {
                            const { h, m } = minutesToClockParts(restMinutes);
                            setRestClockHour(h);
                            setRestClockMinute(m);
                            setRestClockPhase("hour");
                            setAskAmountError(null);
                            setRestModalStep("askAmount");
                          } else {
                            setRestModalStep("askRest");
                          }
                        }}
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

