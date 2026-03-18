"use client";

import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE } from "@/types";

// --- Tipos y helpers locales (mock) ---

/** Motivo de imputación del registro horario. */
export type TimeEntryRazon =
  | "imputacion_normal"
  | "imputacion_manual_error"
  | "ausencia_vacaciones"
  | "ausencia_baja";

const RAZON_LABELS: Record<TimeEntryRazon, string> = {
  imputacion_normal: "Imputación normal",
  imputacion_manual_error: "Imputación manual (RRHH)",
  ausencia_vacaciones: "Vacaciones",
  ausencia_baja: "Baja / ausencia",
};

function isAusenciaRazon(r: TimeEntryRazon | undefined): boolean {
  return r === "ausencia_vacaciones" || r === "ausencia_baja";
}

function formatRazon(razon: TimeEntryRazon | undefined): string {
  if (razon && razon in RAZON_LABELS) return RAZON_LABELS[razon as TimeEntryRazon];
  return RAZON_LABELS.imputacion_normal;
}

/** Emails demo por trabajador (hasta que el API devuelva `lastModifiedBy*`). */
const MOCK_APP_USER_EMAIL_BY_WORKER: Record<number, string> = {
  1: "juan.perez@empresa.demo",
  2: "pedro.garcia@empresa.demo",
  3: "luis.lopez@empresa.demo",
  4: "ana.martinez@empresa.demo",
};
const MOCK_RRHH_LAST_MODIFIER = "rrhh@empresa.demo";

function formatLastModifiedByUser(
  e: TimeEntryMock,
  opts?: { sessionEmail?: string | null }
): string {
  const name = e.lastModifiedByName?.trim();
  const mail = e.lastModifiedByEmail?.trim();
  if (name && mail) return `${name} · ${mail}`;
  if (mail) return mail;
  if (name) return name;
  const ses = opts?.sessionEmail?.trim();
  if (ses) return ses;
  return MOCK_APP_USER_EMAIL_BY_WORKER[e.workerId] ?? "—";
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
  /** Salida indicada a posteriori (ej. olvidó fichar salida el día del registro). */
  salidaManual?: boolean;
  /** Usuario de la app que guardó por último (email). Lo enviará el back; mock en demo. */
  lastModifiedByEmail?: string | null;
  /** Nombre para mostrar del último editor (opcional, API). */
  lastModifiedByName?: string | null;
  /** Hora de entrada antes de la última modificación (UTC ISO). Mock / API. */
  previousCheckInUtc?: string | null;
  /** Hora de salida antes de la última modificación (null = sin salida registrada). */
  previousCheckOutUtc?: string | null;
  /** Nota opcional del administrador al corregir horario. */
  edicionNotaAdmin?: string | null;
}

function formatTiempoAnterior(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—";
  return formatTimeLocal(iso);
}

function yesterdayISO() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function localCalendarISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localCalendarISO(d);
}

/** Día de hoy en calendario local del dispositivo (evita desfase UTC vs España). */
function localTodayISO(): string {
  return localCalendarISO(new Date());
}

/** Sábado o domingo (calendario local) para una fecha YYYY-MM-DD. */
function workDateIsWeekend(workDate: string): boolean {
  const [y, m, d] = workDate.split("-").map(Number);
  if (!y || !m || !d) return false;
  const day = new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
  return day === 0 || day === 6;
}

function workDateWithinLastNDays(workDate: string, n: number, ref: Date = new Date()): boolean {
  const end = localCalendarISO(ref);
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - (n - 1), 12, 0, 0, 0);
  const startStr = localCalendarISO(start);
  return workDate >= startStr && workDate <= end;
}

function utcToLocalHHMM(utcIso: string): string {
  const d = new Date(utcIso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

/** Minutos entre hora de entrada y salida (mismo criterio que al guardar la jornada). */
function minutesGrossWorkDay(workDate: string, startHM: string, endHM: string): number {
  const inIso = dateTimeLocalToUtcIso(workDate, startHM);
  const outIso = checkoutLocalIsoAfterCheckin(workDate, inIso, endHM);
  return Math.round((new Date(outIso).getTime() - new Date(inIso).getTime()) / 60000);
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

function parseHHMM(hm: string): { h: number; m: number } {
  const parts = hm.split(":");
  const h = Math.min(23, Math.max(0, parseInt(parts[0] ?? "0", 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(parts[1] ?? "0", 10) || 0));
  return { h, m };
}

function toHHMM(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);
const BREAK_DURATION_HOURS = Array.from({ length: 9 }, (_, i) => i);

function formatMinutesShort(totalMinutes: number | null): string {
  if (totalMinutes === null || totalMinutes <= 0) return "0 min";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Hora en 24 h: dos combos (horas + minutos), sin AM/PM. */
function TimeSelect24h({
  value,
  onChange,
  idPrefix,
}: {
  value: string;
  onChange: (hm: string) => void;
  idPrefix: string;
}) {
  const { h, m } = parseHHMM(value);
  const sel =
    "mt-1 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-1 focus:ring-agro-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 sm:gap-3">
      <div className="min-w-[7rem] flex-1">
        <label
          htmlFor={`${idPrefix}-h`}
          className="text-xs font-medium text-slate-600 dark:text-slate-400"
        >
          Horas
        </label>
        <select
          id={`${idPrefix}-h`}
          className={sel}
          value={h}
          onChange={(e) => onChange(toHHMM(parseInt(e.target.value, 10), m))}
        >
          {HOURS_24.map((hr) => (
            <option key={hr} value={hr}>
              {String(hr).padStart(2, "0")}
            </option>
          ))}
        </select>
      </div>
      <span
        className="hidden pb-2 text-xl font-bold text-slate-400 sm:inline"
        aria-hidden
      >
        :
      </span>
      <div className="min-w-[7rem] flex-1">
        <label
          htmlFor={`${idPrefix}-m`}
          className="text-xs font-medium text-slate-600 dark:text-slate-400"
        >
          Minutos
        </label>
        <select
          id={`${idPrefix}-m`}
          className={sel}
          value={m}
          onChange={(e) => onChange(toHHMM(h, parseInt(e.target.value, 10)))}
        >
          {MINUTES_60.map((mn) => (
            <option key={mn} value={mn}>
              {String(mn).padStart(2, "0")}
            </option>
          ))}
        </select>
      </div>
      <p className="w-full text-center text-xs text-slate-500 dark:text-slate-400 sm:w-auto sm:pb-2">
        <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
          {toHHMM(h, m)}
        </span>
        <span className="ml-1">(24 h)</span>
      </p>
    </div>
  );
}

/** Duración de descanso: horas (0–8) + minutos (0–59). */
function BreakDurationCombos({
  hours,
  minutes,
  onHoursChange,
  onMinutesChange,
  onUserEdit,
  idPrefix,
}: {
  hours: number;
  minutes: number;
  onHoursChange: (h: number) => void;
  onMinutesChange: (m: number) => void;
  onUserEdit: () => void;
  idPrefix: string;
}) {
  const sel =
    "mt-1 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
  const totalMin = hours * 60 + minutes;
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 sm:gap-3">
      <div className="min-w-[6.5rem] flex-1">
        <label
          htmlFor={`${idPrefix}-bh`}
          className="text-xs font-medium text-slate-600 dark:text-slate-400"
        >
          Horas
        </label>
        <select
          id={`${idPrefix}-bh`}
          className={sel}
          value={hours}
          onChange={(e) => {
            onUserEdit();
            onHoursChange(parseInt(e.target.value, 10));
          }}
        >
          {BREAK_DURATION_HOURS.map((hr) => (
            <option key={hr} value={hr}>
              {hr} h
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[6.5rem] flex-1">
        <label
          htmlFor={`${idPrefix}-bm`}
          className="text-xs font-medium text-slate-600 dark:text-slate-400"
        >
          Minutos
        </label>
        <select
          id={`${idPrefix}-bm`}
          className={sel}
          value={minutes}
          onChange={(e) => {
            onUserEdit();
            onMinutesChange(parseInt(e.target.value, 10));
          }}
        >
          {MINUTES_60.map((mn) => (
            <option key={mn} value={mn}>
              {String(mn).padStart(2, "0")}
            </option>
          ))}
        </select>
      </div>
      <p className="w-full text-center text-xs text-slate-600 dark:text-slate-400">
        Descanso elegido:{" "}
        <span className="font-semibold text-rose-800 dark:text-rose-300">
          {formatMinutesShort(totalMin)}
        </span>
      </p>
    </div>
  );
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

/** Fecha y hora local de la última modificación del registro (API: updatedAt). */
function formatFechaModificacionUtc(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
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

/** Minutos trabajados efectivos (bruto − descanso) para un registro cerrado. */
function effectiveWorkMinutesEntry(e: TimeEntryMock): number {
  if (isAusenciaRazon(e.razon)) return 0;
  const gross = diffDurationMinutes(e.checkInUtc, e.checkOutUtc);
  if (gross === null) return 0;
  return Math.max(0, gross - (e.breakMinutes ?? 0));
}

/** Mes actual en calendario local (YYYY-MM). */
function currentMonthLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Últimos `n` meses para el desplegable (valor YYYY-MM, etiqueta en español). */
function monthSelectOptions(n = 12): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const raw = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    out.push({ value, label });
  }
  return out;
}

/** Dona: imputado (verde), falta (gris), extra (coral). Estilo tipo gráfico circular con leyenda. */
function HorasMensualesDonut({
  horasImputadoHastaTope,
  horasFalta,
  horasExtra,
  horasObjetivo,
  horasImputadasTotal,
  registrosEnPeriodo,
}: {
  horasImputadoHastaTope: number;
  horasFalta: number;
  horasExtra: number;
  horasObjetivo: number;
  horasImputadasTotal: number;
  registrosEnPeriodo: number;
}) {
  const t = horasImputadoHastaTope + horasFalta + horasExtra;
  const safe = t > 0 ? t : 1;
  const p1 = (horasImputadoHastaTope / safe) * 100;
  const p2 = (horasFalta / safe) * 100;
  const p3 = (horasExtra / safe) * 100;
  const a1 = p1;
  const a2 = a1 + p2;
  let gradient: string;
  /* Paleta app; verdes un poco más saturados para leer bien sobre fondo blanco */
  const cImp = "#16a34a";
  const cFalta = "#94a3b8";
  const cExtra = "#d97706";
  if (horasExtra > 0.01 && horasFalta > 0.01) {
    gradient = `conic-gradient(from -90deg, ${cImp} 0% ${a1}%, ${cFalta} ${a1}% ${a2}%, ${cExtra} ${a2}% 100%)`;
  } else if (horasExtra > 0.01) {
    gradient = `conic-gradient(from -90deg, ${cImp} 0% ${a1}%, ${cExtra} ${a1}% 100%)`;
  } else if (horasFalta > 0.01) {
    gradient = `conic-gradient(from -90deg, ${cImp} 0% ${a1}%, ${cFalta} ${a1}% 100%)`;
  } else {
    gradient = `conic-gradient(from -90deg, ${cImp} 0% 100%)`;
  }
  const pctVsObjetivo =
    horasObjetivo > 0
      ? Math.round((horasImputadasTotal / horasObjetivo) * 1000) / 10
      : 0;

  const leyenda: { color: string; label: string; h: number }[] = [
    { color: cImp, label: "Horas imputadas (hasta tope)", h: horasImputadoHastaTope },
    { color: cFalta, label: "Falta para objetivo", h: horasFalta },
  ];
  if (horasExtra > 0.01) {
    leyenda.push({ color: cExtra, label: "Horas extra", h: horasExtra });
  }

  return (
    <div className="equipo-dona-card flex min-h-[26rem] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm sm:min-h-[27rem] sm:px-4 sm:py-5 lg:h-full lg:min-h-0 dark:border-slate-600 dark:bg-white">
      <p className="mb-3 min-h-[4rem] text-center text-sm font-semibold leading-snug text-slate-800 sm:mb-4 sm:min-h-[2.75rem] dark:text-slate-900">
        Distribución del mes (objetivo vs imputado)
      </p>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 sm:gap-5">
        <div className="relative mx-auto h-40 w-40 shrink-0 sm:h-44 sm:w-44">
          <div
            className="h-full w-full rounded-full shadow-md ring-1 ring-slate-200/80"
            style={{
              background: gradient,
              mask: "radial-gradient(transparent 56%, black 57%)",
              WebkitMask: "radial-gradient(transparent 56%, black 57%)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
            <span className="text-2xl font-bold leading-none tabular-nums text-agro-800 sm:text-3xl dark:text-agro-900">
              {pctVsObjetivo}%
            </span>
            <span className="mt-1 max-w-[6rem] text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-600">
              {pctVsObjetivo > 100 ? "sobre el objetivo" : "del objetivo cubierto"}
            </span>
          </div>
        </div>
        <ul className="mt-auto w-full min-w-0 max-w-full space-y-0 px-0.5 text-sm sm:px-0">
          <li className="flex items-start justify-between gap-3 border-b border-slate-200 py-2.5 dark:border-slate-200">
            <span className="flex min-w-0 flex-1 items-start gap-2.5 pt-0.5">
              <span
                className="mt-0.5 h-3 w-3 shrink-0 rounded-sm border-2 border-slate-500 bg-slate-100 shadow-sm dark:border-slate-400 dark:bg-slate-200"
                aria-hidden
              />
              <span className="text-[13px] font-medium leading-snug text-slate-700 dark:text-slate-800">
                Objetivo teórico
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-base font-bold tabular-nums leading-tight text-slate-900">
                {horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </span>
              <span className="mt-0.5 block min-h-[14px] text-[10px] text-slate-500 dark:text-slate-600">
                tope del mes
              </span>
            </span>
          </li>
          {leyenda.map((item, idx) => (
            <li
              key={item.label}
              className={`flex items-start justify-between gap-3 py-2.5 ${
                idx < leyenda.length - 1 ? "border-b border-slate-200 dark:border-slate-200" : ""
              }`}
            >
              <span className="flex min-w-0 flex-1 items-start gap-2.5 pt-0.5">
                <span
                  className="mt-0.5 h-3 w-3 shrink-0 rounded-sm shadow-sm ring-1 ring-slate-200/80"
                  style={{ backgroundColor: item.color }}
                  aria-hidden
                />
                <span className="text-[13px] leading-snug text-slate-600 dark:text-slate-700">
                  {item.label}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-base font-bold tabular-nums leading-tight text-slate-900">
                  {item.h.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
                </span>
                <span className="mt-0.5 block min-h-[14px] text-[10px] text-slate-500">&nbsp;</span>
              </span>
            </li>
          ))}
          {registrosEnPeriodo > 0 && (
            <li className="border-t border-slate-200 pt-2.5 text-center text-[10px] font-medium text-slate-500 dark:border-slate-200">
              {registrosEnPeriodo} registro{registrosEnPeriodo !== 1 ? "s" : ""} en el periodo
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

/** Dona: fichaje correcto vs manual vs hueco laboral sin imputar (8 h por día). */
function FichajeTipoDonut({
  horasNormal,
  horasManual,
  horasSinImputar,
  registrosNormal,
  registrosManual,
  diasSinImputar,
}: {
  horasNormal: number;
  horasManual: number;
  horasSinImputar: number;
  registrosNormal: number;
  registrosManual: number;
  diasSinImputar: number;
}) {
  const cOk = "#16a34a";
  const cMan = "#d97706";
  const cGap = "#dc2626";
  const t = horasNormal + horasManual + horasSinImputar;
  const safe = t > 0.01 ? t : 1;
  const p1 = (horasNormal / safe) * 100;
  const p2 = ((horasNormal + horasManual) / safe) * 100;
  let gradient: string;
  if (t <= 0.01) {
    gradient = "conic-gradient(from -90deg, #e2e8f0 0% 100%)";
  } else if (horasSinImputar <= 0.01 && horasManual <= 0.01) {
    gradient = `conic-gradient(from -90deg, ${cOk} 0% 100%)`;
  } else if (horasSinImputar <= 0.01) {
    gradient = `conic-gradient(from -90deg, ${cOk} 0% ${p1}%, ${cMan} ${p1}% 100%)`;
  } else if (horasManual <= 0.01 && horasNormal <= 0.01) {
    gradient = `conic-gradient(from -90deg, ${cGap} 0% 100%)`;
  } else {
    gradient = `conic-gradient(from -90deg, ${cOk} 0% ${p1}%, ${cMan} ${p1}% ${p2}%, ${cGap} ${p2}% 100%)`;
  }
  const imputadas = horasNormal + horasManual;
  const pctImputadoVsPotencial =
    t > 0.01 ? Math.round((imputadas / t) * 1000) / 10 : 0;
  const totalReg = registrosNormal + registrosManual;

  return (
    <div className="equipo-dona-card flex min-h-[26rem] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm sm:min-h-[27rem] sm:px-4 sm:py-5 lg:h-full lg:min-h-0 dark:border-slate-600 dark:bg-white">
      <p className="mb-3 min-h-[4rem] text-center text-sm font-semibold leading-snug text-slate-800 sm:mb-4 sm:min-h-[2.75rem] dark:text-slate-900">
        Tipo de fichaje (incl. días sin imputar)
      </p>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 sm:gap-5">
        <div className="relative mx-auto h-40 w-40 shrink-0 sm:h-44 sm:w-44">
          <div
            className="h-full w-full rounded-full shadow-md ring-1 ring-slate-200/80"
            style={{
              background: gradient,
              mask: "radial-gradient(transparent 56%, black 57%)",
              WebkitMask: "radial-gradient(transparent 56%, black 57%)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
            {t > 0.01 ? (
              <>
                <span className="text-2xl font-bold leading-none tabular-nums text-agro-800 sm:text-3xl dark:text-agro-900">
                  {pctImputadoVsPotencial}%
                </span>
                <span className="mt-1 max-w-[7rem] text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-600">
                  horas imputadas vs potencial
                </span>
              </>
            ) : (
              <span className="flex min-h-[2.75rem] max-w-[6rem] items-center justify-center px-2 text-center text-[11px] font-medium leading-snug text-slate-500">
                Sin datos en el filtro
              </span>
            )}
          </div>
        </div>
        <ul className="mt-auto w-full min-w-0 max-w-full space-y-0 px-0.5 text-sm sm:px-0">
          <li className="flex items-start justify-between gap-3 border-b border-slate-200 py-2.5 dark:border-slate-200">
            <span className="flex min-w-0 flex-1 items-start gap-2.5 pt-0.5">
              <span
                className="mt-0.5 h-3 w-3 shrink-0 rounded-sm shadow-sm ring-1 ring-slate-200/80"
                style={{ backgroundColor: cOk }}
                aria-hidden
              />
              <span className="text-[13px] leading-snug text-slate-600 dark:text-slate-700">
                Fichaje correcto
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-base font-bold tabular-nums leading-tight text-slate-900">
                {horasNormal.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </span>
              <span className="mt-0.5 block min-h-[14px] text-[10px] text-slate-500">
                {registrosNormal} reg.
              </span>
            </span>
          </li>
          <li className="flex items-start justify-between gap-3 border-b border-slate-200 py-2.5 dark:border-slate-200">
            <span className="flex min-w-0 flex-1 items-start gap-2.5 pt-0.5">
              <span
                className="mt-0.5 h-3 w-3 shrink-0 rounded-sm shadow-sm ring-1 ring-slate-200/80"
                style={{ backgroundColor: cMan }}
                aria-hidden
              />
              <span className="text-[13px] leading-snug text-slate-600 dark:text-slate-700">
                Manual / corrección
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-base font-bold tabular-nums leading-tight text-slate-900">
                {horasManual.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </span>
              <span className="mt-0.5 block min-h-[14px] text-[10px] text-slate-500">
                {registrosManual} reg.
              </span>
            </span>
          </li>
          <li className="flex items-start justify-between gap-3 py-2.5">
            <span className="flex min-w-0 flex-1 items-start gap-2.5 pt-0.5">
              <span
                className="mt-0.5 h-3 w-3 shrink-0 rounded-sm shadow-sm ring-1 ring-red-300/80"
                style={{ backgroundColor: cGap }}
                aria-hidden
              />
              <span className="text-[13px] leading-snug text-slate-600 dark:text-slate-700">
                Laborables sin imputar (8 h/día)
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-base font-bold tabular-nums leading-tight text-red-700 dark:text-red-400">
                {horasSinImputar.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </span>
              <span className="mt-0.5 block min-h-[14px] text-[10px] text-slate-500">
                {diasSinImputar} día{diasSinImputar !== 1 ? "s" : ""}
              </span>
            </span>
          </li>
          {(totalReg > 0 || diasSinImputar > 0) && (
            <li className="border-t border-slate-200 pt-2.5 text-center text-[10px] font-medium text-slate-500 dark:border-slate-200">
              {totalReg} registro{totalReg !== 1 ? "s" : ""} imputados
              {diasSinImputar > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {diasSinImputar} sin imputar
                  </span>
                </>
              ) : null}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

/** Encabezado: cómo se calcula el objetivo del mes (el detalle vs imputado va en las donas). */
function EquipoObjetivoMesEncabezado({
  diasLaborables,
  personasEnObjetivo,
  horasObjetivo,
  filtroTodasPersonas,
}: {
  diasLaborables: number;
  personasEnObjetivo: number;
  horasObjetivo: number;
  filtroTodasPersonas: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-agro-700 dark:text-agro-400">
        Objetivo del mes
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        <strong>{diasLaborables}</strong> días laborables (lun–vie) × <strong>8 h</strong>
        {filtroTodasPersonas ? (
          <>
            {" "}
            × <strong>{personasEnObjetivo}</strong> personas
          </>
        ) : null}{" "}
        →{" "}
        <strong className="text-slate-800 dark:text-slate-100">
          {horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
        </strong>{" "}
        objetivo teórico.
      </p>
    </div>
  );
}

/**
 * Barra: tramo principal = tope laboral (verde imputado + gris falta);
 * tramo aparte en naranja = horas extra sobre el objetivo teórico.
 */
function EquipoBarraLaboralesExtra({
  horasObjetivo,
  horasImputadasLabor,
  horasFalta,
  horasExtra,
  horasImputadasTotal,
}: {
  horasObjetivo: number;
  horasImputadasLabor: number;
  horasFalta: number;
  horasExtra: number;
  horasImputadasTotal: number;
}) {
  const pctLabor =
    horasObjetivo > 0.01
      ? Math.min(100, (horasImputadasLabor / horasObjetivo) * 100)
      : 0;
  const tieneExtra = horasExtra > 0.05;
  const extraAnchoPct = tieneExtra
    ? Math.min(
        44,
        Math.max(
          18,
          Math.round((horasExtra / Math.max(horasObjetivo, 1)) * 72 + 16)
        )
      )
    : 0;

  return (
    <div className="mt-4 min-w-0 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
        Imputación vs tope laboral
      </p>
      <div className="flex w-full min-w-0 items-end gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-600 dark:text-slate-400">
            <span>
              <span className="font-semibold text-agro-700 dark:text-agro-400">Laborales</span> (tope{" "}
              {horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h)
            </span>
            <span className="shrink-0 tabular-nums">
              {horasImputadasLabor.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h /{" "}
              {horasObjetivo.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
            </span>
          </div>
          <div
            className="relative h-9 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-200/95 shadow-inner dark:border-slate-600 dark:bg-slate-700/90"
            role="img"
            aria-label={`Horas dentro del tope: ${horasImputadasLabor.toFixed(1)} de ${horasObjetivo.toFixed(1)} horas; falta ${horasFalta.toFixed(1)} horas`}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-agro-500 to-emerald-500 transition-[width] duration-500"
              style={{ width: `${pctLabor}%` }}
            />
          </div>
          {horasFalta > 0.05 && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Gris: faltan{" "}
              <strong className="text-slate-700 dark:text-slate-300">
                {horasFalta.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </strong>{" "}
              para cubrir el tope
            </p>
          )}
        </div>
        {tieneExtra && (
          <div
            className="flex shrink-0 flex-col space-y-1"
            style={{
              width: `${extraAnchoPct}%`,
              minWidth: "5.5rem",
              maxWidth: "11rem",
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Horas extra
            </div>
            <div
              className="flex h-9 items-center justify-center rounded-full border-2 border-amber-600 bg-gradient-to-b from-amber-400 to-amber-600 px-2 text-center shadow-md dark:border-amber-500 dark:from-amber-500 dark:to-amber-700"
              role="img"
              aria-label={`Horas extra: ${horasExtra.toFixed(1)} horas por encima del objetivo`}
            >
              <span className="text-sm font-extrabold tabular-nums text-white drop-shadow-sm">
                +{horasExtra.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
              </span>
            </div>
          </div>
        )}
      </div>
      <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        Total imputado en el periodo:{" "}
        <strong className="text-slate-700 dark:text-slate-200">
          {horasImputadasTotal.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h
        </strong>
        {tieneExtra ? (
          <>
            {" "}
            (= laborales hasta tope +{" "}
            <span className="font-semibold text-amber-700 dark:text-amber-400">extra</span>)
          </>
        ) : null}
        .
      </p>
    </div>
  );
}

/** Lunes a viernes en un mes de calendario local (YYYY-MM). */
function weekdaysInCalendarMonth(yyyyMm: string): number {
  const parts = yyyyMm.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  if (!y || !m || m < 1 || m > 12) return 0;
  const lastDay = new Date(y, m, 0).getDate();
  let n = 0;
  for (let d = 1; d <= lastDay; d++) {
    const day = new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
    if (day !== 0 && day !== 6) n++;
  }
  return n;
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

/**
 * Demo fichador: si es true, ayer queda con entrada sin salida → letrero rojo y bloqueo hasta completar.
 * Pon false para probar el flujo normal (ayer cerrado).
 */
const MOCK_DEMO_YESTERDAY_SIN_CERRAR = true;

/** Último viernes ya pasado (si hoy es viernes, el de hace 7 días). Siempre laborable. */
function dateOfLastFriday(from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12, 0, 0, 0);
  const day = d.getDay();
  let daysBack: number;
  if (day === 5) daysBack = 7;
  else if (day === 6) daysBack = 1;
  else if (day === 0) daysBack = 2;
  else daysBack = day + 2;
  d.setDate(d.getDate() - daysBack);
  return d;
}

/** Último lunes ya pasado (si hoy es lunes, el de hace 7 días). */
function dateOfLastMonday(from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12, 0, 0, 0);
  const day = d.getDay();
  let daysBack: number;
  if (day === 1) daysBack = 7;
  else if (day === 0) daysBack = 6;
  else daysBack = day - 1;
  d.setDate(d.getDate() - daysBack);
  return d;
}

// Genera unos registros de ejemplo (sin sábado ni domingo en histórico demo)
function createInitialMockEntries(): TimeEntryMock[] {
  const now = new Date();
  const baseWorkerId = 1;
  const baseCreatedBy = 1;

  const makeClosedEntry = (
    calendarDay: Date,
    id: number,
    startHour: number,
    endHour: number,
    breakMinutes: number,
    razon: TimeEntryRazon = "imputacion_normal",
    lastModifiedByEmail?: string | null
  ): TimeEntryMock => {
    const d = new Date(
      calendarDay.getFullYear(),
      calendarDay.getMonth(),
      calendarDay.getDate(),
      12,
      0,
      0,
      0
    );
    const workDate = localCalendarISO(d);
    const start = new Date(d);
    start.setHours(startHour, 0, 0, 0);
    const end = new Date(d);
    end.setHours(endHour, 0, 0, 0);
    return {
      id,
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
      lastModifiedByEmail:
        lastModifiedByEmail ??
        (razon === "imputacion_manual_error"
          ? MOCK_RRHH_LAST_MODIFIER
          : MOCK_APP_USER_EMAIL_BY_WORKER[baseWorkerId] ?? "usuario@empresa.demo"),
    };
  };

  /** Ayer (calendario local): solo entrada, olvidó fichar salida — para probar el aviso rojo. */
  const makeAyerEntradaSinSalida = (): TimeEntryMock => {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    const workDate = localCalendarISO(d);
    const start = new Date(d);
    start.setHours(8, 5, 0, 0);
    const startIso = start.toISOString();
    return {
      id: 101,
      workerId: baseWorkerId,
      workDate,
      checkInUtc: startIso,
      checkOutUtc: null,
      isEdited: false,
      createdAtUtc: startIso,
      createdBy: baseCreatedBy,
      updatedAtUtc: null,
      updatedBy: null,
      breakMinutes: 0,
      razon: "imputacion_normal",
      lastModifiedByEmail: MOCK_APP_USER_EMAIL_BY_WORKER[baseWorkerId] ?? "usuario@empresa.demo",
    };
  };

  const viernesPasado = dateOfLastFriday(now);
  const lunesPasado = dateOfLastMonday(now);
  const ayerStr = localYesterdayISO();

  const historialAntiguo: TimeEntryMock[] = [];
  // No duplicar el mismo día que “ayer sin cerrar” (entrada abierta)
  if (!(MOCK_DEMO_YESTERDAY_SIN_CERRAR && localCalendarISO(lunesPasado) === ayerStr)) {
    historialAntiguo.push({
      ...makeClosedEntry(lunesPasado, 202, 8, 16, 60, "imputacion_normal", "maria.garcia@empresa.demo"),
      lastModifiedByName: "María García",
    });
  }
  historialAntiguo.push(
    makeClosedEntry(
      viernesPasado,
      201,
      8,
      17,
      30,
      "imputacion_normal",
      MOCK_RRHH_LAST_MODIFIER
    )
  );

  if (MOCK_DEMO_YESTERDAY_SIN_CERRAR) {
    return [makeAyerEntradaSinSalida(), ...historialAntiguo];
  }

  return [...historialAntiguo];
}

/** Nombres demo para la vista admin (equipo). */
const MOCK_WORKERS_FICHA: { id: number; name: string }[] = [
  { id: 1, name: "Juan Pérez" },
  { id: 2, name: "Pedro García" },
  { id: 3, name: "Luis López" },
  { id: 4, name: "Ana Martínez" },
];

function workerNameById(id: number): string {
  return MOCK_WORKERS_FICHA.find((w) => w.id === id)?.name ?? `Trabajador #${id}`;
}

function csvEscapeSemicolon(field: string): string {
  const s = String(field ?? "");
  if (/[;\r\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

type EquipoTablaFila =
  | { kind: "registro"; e: TimeEntryMock }
  | { kind: "noLaboral"; workerId: number; workDate: string }
  | { kind: "sinImputar"; workerId: number; workDate: string };

const RAZON_NO_LABORAL = "Fin de semana (no laboral)";
const RAZON_SIN_IMPUTAR = "Sin imputar (día laboral)";

/** CSV de la vista calendario (incl. no laboral y sin imputar). */
function buildEquipoTableCsvFilas(filas: EquipoTablaFila[]): string {
  const sep = ";";
  const headers = [
    "Persona",
    "Fecha",
    "Entrada",
    "Salida",
    "Entrada (antes)",
    "Salida (antes)",
    "Descanso",
    "Razón",
    "Modificado por",
    "Fecha modificación",
    "Duración",
  ];
  const headerLine = headers.map(csvEscapeSemicolon).join(sep);
  const dataLines = filas.map((f) => {
    const cells =
      f.kind === "registro"
        ? [
            workerNameById(f.e.workerId),
            formatDateES(f.e.workDate),
            isAusenciaRazon(f.e.razon) ? "—" : formatTimeLocal(f.e.checkInUtc),
            isAusenciaRazon(f.e.razon) ? "—" : formatTimeLocal(f.e.checkOutUtc),
            formatTiempoAnterior(f.e.previousCheckInUtc),
            formatTiempoAnterior(f.e.previousCheckOutUtc),
            isAusenciaRazon(f.e.razon) ? "—" : formatMinutesShort(f.e.breakMinutes ?? 0),
            formatRazon(f.e.razon),
            formatLastModifiedByUser(f.e),
            formatFechaModificacionUtc(f.e.updatedAtUtc),
            isAusenciaRazon(f.e.razon) ? "—" : formatMinutesShort(effectiveWorkMinutesEntry(f.e)),
          ]
        : f.kind === "noLaboral"
          ? [
              workerNameById(f.workerId),
              formatDateES(f.workDate),
              "—",
              "—",
              "—",
              "—",
              "—",
              RAZON_NO_LABORAL,
              "—",
              "—",
              "—",
            ]
          : [
              workerNameById(f.workerId),
              formatDateES(f.workDate),
              "—",
              "—",
              "—",
              "—",
              "—",
              RAZON_SIN_IMPUTAR,
              "—",
              "—",
              "—",
            ];
    return cells.map(csvEscapeSemicolon).join(sep);
  });
  return `\uFEFF${headerLine}\r\n${dataLines.join("\r\n")}`;
}

type EquipoSortKey =
  | "persona"
  | "fecha"
  | "entrada"
  | "salida"
  | "entradaAntes"
  | "salidaAntes"
  | "descanso"
  | "razon"
  | "modificado"
  | "fechaMod"
  | "duracion";

function compareEquipoRow(
  a: TimeEntryMock,
  b: TimeEntryMock,
  key: EquipoSortKey,
  asc: boolean
): number {
  const m = asc ? 1 : -1;
  const ts = (iso: string | null | undefined) =>
    iso ? new Date(iso).getTime() : Number.NaN;
  let cmp = 0;
  switch (key) {
    case "persona":
      cmp = workerNameById(a.workerId).localeCompare(workerNameById(b.workerId), "es", {
        sensitivity: "base",
      });
      break;
    case "fecha":
      cmp = a.workDate < b.workDate ? -1 : a.workDate > b.workDate ? 1 : 0;
      break;
    case "entrada":
      cmp = ts(a.checkInUtc) - ts(b.checkInUtc);
      break;
    case "salida": {
      const na = a.checkOutUtc == null;
      const nb = b.checkOutUtc == null;
      if (na && nb) cmp = 0;
      else if (na) cmp = 1;
      else if (nb) cmp = -1;
      else cmp = ts(a.checkOutUtc) - ts(b.checkOutUtc);
      break;
    }
    case "entradaAntes": {
      const na = !a.previousCheckInUtc;
      const nb = !b.previousCheckInUtc;
      if (na && nb) cmp = 0;
      else if (na) cmp = 1;
      else if (nb) cmp = -1;
      else cmp = ts(a.previousCheckInUtc) - ts(b.previousCheckInUtc);
      break;
    }
    case "salidaAntes": {
      const na = !a.previousCheckOutUtc;
      const nb = !b.previousCheckOutUtc;
      if (na && nb) cmp = 0;
      else if (na) cmp = 1;
      else if (nb) cmp = -1;
      else cmp = ts(a.previousCheckOutUtc) - ts(b.previousCheckOutUtc);
      break;
    }
    case "descanso":
      cmp = (a.breakMinutes ?? 0) - (b.breakMinutes ?? 0);
      break;
    case "razon":
      cmp = formatRazon(a.razon).localeCompare(formatRazon(b.razon), "es");
      break;
    case "modificado":
      cmp = formatLastModifiedByUser(a).localeCompare(formatLastModifiedByUser(b), "es", {
        sensitivity: "base",
      });
      break;
    case "fechaMod": {
      const ua = a.updatedAtUtc;
      const ub = b.updatedAtUtc;
      if (!ua && !ub) cmp = 0;
      else if (!ua) cmp = 1;
      else if (!ub) cmp = -1;
      else cmp = ts(ua) - ts(ub);
      break;
    }
    case "duracion":
      cmp = effectiveWorkMinutesEntry(a) - effectiveWorkMinutesEntry(b);
      break;
    default:
      cmp = 0;
  }
  if (Number.isNaN(cmp)) cmp = 0;
  if (cmp !== 0) return m * cmp;
  if (a.workDate !== b.workDate) return b.workDate.localeCompare(a.workDate);
  if (a.workerId !== b.workerId) return a.workerId - b.workerId;
  return a.id - b.id;
}

function sortEquipoRows(
  rows: TimeEntryMock[],
  key: EquipoSortKey,
  dir: "asc" | "desc"
): TimeEntryMock[] {
  const asc = dir === "asc";
  return [...rows].sort((a, b) => compareEquipoRow(a, b, key, asc));
}

/** Orden por defecto de la tabla (fecha ↓, luego persona). Tercer clic del ciclo de ordenación. */
function sortEquipoRowsOrigen(rows: TimeEntryMock[]): TimeEntryMock[] {
  return [...rows].sort((a, b) => {
    if (a.workDate !== b.workDate) return b.workDate.localeCompare(a.workDate);
    if (a.workerId !== b.workerId) return a.workerId - b.workerId;
    return a.id - b.id;
  });
}

function rankEquipoFilaKind(f: EquipoTablaFila): number {
  if (f.kind === "registro") return 0;
  if (f.kind === "sinImputar") return 1;
  return 2;
}

function sortEquipoFilasOrigen(filas: EquipoTablaFila[]): EquipoTablaFila[] {
  return [...filas].sort((a, b) => {
    const dA = a.kind === "registro" ? a.e.workDate : a.workDate;
    const dB = b.kind === "registro" ? b.e.workDate : b.workDate;
    if (dA !== dB) return dB.localeCompare(dA);
    const wA = a.kind === "registro" ? a.e.workerId : a.workerId;
    const wB = b.kind === "registro" ? b.e.workerId : b.workerId;
    if (wA !== wB) return wA - wB;
    return rankEquipoFilaKind(a) - rankEquipoFilaKind(b);
  });
}

function compareEquipoFila(
  a: EquipoTablaFila,
  b: EquipoTablaFila,
  key: EquipoSortKey,
  asc: boolean
): number {
  const m = asc ? 1 : -1;
  const ts = (iso: string | null | undefined) =>
    iso ? new Date(iso).getTime() : Number.NaN;
  const reg = (f: EquipoTablaFila) => (f.kind === "registro" ? f.e : null);
  const wid = (f: EquipoTablaFila) => (f.kind === "registro" ? f.e.workerId : f.workerId);
  const wd = (f: EquipoTablaFila) => (f.kind === "registro" ? f.e.workDate : f.workDate);
  const razonTxt = (f: EquipoTablaFila) => {
    if (f.kind === "registro") return formatRazon(f.e.razon);
    if (f.kind === "noLaboral") return RAZON_NO_LABORAL;
    return RAZON_SIN_IMPUTAR;
  };
  const modTxt = (f: EquipoTablaFila) =>
    f.kind === "registro" ? formatLastModifiedByUser(f.e) : "—";

  const eA = reg(a);
  const eB = reg(b);
  let cmp = 0;

  switch (key) {
    case "persona":
      cmp = workerNameById(wid(a)).localeCompare(workerNameById(wid(b)), "es", {
        sensitivity: "base",
      });
      break;
    case "fecha":
      cmp = wd(a) < wd(b) ? -1 : wd(a) > wd(b) ? 1 : 0;
      break;
    case "entrada":
      if (!eA && !eB) cmp = 0;
      else if (!eA) cmp = 1;
      else if (!eB) cmp = -1;
      else cmp = ts(eA.checkInUtc) - ts(eB.checkInUtc);
      break;
    case "salida":
      if (!eA && !eB) cmp = 0;
      else if (!eA) cmp = 1;
      else if (!eB) cmp = -1;
      else {
        const na = eA.checkOutUtc == null;
        const nb = eB.checkOutUtc == null;
        if (na && nb) cmp = 0;
        else if (na) cmp = 1;
        else if (nb) cmp = -1;
        else cmp = ts(eA.checkOutUtc) - ts(eB.checkOutUtc);
      }
      break;
    case "entradaAntes":
      if (!eA && !eB) cmp = 0;
      else if (!eA) cmp = 1;
      else if (!eB) cmp = -1;
      else {
        const pa = eA.previousCheckInUtc;
        const pb = eB.previousCheckInUtc;
        if (!pa && !pb) cmp = 0;
        else if (!pa) cmp = 1;
        else if (!pb) cmp = -1;
        else cmp = ts(pa) - ts(pb);
      }
      break;
    case "salidaAntes":
      if (!eA && !eB) cmp = 0;
      else if (!eA) cmp = 1;
      else if (!eB) cmp = -1;
      else {
        const pa = eA.previousCheckOutUtc;
        const pb = eB.previousCheckOutUtc;
        if (!pa && !pb) cmp = 0;
        else if (!pa) cmp = 1;
        else if (!pb) cmp = -1;
        else cmp = ts(pa) - ts(pb);
      }
      break;
    case "descanso": {
      const bA = eA ? (eA.breakMinutes ?? 0) : -1;
      const bB = eB ? (eB.breakMinutes ?? 0) : -1;
      cmp = bA - bB;
      break;
    }
    case "razon":
      cmp = razonTxt(a).localeCompare(razonTxt(b), "es");
      break;
    case "modificado":
      cmp = modTxt(a).localeCompare(modTxt(b), "es", { sensitivity: "base" });
      break;
    case "fechaMod": {
      const uA = eA?.updatedAtUtc;
      const uB = eB?.updatedAtUtc;
      if (!uA && !uB) cmp = 0;
      else if (!uA) cmp = 1;
      else if (!uB) cmp = -1;
      else cmp = ts(uA) - ts(uB);
      break;
    }
    case "duracion": {
      const dMa = eA ? effectiveWorkMinutesEntry(eA) : -1;
      const dMb = eB ? effectiveWorkMinutesEntry(eB) : -1;
      cmp = dMa - dMb;
      break;
    }
    default:
      cmp = 0;
  }
  if (Number.isNaN(cmp)) cmp = 0;
  if (cmp !== 0) return m * cmp;
  const dA = wd(a);
  const dB = wd(b);
  if (dA !== dB) return dB.localeCompare(dA);
  if (wid(a) !== wid(b)) return wid(a) - wid(b);
  return rankEquipoFilaKind(a) - rankEquipoFilaKind(b);
}

function sortEquipoFilas(
  filas: EquipoTablaFila[],
  key: EquipoSortKey,
  dir: "asc" | "desc"
): EquipoTablaFila[] {
  const asc = dir === "asc";
  return [...filas].sort((a, b) => compareEquipoFila(a, b, key, asc));
}

/**
 * Demo equipo: últimos 12 meses hasta **hoy** (sin días futuros).
 * ~90 % de días laborables imputados; resto sin registro (ej. baja).
 * Mezcla normal / manual. En producción vendrá del API.
 */
function createTeamHistorialDemo(): TimeEntryMock[] {
  const now = new Date();
  const list: TimeEntryMock[] = [];
  let nid = 1000;

  const pushTeamDay = (
    workerId: number,
    cal: Date,
    spec: {
      inHM: string;
      outHM: string;
      breakM: number;
      razon: TimeEntryRazon;
      prevInHM?: string | null;
      prevOutHM?: string | null;
    }
  ) => {
    const d = new Date(cal.getFullYear(), cal.getMonth(), cal.getDate(), 12, 0, 0, 0);
    const workDate = localCalendarISO(d);
    if (workDateIsWeekend(workDate)) return;
    const checkInUtc = dateTimeLocalToUtcIso(workDate, spec.inHM);
    const checkOutUtc = checkoutLocalIsoAfterCheckin(workDate, checkInUtc, spec.outHM);
    const manual = spec.razon === "imputacion_manual_error";
    const updatedAtUtc = manual
      ? new Date(new Date(checkOutUtc).getTime() + 2.5 * 3600 * 1000).toISOString()
      : checkOutUtc;
    const modMail = manual
      ? MOCK_RRHH_LAST_MODIFIER
      : MOCK_APP_USER_EMAIL_BY_WORKER[workerId] ?? `trabajador${workerId}@empresa.demo`;
    let previousCheckInUtc: string | null = null;
    let previousCheckOutUtc: string | null = null;
    if (manual) {
      if (spec.prevInHM) previousCheckInUtc = dateTimeLocalToUtcIso(workDate, spec.prevInHM);
      if (spec.prevOutHM) previousCheckOutUtc = dateTimeLocalToUtcIso(workDate, spec.prevOutHM);
    }
    list.push({
      id: nid++,
      workerId,
      workDate,
      checkInUtc,
      checkOutUtc,
      isEdited: manual,
      createdAtUtc: checkInUtc,
      createdBy: workerId,
      updatedAtUtc: updatedAtUtc,
      updatedBy: workerId,
      breakMinutes: spec.breakM,
      razon: spec.razon,
      lastModifiedByEmail: modMail,
      previousCheckInUtc,
      previousCheckOutUtc,
    });
  };

  const demoHash = (workerId: number, workDate: string): number => {
    const s = `${workDate}-w${workerId}`;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  };

  const todayStr = localCalendarISO(now);
  const todayYm = todayStr.slice(0, 7);
  const todayDay = parseInt(todayStr.slice(8, 10), 10);

  for (let mb = 0; mb < 12; mb++) {
    const ref = new Date(now.getFullYear(), now.getMonth() - mb, 1, 12, 0, 0, 0);
    const y = ref.getFullYear();
    const mon = ref.getMonth() + 1;
    const mesStr = `${y}-${String(mon).padStart(2, "0")}`;
    if (mesStr > todayYm) continue;

    const dim = new Date(y, mon, 0).getDate();
    const maxD = mesStr === todayYm ? Math.min(dim, todayDay) : dim;

    for (let d = 1; d <= maxD; d++) {
      const cal = new Date(y, mon - 1, d, 12, 0, 0, 0);
      const wdStr = localCalendarISO(cal);
      if (workDateIsWeekend(wdStr)) continue;

      for (let wid = 1; wid <= 4; wid++) {
        const h = demoHash(wid, wdStr);
        if (h % 10 === 0) continue;

        const sub = Math.floor(h / 10) % 10;
        const isManual = sub === 0;

        if (!isManual) {
          const startOff = (h >> 8) % 20;
          const endOff = (h >> 12) % 35;
          const sm = 8 * 60 - 8 + startOff;
          const em = 17 * 60 - 10 + endOff;
          const inHM = `${Math.floor(sm / 60)}:${String(sm % 60).padStart(2, "0")}`;
          const outHM = `${Math.floor(em / 60)}:${String(em % 60).padStart(2, "0")}`;
          const br = 30 + ((h >> 16) % 4) * 15;
          pushTeamDay(wid, cal, {
            inHM,
            outHM,
            breakM: br,
            razon: "imputacion_normal",
          });
          continue;
        }

        const mkind = (h >> 16) % 3;
        if (mkind === 0) {
          pushTeamDay(wid, cal, {
            inHM: "08:00",
            outHM: "17:00",
            breakM: 30,
            razon: "imputacion_manual_error",
            prevInHM: "07:42",
            prevOutHM: null,
          });
        } else if (mkind === 1) {
          pushTeamDay(wid, cal, {
            inHM: "08:05",
            outHM: "17:15",
            breakM: 45,
            razon: "imputacion_manual_error",
            prevInHM: "07:50",
            prevOutHM: "16:00",
          });
        } else {
          pushTeamDay(wid, cal, {
            inHM: "08:00",
            outHM: "16:30",
            breakM: 60,
            razon: "imputacion_manual_error",
            prevInHM: "08:00",
            prevOutHM: "15:15",
          });
        }
      }
    }
  }

  const seen = new Set<string>();
  return list
    .filter((e) => {
      const k = `${e.workerId}-${e.workDate}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .filter((e) => !workDateIsWeekend(e.workDate))
    .sort((a, b) =>
      a.workDate < b.workDate ? 1 : a.workDate > b.workDate ? -1 : a.workerId - b.workerId
    );
}

const FICHADOR_STORAGE_KEY = "agro-fichador-entries-v1";
/** Historial equipo (edits admin): misma pestaña; sobrevive F5 sin recargar datos demo. */
const EQUIPO_HISTORIAL_STORAGE_KEY = "agro-equipo-historial-v1";

/**
 * `false` (recomendado para probar): cada recarga vuelve al mock de `createInitialMockEntries()`.
 * `true`: los fichajes se guardan en localStorage y persisten al actualizar.
 */
const FICHADOR_PERSISTIR_DATOS = false;

function parseStoredTimeEntries(raw: string | null): TimeEntryMock[] | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return null;
    const ok = p.every(
      (e: unknown) =>
        e !== null &&
        typeof e === "object" &&
        typeof (e as TimeEntryMock).id === "number" &&
        typeof (e as TimeEntryMock).workDate === "string" &&
        typeof (e as TimeEntryMock).checkInUtc === "string" &&
        ((e as TimeEntryMock).checkOutUtc === null ||
          typeof (e as TimeEntryMock).checkOutUtc === "string")
    );
    return ok ? (p as TimeEntryMock[]) : null;
  } catch {
    return null;
  }
}

export default function TimeTrackingPage() {
  const { user } = useAuth();
  const canVerEquipo =
    user?.role === USER_ROLE.Admin || user?.role === USER_ROLE.SuperAdmin;
  const [fichadorPanel, setFichadorPanel] = useState<"personal" | "equipo">("personal");
  const [filtroPersonaEquipo, setFiltroPersonaEquipo] = useState<number | "todas">("todas");
  const [mesEquipo, setMesEquipo] = useState(currentMonthLocalISO);

  const opcionesMesEquipo = useMemo(() => monthSelectOptions(12), []);
  const [teamHistorialEntries, setTeamHistorialEntries] = useState<TimeEntryMock[]>(() =>
    createTeamHistorialDemo()
  );
  const [equipoHistorialListo, setEquipoHistorialListo] = useState(false);
  const equipoTablaScrollRef = useRef<HTMLDivElement>(null);
  const equipoRestaurarScroll = useRef<{ top: number; left: number } | null>(null);
  const equipoMarcarRestaurarScroll = useRef(false);

  useEffect(() => {
    try {
      const raw =
        typeof window !== "undefined"
          ? sessionStorage.getItem(EQUIPO_HISTORIAL_STORAGE_KEY)
          : null;
      const parsed = parseStoredTimeEntries(raw);
      if (parsed !== null && parsed.length > 0) {
        setTeamHistorialEntries(parsed);
      }
    } catch {
      /* ignore */
    }
    setEquipoHistorialListo(true);
  }, []);

  useEffect(() => {
    if (!equipoHistorialListo || typeof window === "undefined") return;
    try {
      sessionStorage.setItem(EQUIPO_HISTORIAL_STORAGE_KEY, JSON.stringify(teamHistorialEntries));
    } catch {
      /* quota */
    }
  }, [teamHistorialEntries, equipoHistorialListo]);

  useLayoutEffect(() => {
    if (!equipoMarcarRestaurarScroll.current) return;
    equipoMarcarRestaurarScroll.current = false;
    const pos = equipoRestaurarScroll.current;
    const el = equipoTablaScrollRef.current;
    equipoRestaurarScroll.current = null;
    if (pos && el) {
      el.scrollTop = pos.top;
      el.scrollLeft = pos.left;
    }
  }, [teamHistorialEntries]);
  const equipoRowsFiltradas = useMemo(() => {
    let rows = teamHistorialEntries.filter((e) => e.workDate.slice(0, 7) === mesEquipo);
    if (filtroPersonaEquipo !== "todas") {
      rows = rows.filter((e) => e.workerId === filtroPersonaEquipo);
    }
    return rows;
  }, [teamHistorialEntries, filtroPersonaEquipo, mesEquipo]);

  const entriesMesEquipoPorTrabajador = useMemo(() => {
    const map = new Map<string, TimeEntryMock>();
    for (const e of teamHistorialEntries) {
      if (e.workDate.slice(0, 7) !== mesEquipo) continue;
      map.set(`${e.workerId}-${e.workDate}`, e);
    }
    return map;
  }, [teamHistorialEntries, mesEquipo]);

  const trabajadoresVistaEquipo = useMemo(
    () =>
      filtroPersonaEquipo === "todas"
        ? MOCK_WORKERS_FICHA.map((w) => w.id)
        : [filtroPersonaEquipo as number],
    [filtroPersonaEquipo]
  );

  /** Días listados: mes completo si es pasado; si es el mes actual, solo del 1 al día de hoy. Mes futuro → vacío. */
  const diasCalendarioMesEquipo = useMemo(() => {
    const parts = mesEquipo.split("-").map(Number);
    const y = parts[0];
    const mo = parts[1];
    if (!y || !mo || mo < 1 || mo > 12) return [];
    const mesStr = `${y}-${String(mo).padStart(2, "0")}`;
    const todayStr = localTodayISO();
    const todayYm = todayStr.slice(0, 7);
    if (mesStr > todayYm) return [];
    const dim = new Date(y, mo, 0).getDate();
    const endD =
      mesStr === todayYm ? Math.min(dim, parseInt(todayStr.slice(8, 10), 10)) : dim;
    const out: { workDate: string; isWeekend: boolean }[] = [];
    for (let d = 1; d <= endD; d++) {
      const wd = localCalendarISO(new Date(y, mo - 1, d, 12, 0, 0, 0));
      out.push({ workDate: wd, isWeekend: workDateIsWeekend(wd) });
    }
    return out;
  }, [mesEquipo]);

  const filasEquipoCalendario = useMemo(() => {
    const filas: EquipoTablaFila[] = [];
    for (const wid of trabajadoresVistaEquipo) {
      for (const { workDate, isWeekend } of diasCalendarioMesEquipo) {
        if (isWeekend) {
          const we = entriesMesEquipoPorTrabajador.get(`${wid}-${workDate}`);
          if (we && isAusenciaRazon(we.razon)) {
            filas.push({ kind: "registro", e: we });
          } else {
            filas.push({ kind: "noLaboral", workerId: wid, workDate });
          }
        } else {
          const e = entriesMesEquipoPorTrabajador.get(`${wid}-${workDate}`);
          if (e) filas.push({ kind: "registro", e });
          else filas.push({ kind: "sinImputar", workerId: wid, workDate });
        }
      }
    }
    return filas;
  }, [trabajadoresVistaEquipo, diasCalendarioMesEquipo, entriesMesEquipoPorTrabajador]);

  /** Ciclo por columna: 1º desc, 2º asc, 3º orden original (fecha ↓, persona). */
  const [equipoSort, setEquipoSort] = useState<{
    key: EquipoSortKey | null;
    dir: "asc" | "desc" | null;
  }>({ key: null, dir: null });

  const equipoFilasOrdenadas = useMemo(() => {
    if (equipoSort.key == null || equipoSort.dir == null) {
      return sortEquipoFilasOrigen(filasEquipoCalendario);
    }
    return sortEquipoFilas(filasEquipoCalendario, equipoSort.key, equipoSort.dir);
  }, [filasEquipoCalendario, equipoSort.key, equipoSort.dir]);

  const setEquipoSortColumn = (key: EquipoSortKey) => {
    setEquipoSort((s) => {
      if (s.key !== key) {
        return { key, dir: "desc" };
      }
      if (s.dir === "desc") return { key, dir: "asc" };
      return { key: null, dir: null };
    });
  };

  const totalMinutosImputadosMes = useMemo(
    () => equipoRowsFiltradas.reduce((acc, e) => acc + effectiveWorkMinutesEntry(e), 0),
    [equipoRowsFiltradas]
  );
  const totalHorasDecimalMes =
    Math.round((totalMinutosImputadosMes / 60) * 10) / 10;

  const diasLaborablesMesEquipo = useMemo(
    () => weekdaysInCalendarMonth(mesEquipo),
    [mesEquipo]
  );
  const personasEnObjetivo =
    filtroPersonaEquipo === "todas" ? MOCK_WORKERS_FICHA.length : 1;
  const horasObjetivoMesTeorico = diasLaborablesMesEquipo * 8 * personasEnObjetivo;
  const horasImputadasDecimal = totalMinutosImputadosMes / 60;
  const horasFaltaParaObjetivo = Math.max(
    0,
    horasObjetivoMesTeorico - horasImputadasDecimal
  );
  const horasExtraSobreObjetivo = Math.max(
    0,
    horasImputadasDecimal - horasObjetivoMesTeorico
  );
  const hDonutImputado = Math.min(horasImputadasDecimal, horasObjetivoMesTeorico);
  const hDonutFalta = Math.max(0, horasObjetivoMesTeorico - horasImputadasDecimal);
  const hDonutExtra = Math.max(0, horasImputadasDecimal - horasObjetivoMesTeorico);

  const fichajeTipoStats = useMemo(() => {
    let minNormal = 0;
    let minManual = 0;
    let nNormal = 0;
    let nManual = 0;
    for (const e of equipoRowsFiltradas) {
      if (isAusenciaRazon(e.razon)) continue;
      const m = effectiveWorkMinutesEntry(e);
      if (e.razon === "imputacion_manual_error") {
        minManual += m;
        nManual += 1;
      } else {
        minNormal += m;
        nNormal += 1;
      }
    }
    return {
      horasNormal: minNormal / 60,
      horasManual: minManual / 60,
      registrosNormal: nNormal,
      registrosManual: nManual,
    };
  }, [equipoRowsFiltradas]);

  const diasSinImputarEquipo = useMemo(
    () => filasEquipoCalendario.filter((f) => f.kind === "sinImputar").length,
    [filasEquipoCalendario]
  );
  const horasSinImputarTipoFichaje = diasSinImputarEquipo * 8;

  const [entries, setEntries] = useState<TimeEntryMock[]>([]);
  const [entriesHydrated, setEntriesHydrated] = useState(false);
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

  const [equipoModal, setEquipoModal] = useState<null | {
    workerId: number;
    workDate: string;
    existing: TimeEntryMock | null;
    isWeekendFila: boolean;
  }>(null);
  const [equipoModalVista, setEquipoModalVista] = useState<"menu" | "horario">("menu");
  const [equipoFormIn, setEquipoFormIn] = useState("08:00");
  const [equipoFormOut, setEquipoFormOut] = useState("17:00");
  const [equipoFormBreak, setEquipoFormBreak] = useState(30);
  const [equipoFormNota, setEquipoFormNota] = useState("");
  const [equipoFormError, setEquipoFormError] = useState<string | null>(null);

  const equipoModalScrollY = useRef(0);
  useEffect(() => {
    if (!equipoModal) return;
    equipoModalScrollY.current = window.scrollY;
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${equipoModalScrollY.current}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      window.scrollTo(0, equipoModalScrollY.current);
    };
  }, [equipoModal]);

  const openEquipoEditModal = (opts: {
    workerId: number;
    workDate: string;
    existing: TimeEntryMock | null;
    isWeekendFila: boolean;
  }) => {
    setEquipoModalVista("menu");
    setEquipoFormError(null);
    const ex = opts.existing;
    if (ex && !isAusenciaRazon(ex.razon) && ex.checkOutUtc) {
      setEquipoFormIn(utcToLocalHHMM(ex.checkInUtc));
      setEquipoFormOut(utcToLocalHHMM(ex.checkOutUtc));
      setEquipoFormBreak(ex.breakMinutes ?? 30);
    } else {
      setEquipoFormIn("08:00");
      setEquipoFormOut("17:00");
      setEquipoFormBreak(30);
    }
    setEquipoFormNota(ex?.edicionNotaAdmin?.trim() ?? "");
    setEquipoModal(opts);
  };

  const cerrarEquipoModal = () => {
    setEquipoModal(null);
    setEquipoFormError(null);
  };

  const guardarEquipoVacacionesOBaja = (tipo: "vacaciones" | "baja") => {
    if (!equipoModal) return;
    const { workerId, workDate, existing } = equipoModal;
    const email = user?.email ?? MOCK_RRHH_LAST_MODIFIER;
    const name = user?.email?.split("@")[0] ?? null;
    const now = new Date().toISOString();
    let previousCheckInUtc: string | null = null;
    let previousCheckOutUtc: string | null = null;
    if (existing && !isAusenciaRazon(existing.razon)) {
      previousCheckInUtc = existing.checkInUtc;
      previousCheckOutUtc = existing.checkOutUtc;
    } else if (existing?.previousCheckInUtc || existing?.previousCheckOutUtc) {
      previousCheckInUtc = existing.previousCheckInUtc ?? null;
      previousCheckOutUtc = existing.previousCheckOutUtc ?? null;
    }
    const placeholderIso = dateTimeLocalToUtcIso(workDate, "12:00");
    const tab = equipoTablaScrollRef.current;
    if (tab) {
      equipoRestaurarScroll.current = { top: tab.scrollTop, left: tab.scrollLeft };
      equipoMarcarRestaurarScroll.current = true;
    }
    startTransition(() => {
      setTeamHistorialEntries((prev) => {
        const nextId = prev.reduce((m, e) => Math.max(m, e.id), 0) + 1;
        const newEntry: TimeEntryMock = {
          id: existing?.id ?? nextId,
          workerId,
          workDate,
          checkInUtc: placeholderIso,
          checkOutUtc: placeholderIso,
          isEdited: true,
          createdAtUtc: existing?.createdAtUtc ?? now,
          createdBy: existing?.createdBy ?? workerId,
          updatedAtUtc: now,
          updatedBy: 1,
          breakMinutes: 0,
          razon: tipo === "vacaciones" ? "ausencia_vacaciones" : "ausencia_baja",
          lastModifiedByEmail: email,
          lastModifiedByName: name,
          previousCheckInUtc,
          previousCheckOutUtc,
          edicionNotaAdmin: null,
        };
        const idx = prev.findIndex((e) => e.workerId === workerId && e.workDate === workDate);
        const base = idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
        return [...base, newEntry];
      });
    });
    cerrarEquipoModal();
  };

  const guardarEquipoHorarioManual = () => {
    if (!equipoModal) return;
    const { workerId, workDate, existing } = equipoModal;
    const gross = minutesGrossWorkDay(workDate, equipoFormIn, equipoFormOut);
    if (gross <= 0) {
      setEquipoFormError("La hora de salida debe ser posterior a la entrada.");
      return;
    }
    if (equipoFormBreak > gross) {
      setEquipoFormError("Los minutos de descanso no pueden superar la jornada bruta.");
      return;
    }
    setEquipoFormError(null);
    const email = user?.email ?? MOCK_RRHH_LAST_MODIFIER;
    const name = user?.email?.split("@")[0] ?? null;
    const now = new Date().toISOString();
    const checkInUtc = dateTimeLocalToUtcIso(workDate, equipoFormIn);
    const checkOutUtc = checkoutLocalIsoAfterCheckin(workDate, checkInUtc, equipoFormOut);
    const hadJornadaReal = Boolean(existing && !isAusenciaRazon(existing.razon));
    let previousCheckInUtc: string | null = null;
    let previousCheckOutUtc: string | null = null;
    if (hadJornadaReal && existing) {
      previousCheckInUtc = existing.checkInUtc;
      previousCheckOutUtc = existing.checkOutUtc;
    } else if (existing && isAusenciaRazon(existing.razon)) {
      previousCheckInUtc = existing.previousCheckInUtc ?? null;
      previousCheckOutUtc = existing.previousCheckOutUtc ?? null;
    }
    const nota = equipoFormNota.trim();
    const tab = equipoTablaScrollRef.current;
    if (tab) {
      equipoRestaurarScroll.current = { top: tab.scrollTop, left: tab.scrollLeft };
      equipoMarcarRestaurarScroll.current = true;
    }
    startTransition(() => {
      setTeamHistorialEntries((prev) => {
        const nextId = prev.reduce((m, e) => Math.max(m, e.id), 0) + 1;
        const newEntry: TimeEntryMock = {
          id: existing?.id ?? nextId,
          workerId,
          workDate,
          checkInUtc,
          checkOutUtc,
          isEdited: true,
          createdAtUtc: existing?.createdAtUtc ?? now,
          createdBy: existing?.createdBy ?? workerId,
          updatedAtUtc: now,
          updatedBy: 1,
          breakMinutes: equipoFormBreak,
          razon: "imputacion_manual_error",
          lastModifiedByEmail: email,
          lastModifiedByName: name,
          previousCheckInUtc,
          previousCheckOutUtc,
          entradaManual: true,
          salidaManual: true,
          edicionNotaAdmin: nota || null,
        };
        const idx = prev.findIndex((e) => e.workerId === workerId && e.workDate === workDate);
        const base = idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
        return [...base, newEntry];
      });
    });
    cerrarEquipoModal();
  };

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

  type AyerCompletaStep = "closed" | "inicio" | "fin" | "descanso" | "descanso_cant";
  const [ayerCompStep, setAyerCompStep] = useState<AyerCompletaStep>("closed");
  const [ayerManStart, setAyerManStart] = useState("09:00");
  const [ayerManEnd, setAyerManEnd] = useState("18:00");
  const [ayerCompHadBreak, setAyerCompHadBreak] = useState<boolean | null>(null);
  const [ayerCompOtroH, setAyerCompOtroH] = useState(0);
  const [ayerCompOtroM, setAyerCompOtroM] = useState(30);
  const [ayerCompError, setAyerCompError] = useState<string | null>(null);

  const today = localTodayISO();
  const ayerUtc = yesterdayISO();
  const ayerLocal = localYesterdayISO();

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

  const esFechaAyer = (wd: string) => wd === ayerUtc || wd === ayerLocal;

  /** Entrada de ayer sin salida → obligatorio cerrar manualmente antes de fichar hoy. */
  const registroAyerParcial = useMemo(
    () => entries.find((e) => esFechaAyer(e.workDate) && e.checkOutUtc == null) ?? null,
    [entries, ayerUtc, ayerLocal]
  );

  const necesitaCompletarAyer = registroAyerParcial !== null;

  /** Tabla histórico: ventana 7 días y sin sábado/domingo (vista tipo L–V en demo). */
  const historicoRecienteRows = useMemo(
    () =>
      entries
        .filter((e) => workDateWithinLastNDays(e.workDate, 7))
        .filter((e) => !workDateIsWeekend(e.workDate))
        .slice()
        .sort((a, b) => (a.workDate < b.workDate ? 1 : a.workDate > b.workDate ? -1 : 0)),
    [entries]
  );

  const fechaAyerEtiqueta = registroAyerParcial?.workDate ?? ayerLocal;

  const ayerMinutosBrutos = useMemo(() => {
    const m = minutesGrossWorkDay(fechaAyerEtiqueta, ayerManStart, ayerManEnd);
    return Number.isFinite(m) && m > 0 ? m : 0;
  }, [fechaAyerEtiqueta, ayerManStart, ayerManEnd]);

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

  const olvideFicharBotonActivo = !necesitaCompletarAyer && !hasEntryFor(today);

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
    if (necesitaCompletarAyer) {
      setError("Primero completa el registro de ayer (entrada, salida y descanso) con el aviso rojo.");
      return;
    }
    setForgotError(null);
    setForgotTargetDate(null);
    setForgotStep("pick_day");
  };

  const resetAyerCompletaModal = () => {
    setAyerCompStep("closed");
    setAyerManStart("09:00");
    setAyerManEnd("18:00");
    setAyerCompHadBreak(null);
    setAyerCompOtroH(0);
    setAyerCompOtroM(30);
    setAyerCompError(null);
  };

  const abrirCompletarAyer = () => {
    setAyerCompError(null);
    if (registroAyerParcial) {
      setAyerManStart(utcToLocalHHMM(registroAyerParcial.checkInUtc));
      setAyerManEnd("18:00");
    } else {
      setAyerManStart("09:00");
      setAyerManEnd("18:00");
    }
    setAyerCompStep("inicio");
  };

  const submitCompletarAyer = (forcedBreak?: number) => {
    const openAyer = entries.find((e) => esFechaAyer(e.workDate) && e.checkOutUtc == null);
    const closedAyerExists = entries.some(
      (e) => esFechaAyer(e.workDate) && e.checkOutUtc != null && e.checkOutUtc !== ""
    );
    // Solo salir si ya no hay nada que cerrar (evita el bug: había cierre duplicado + entrada abierta
    // y el antiguo `some(checkOut)` impedía guardar y el aviso rojo no desaparecía).
    if (!openAyer && closedAyerExists) {
      resetAyerCompletaModal();
      return;
    }
    const wd = openAyer?.workDate ?? ayerLocal;
    const checkInUtc = dateTimeLocalToUtcIso(wd, ayerManStart);
    const checkOutUtc = checkoutLocalIsoAfterCheckin(wd, checkInUtc, ayerManEnd);
    let breakMin = 0;
    if (typeof forcedBreak === "number") {
      breakMin = forcedBreak;
    } else if (ayerCompHadBreak === true) {
      breakMin = ayerCompOtroH * 60 + ayerCompOtroM;
      if (breakMin <= 0) {
        setAyerCompError("Indica el descanso con horas y minutos (debe ser mayor que 0).");
        return;
      }
    }
    const nowIso = new Date().toISOString();
    setEntries((prev) => {
      const openAyerIds = prev
        .filter((e) => esFechaAyer(e.workDate) && e.checkOutUtc == null)
        .map((e) => e.id);
      if (openAyerIds.length > 0) {
        return prev.map((x) =>
          openAyerIds.includes(x.id)
            ? {
                ...x,
                previousCheckInUtc: x.checkInUtc,
                previousCheckOutUtc: x.checkOutUtc,
                workDate: wd,
                checkInUtc,
                checkOutUtc,
                breakMinutes: breakMin,
                razon: "imputacion_manual_error",
                entradaManual: false,
                salidaManual: true,
                isEdited: true,
                updatedAtUtc: nowIso,
                updatedBy: 1,
                lastModifiedByEmail: user?.email ?? null,
              }
            : x
        );
      }
      const maxId = prev.reduce((max, e) => (e.id > max ? e.id : max), 0);
      return [
        ...prev,
        {
          id: maxId + 1,
          workerId: 1,
          workDate: wd,
          checkInUtc,
          checkOutUtc,
          isEdited: true,
          createdAtUtc: nowIso,
          createdBy: 1,
          updatedAtUtc: nowIso,
          updatedBy: 1,
          razon: "imputacion_manual_error",
          salidaManual: true,
          breakMinutes: breakMin,
          lastModifiedByEmail: user?.email ?? null,
        },
      ];
    });
    resetAyerCompletaModal();
    setError(null);
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
          lastModifiedByEmail: user?.email ?? null,
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
          lastModifiedByEmail: user?.email ?? null,
        },
      ];
    });
    resetForgotModal();
  };

  useEffect(() => {
    if (FICHADOR_PERSISTIR_DATOS && typeof window !== "undefined") {
      const stored = parseStoredTimeEntries(localStorage.getItem(FICHADOR_STORAGE_KEY));
      if (stored !== null) {
        setEntries(stored);
      } else {
        setEntries(createInitialMockEntries());
      }
    } else {
      setEntries(createInitialMockEntries());
    }
    setEntriesHydrated(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (
      !FICHADOR_PERSISTIR_DATOS ||
      !entriesHydrated ||
      typeof window === "undefined"
    ) {
      return;
    }
    try {
      localStorage.setItem(FICHADOR_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* quota / privado */
    }
  }, [entries, entriesHydrated]);

  const handleCheckIn = async () => {
    setError(null);
    const workDate = localTodayISO();
    if (necesitaCompletarAyer) {
      setError("Antes debes completar el registro de ayer (aviso rojo).");
      return;
    }
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
        const wd = localTodayISO();
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
          lastModifiedByEmail: user?.email ?? null,
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
                lastModifiedByEmail: user?.email ?? null,
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
    <div className="min-w-0 max-w-full space-y-4">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-agro-600 via-emerald-500 to-sky-500 px-4 py-3 shadow-sm sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-agro-100/80">
              Registro de jornada
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white">Fichador</h1>
            <p className="mt-1 text-sm text-agro-50/90">
              {fichadorPanel === "equipo" && canVerEquipo
                ? "Consulta las horas imputadas por tu equipo."
                : "Marca tu entrada y salida de forma sencilla y cumpliendo el registro horario."}
            </p>
          </div>
          {user && (
            <div className="flex min-w-0 max-w-full flex-col items-end gap-1 text-right">
              <span className="max-w-full truncate rounded-full border border-white/30 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-agro-50 backdrop-blur sm:px-3 sm:text-xs">
                {user.email}
              </span>
              <span className="text-[11px] text-agro-50/80">
                Hoy: {formatDateES(today)}
              </span>
            </div>
          )}
        </div>
      </div>

      {canVerEquipo && (
        <div className="flex justify-start">
          <div
            className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-600 dark:bg-slate-800/90"
            role="tablist"
            aria-label="Vista del fichador"
          >
            <button
              type="button"
              role="tab"
              aria-selected={fichadorPanel === "personal"}
              onClick={() => setFichadorPanel("personal")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                fichadorPanel === "personal"
                  ? "bg-agro-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/80"
              }`}
            >
              Mi fichador
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={fichadorPanel === "equipo"}
              onClick={() => setFichadorPanel("equipo")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                fichadorPanel === "equipo"
                  ? "bg-agro-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/80"
              }`}
            >
              Horas del equipo
            </button>
          </div>
        </div>
      )}

      {fichadorPanel === "equipo" && canVerEquipo && (
        <div className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/95 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Historial del equipo
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
              Horas imputadas por trabajadores
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              <strong>Mes en curso:</strong> solo días del 1 al <strong>hoy</strong>. Meses anteriores:
              mes completo. Todos los días (lun–dom): fin de semana = no laboral.{" "}
              <span className="font-semibold text-red-700 dark:text-red-400">
                Laborable sin fichaje = rojo
              </span>{" "}
              (~10 % demo). Dona izquierda: objetivo vs imputado. Dona derecha: incluye días laborables
              sin imputar (rojo).
            </p>
          </div>

          <div className="mt-6 flex min-w-0 max-w-full flex-col gap-6 lg:flex-row lg:items-stretch">
            {/* Columna izquierda: panel cuadrado (filtros + total) */}
            <div className="mx-auto flex w-full max-w-[400px] shrink-0 flex-col justify-between gap-4 rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-md dark:border-slate-600 dark:bg-slate-900/80 lg:mx-0 lg:max-w-[min(400px,42vw)] lg:min-h-[320px] lg:p-5">
              <div className="min-h-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-600 dark:bg-slate-800/50 sm:p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Filtros
                </p>
                <div className="flex flex-col gap-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <label
                      htmlFor="mes-equipo"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Mes
                    </label>
                    <select
                      id="mes-equipo"
                      value={mesEquipo}
                      onChange={(e) => setMesEquipo(e.target.value)}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {opcionesMesEquipo.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <label
                      htmlFor="filtro-persona-equipo"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Persona
                    </label>
                    <select
                      id="filtro-persona-equipo"
                      value={filtroPersonaEquipo === "todas" ? "" : String(filtroPersonaEquipo)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFiltroPersonaEquipo(v === "" ? "todas" : parseInt(v, 10));
                      }}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="">Todas las personas</option>
                      {MOCK_WORKERS_FICHA.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="shrink-0 rounded-2xl border-2 border-agro-300/80 bg-gradient-to-br from-agro-50 via-white to-emerald-50 p-3 shadow-sm dark:border-agro-800 dark:from-agro-950/40 dark:via-slate-900 dark:to-emerald-950/30 sm:p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-agro-700 dark:text-agro-400">
                  Total horas imputadas
                </p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-agro-800 dark:text-agro-200 sm:text-3xl">
                  {formatMinutesShort(totalMinutosImputadosMes)}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {totalHorasDecimalMes.toLocaleString("es-ES", {
                      minimumFractionDigits: totalHorasDecimalMes % 1 ? 1 : 0,
                      maximumFractionDigits: 1,
                    })}{" "}
                    h
                  </span>
                  <span className="text-slate-500 dark:text-slate-500"> en decimal</span>
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {equipoRowsFiltradas.length}{" "}
                  {equipoRowsFiltradas.length === 1 ? "registro" : "registros"} en el mes
                  {filtroPersonaEquipo !== "todas" && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {workerNameById(filtroPersonaEquipo as number)}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Gráficos según filtros: objetivo mensual vs imputado */}
            <div
              className="flex min-h-[320px] min-w-0 max-w-full flex-1 flex-col gap-4 overflow-x-hidden rounded-3xl border-2 border-slate-200 bg-gradient-to-br from-white via-slate-50/80 to-emerald-50/30 p-3 shadow-sm sm:p-4 dark:border-slate-600 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-emerald-950/20 lg:min-h-0 lg:overflow-y-auto"
              aria-label="Gráficos objetivo vs imputado"
            >
              <div className="min-w-0 border-b border-slate-200/80 pb-4 dark:border-slate-600">
                <EquipoObjetivoMesEncabezado
                  diasLaborables={diasLaborablesMesEquipo}
                  personasEnObjetivo={personasEnObjetivo}
                  horasObjetivo={horasObjetivoMesTeorico}
                  filtroTodasPersonas={filtroPersonaEquipo === "todas"}
                />
                <EquipoBarraLaboralesExtra
                  horasObjetivo={horasObjetivoMesTeorico}
                  horasImputadasLabor={hDonutImputado}
                  horasFalta={horasFaltaParaObjetivo}
                  horasExtra={hDonutExtra}
                  horasImputadasTotal={horasImputadasDecimal}
                />
              </div>

              <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch lg:gap-4">
                <div className="min-h-0 w-full min-w-0 max-w-full lg:h-full">
                  <HorasMensualesDonut
                    horasImputadoHastaTope={hDonutImputado}
                    horasFalta={hDonutFalta}
                    horasExtra={hDonutExtra}
                    horasObjetivo={horasObjetivoMesTeorico}
                    horasImputadasTotal={horasImputadasDecimal}
                    registrosEnPeriodo={equipoRowsFiltradas.length}
                  />
                </div>
                <div className="min-h-0 w-full min-w-0 max-w-full lg:h-full">
                  <FichajeTipoDonut
                    horasNormal={fichajeTipoStats.horasNormal}
                    horasManual={fichajeTipoStats.horasManual}
                    horasSinImputar={horasSinImputarTipoFichaje}
                    registrosNormal={fichajeTipoStats.registrosNormal}
                    registrosManual={fichajeTipoStats.registrosManual}
                    diasSinImputar={diasSinImputarEquipo}
                  />
                </div>
              </div>
            </div>
          </div>
          <span className="mt-3 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
            Vista administrador · datos de demo
          </span>

          {diasCalendarioMesEquipo.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              No hay días que mostrar: el mes es futuro o el filtro no es válido. El mes actual solo
              lista hasta hoy.
            </p>
          ) : (
            <>
            <div className="mt-4 flex flex-col items-end gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
              <p className="order-2 max-w-md text-right text-[10px] leading-snug text-slate-500 dark:text-slate-400 sm:order-1 sm:mr-auto sm:text-left">
                Ordenar columna:{" "}
                <strong className="font-semibold text-slate-600 dark:text-slate-300">1.º</strong>{" "}
                descendente ·{" "}
                <strong className="font-semibold text-slate-600 dark:text-slate-300">2.º</strong>{" "}
                ascendente ·{" "}
                <strong className="font-semibold text-slate-600 dark:text-slate-300">3.º</strong> orden
                por defecto (fecha ↓)
              </p>
              <button
                type="button"
                onClick={() => {
                  const csv = buildEquipoTableCsvFilas(equipoFilasOrdenadas);
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `horas-equipo-${mesEquipo}-${
                    filtroPersonaEquipo === "todas" ? "todas" : `persona-${filtroPersonaEquipo}`
                  }.csv`;
                  a.rel = "noopener";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="order-1 inline-flex items-center gap-1.5 rounded-xl border border-agro-600 bg-agro-50 px-3 py-2 text-xs font-semibold text-agro-800 shadow-sm transition hover:bg-agro-100 dark:border-agro-500 dark:bg-agro-950/40 dark:text-agro-100 dark:hover:bg-agro-900/50 sm:order-2 sm:text-sm"
              >
                <span aria-hidden>⬇</span>
                Exportar CSV (vista actual)
              </button>
            </div>
            <div
              ref={equipoTablaScrollRef}
              className="mt-2 max-h-[min(70vh,520px)] w-full min-w-0 max-w-full touch-pan-x overflow-x-auto overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-700 [-webkit-overflow-scrolling:touch]"
              style={{
                overscrollBehaviorX: "contain",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <table className="w-full min-w-[1120px] text-left text-xs text-slate-600 dark:text-slate-300 sm:min-w-[1200px]">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setEquipoSortColumn("persona")}
                        className="flex w-full max-w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        Persona
                        {equipoSort.key === "persona" && (
                          <span className="shrink-0 text-agro-600 dark:text-agro-400" aria-hidden>
                            {equipoSort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setEquipoSortColumn("fecha")}
                        className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        Fecha
                        {equipoSort.key === "fecha" && (
                          <span className="text-agro-600 dark:text-agro-400" aria-hidden>
                            {equipoSort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setEquipoSortColumn("entrada")}
                        className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        Entrada
                        {equipoSort.key === "entrada" && (
                          <span className="text-agro-600 dark:text-agro-400" aria-hidden>
                            {equipoSort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setEquipoSortColumn("salida")}
                        className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        Salida
                        {equipoSort.key === "salida" && (
                          <span className="text-agro-600 dark:text-agro-400" aria-hidden>
                            {equipoSort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-2.5 whitespace-normal leading-tight">
                      <button
                        type="button"
                        onClick={() => setEquipoSortColumn("entradaAntes")}
                        className="flex w-full flex-col items-start gap-0 text-left hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        <span className="flex items-center gap-0.5">
                          Entrada
                          {equipoSort.key === "entradaAntes" && (
                            <span className="text-agro-600 dark:text-agro-400" aria-hidden>
                              {equipoSort.dir === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </span>
                        <span className="font-normal normal-case text-[10px] text-slate-400">
                          (antes)
                        </span>
                      </button>
                    </th>
                    <th className="px-3 py-2.5 whitespace-normal leading-tight">
                      <button
                        type="button"
                        onClick={() => setEquipoSortColumn("salidaAntes")}
                        className="flex w-full flex-col items-start gap-0 text-left hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        <span className="flex items-center gap-0.5">
                          Salida
                          {equipoSort.key === "salidaAntes" && (
                            <span className="text-agro-600 dark:text-agro-400" aria-hidden>
                              {equipoSort.dir === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </span>
                        <span className="font-normal normal-case text-[10px] text-slate-400">
                          (antes)
                        </span>
                      </button>
                    </th>
                    <th className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setEquipoSortColumn("descanso")}
                        className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        Descanso
                        {equipoSort.key === "descanso" && (
                          <span className="text-agro-600 dark:text-agro-400" aria-hidden>
                            {equipoSort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setEquipoSortColumn("razon")}
                        className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        Razón
                        {equipoSort.key === "razon" && (
                          <span className="text-agro-600 dark:text-agro-400" aria-hidden>
                            {equipoSort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="min-w-[9rem] max-w-[14rem] px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setEquipoSortColumn("modificado")}
                        className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        Modificado por
                        {equipoSort.key === "modificado" && (
                          <span className="shrink-0 text-agro-600 dark:text-agro-400" aria-hidden>
                            {equipoSort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="min-w-[7.5rem] whitespace-normal px-3 py-2.5 leading-tight">
                      <button
                        type="button"
                        onClick={() => setEquipoSortColumn("fechaMod")}
                        className="flex w-full flex-col items-start gap-0 text-left hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        <span className="flex items-center gap-0.5">
                          Fecha
                          {equipoSort.key === "fechaMod" && (
                            <span className="text-agro-600 dark:text-agro-400" aria-hidden>
                              {equipoSort.dir === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </span>
                        <span className="font-normal normal-case text-[10px] text-slate-400">
                          modificación
                        </span>
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setEquipoSortColumn("duracion")}
                        className="ml-auto flex w-full items-center justify-end gap-0.5 hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        Duración
                        {equipoSort.key === "duracion" && (
                          <span className="text-agro-600 dark:text-agro-400" aria-hidden>
                            {equipoSort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th className="sticky right-0 z-[5] bg-slate-50 px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:bg-slate-700 dark:text-slate-300">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {equipoFilasOrdenadas.map((fila) => {
                    if (fila.kind === "noLaboral") {
                      return (
                        <tr
                          key={`nl-${fila.workerId}-${fila.workDate}`}
                          className="border-t border-slate-200/80 bg-slate-50/90 text-slate-500 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-400"
                        >
                          <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold">
                            {workerNameById(fila.workerId)}
                          </td>
                          <td className="px-3 py-2 text-xs">{formatDateES(fila.workDate)}</td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-xs italic">{RAZON_NO_LABORAL}</td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-right text-xs">—</td>
                          <td className="sticky right-0 z-[1] bg-slate-50/95 px-1 py-1 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:bg-slate-800/95">
                            <button
                              type="button"
                              onClick={() =>
                                openEquipoEditModal({
                                  workerId: fila.workerId,
                                  workDate: fila.workDate,
                                  existing: null,
                                  isWeekendFila: true,
                                })
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    if (fila.kind === "sinImputar") {
                      return (
                        <tr
                          key={`si-${fila.workerId}-${fila.workDate}`}
                          className="border-t border-red-200 bg-red-50/95 text-red-900 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-100"
                        >
                          <td className="whitespace-nowrap px-3 py-2 text-xs font-bold">
                            {workerNameById(fila.workerId)}
                          </td>
                          <td className="px-3 py-2 text-xs font-semibold">
                            {formatDateES(fila.workDate)}
                          </td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-xs font-semibold">{RAZON_SIN_IMPUTAR}</td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-xs">—</td>
                          <td className="px-3 py-2 text-right text-xs font-semibold">—</td>
                          <td className="sticky right-0 z-[1] bg-red-50/98 px-1 py-1 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:bg-red-950/50">
                            <button
                              type="button"
                              onClick={() =>
                                openEquipoEditModal({
                                  workerId: fila.workerId,
                                  workDate: fila.workDate,
                                  existing: null,
                                  isWeekendFila: false,
                                })
                              }
                              className="rounded-lg border border-red-300 bg-white px-2 py-1 text-[10px] font-semibold text-red-800 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100 dark:hover:bg-red-900/70"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    const e = fila.e;
                    const aus = isAusenciaRazon(e.razon);
                    const rowVac =
                      e.razon === "ausencia_vacaciones"
                        ? "border-t border-sky-200 bg-sky-50/95 text-sky-950 dark:border-sky-800 dark:bg-sky-950/45 dark:text-sky-50"
                        : e.razon === "ausencia_baja"
                          ? "border-t border-violet-200 bg-violet-50/95 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-50"
                          : "border-t border-slate-100 bg-white/80 dark:border-slate-700 dark:bg-slate-800/80";
                    const stickyBg =
                      e.razon === "ausencia_vacaciones"
                        ? "bg-sky-50/98 dark:bg-sky-950/50"
                        : e.razon === "ausencia_baja"
                          ? "bg-violet-50/98 dark:bg-violet-950/45"
                          : "bg-white/95 dark:bg-slate-800/95";
                    return (
                      <tr
                        key={`${e.id}-${e.workerId}-${e.workDate}`}
                        className={rowVac}
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {workerNameById(e.workerId)}
                        </td>
                        <td className="px-3 py-2 text-xs">{formatDateES(e.workDate)}</td>
                        <td className="px-3 py-2 text-xs">{aus ? "—" : formatTimeLocal(e.checkInUtc)}</td>
                        <td className="px-3 py-2 text-xs">{aus ? "—" : formatTimeLocal(e.checkOutUtc)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                          {formatTiempoAnterior(e.previousCheckInUtc)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                          {formatTiempoAnterior(e.previousCheckOutUtc)}
                        </td>
                        <td className="px-3 py-2 text-xs">{aus ? "—" : formatMinutesShort(e.breakMinutes ?? 0)}</td>
                        <td className="max-w-[10rem] px-3 py-2 text-xs leading-snug">
                          <span
                            className={
                              e.razon === "imputacion_manual_error"
                                ? "rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
                                : e.razon === "ausencia_vacaciones"
                                  ? "rounded-md bg-sky-200/80 px-1.5 py-0.5 font-semibold text-sky-950 dark:bg-sky-800/60 dark:text-sky-100"
                                  : e.razon === "ausencia_baja"
                                    ? "rounded-md bg-violet-200/80 px-1.5 py-0.5 font-semibold text-violet-950 dark:bg-violet-300/30 dark:text-violet-100"
                                    : "text-slate-700 dark:text-slate-200"
                            }
                          >
                            {formatRazon(e.razon)}
                            {e.edicionNotaAdmin ? (
                              <span className="mt-0.5 block font-normal text-[10px] opacity-90">
                                {e.edicionNotaAdmin}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td
                          className="max-w-[14rem] px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
                          title={formatLastModifiedByUser(e)}
                        >
                          <span className="line-clamp-2 break-all">
                            {formatLastModifiedByUser(e)}
                          </span>
                        </td>
                        <td
                          className="whitespace-nowrap px-3 py-2 text-xs text-slate-600 dark:text-slate-300"
                          title={e.updatedAtUtc ?? ""}
                        >
                          {formatFechaModificacionUtc(e.updatedAtUtc)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-semibold">
                          {aus ? "—" : formatMinutesShort(effectiveWorkMinutesEntry(e))}
                        </td>
                        <td className={`sticky right-0 z-[1] px-1 py-1 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] ${stickyBg}`}>
                          <button
                            type="button"
                            onClick={() =>
                              openEquipoEditModal({
                                workerId: e.workerId,
                                workDate: e.workDate,
                                existing: e,
                                isWeekendFila: workDateIsWeekend(e.workDate),
                              })
                            }
                            className="rounded-lg border border-agro-500/60 bg-agro-50 px-2 py-1 text-[10px] font-semibold text-agro-800 hover:bg-agro-100 dark:border-agro-600 dark:bg-agro-950/50 dark:text-agro-100 dark:hover:bg-agro-900/60"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {equipoModal && (
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="equipo-edit-title"
                onClick={(ev) => {
                  if (ev.target === ev.currentTarget) cerrarEquipoModal();
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Escape") cerrarEquipoModal();
                }}
              >
                <div
                  className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  <h2
                    id="equipo-edit-title"
                    className="text-lg font-bold text-slate-900 dark:text-slate-50"
                  >
                    Editar día
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {workerNameById(equipoModal.workerId)}
                    </span>
                    {" · "}
                    {formatDateES(equipoModal.workDate)}
                    {equipoModal.isWeekendFila ? (
                      <span className="ml-1 text-xs text-slate-500">(fin de semana)</span>
                    ) : null}
                  </p>

                  {equipoModalVista === "menu" ? (
                    <div className="mt-5 space-y-4">
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Ausencias
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => guardarEquipoVacacionesOBaja("vacaciones")}
                            className="flex-1 rounded-xl border-2 border-sky-400 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900 shadow-sm transition hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-900/40"
                          >
                            Añadir vacaciones
                          </button>
                          <button
                            type="button"
                            onClick={() => guardarEquipoVacacionesOBaja("baja")}
                            className="flex-1 rounded-xl border-2 border-violet-400 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-100 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/35"
                          >
                            Añadir baja / ausencia
                          </button>
                        </div>
                        <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                          Si ya había horario imputado, se guardará en <strong>Entrada/Salida (antes)</strong>.
                          La fila quedará marcada y se registrará quién modificó.
                        </p>
                      </div>
                      <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Jornada laboral
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEquipoModalVista("horario");
                            setEquipoFormError(null);
                          }}
                          className="w-full rounded-xl border-2 border-agro-500 bg-agro-50 px-4 py-3 text-sm font-semibold text-agro-900 shadow-sm transition hover:bg-agro-100 dark:border-agro-600 dark:bg-agro-950/40 dark:text-agro-100 dark:hover:bg-agro-900/50"
                        >
                          Modificar horario (imputación manual)
                        </button>
                        <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                          Nuevas entrada y salida; la razón mostrará <strong>imputación manual (RRHH)</strong>,
                          con fechas anteriores en las columnas correspondientes.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={cerrarEquipoModal}
                        className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4">
                      <button
                        type="button"
                        onClick={() => {
                          setEquipoModalVista("menu");
                          setEquipoFormError(null);
                        }}
                        className="text-sm font-medium text-agro-600 hover:underline dark:text-agro-400"
                      >
                        ← Volver
                      </button>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Entrada
                          </label>
                          <input
                            type="time"
                            value={equipoFormIn}
                            onChange={(ev) => setEquipoFormIn(ev.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Salida
                          </label>
                          <input
                            type="time"
                            value={equipoFormOut}
                            onChange={(ev) => setEquipoFormOut(ev.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Descanso (minutos)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={600}
                          value={equipoFormBreak}
                          onChange={(ev) => setEquipoFormBreak(Number(ev.target.value) || 0)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Motivo / nota (opcional)
                        </label>
                        <textarea
                          value={equipoFormNota}
                          onChange={(ev) => setEquipoFormNota(ev.target.value)}
                          rows={2}
                          placeholder="Ej. Corrección acordada con el trabajador"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      {equipoFormError ? (
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">
                          {equipoFormError}
                        </p>
                      ) : null}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={guardarEquipoHorarioManual}
                          className="flex-1 rounded-xl bg-agro-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-agro-700"
                        >
                          Guardar horario
                        </button>
                        <button
                          type="button"
                          onClick={cerrarEquipoModal}
                          className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            </>
          )}
        </div>
      )}

      {fichadorPanel === "personal" && (
        <>
      {necesitaCompletarAyer && registroAyerParcial && (
        <div className="sticky top-2 z-30 min-w-0 max-w-full rounded-2xl border-2 border-rose-600 bg-rose-50 px-3 py-3 shadow-md dark:border-rose-500 dark:bg-rose-950/35 sm:px-4 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-rose-800 dark:text-rose-200">
                Registro de ayer incompleto (obligatorio)
              </p>
              <p className="rounded-lg border border-rose-200 bg-white/80 px-2.5 py-1.5 text-xs text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100">
                <span className="font-semibold text-rose-800 dark:text-rose-200">Hoy:</span>{" "}
                {formatDateES(today)}
              </p>
              <p className="break-words text-sm text-rose-900 dark:text-rose-100">
                <span className="font-semibold text-rose-800 dark:text-rose-200">Ayer</span> (
                {formatDateES(fechaAyerEtiqueta)}): consta{" "}
                <strong>entrada a las {formatTimeLocal(registroAyerParcial.checkInUtc)}</strong> y{" "}
                <strong>no hay salida</strong> (no se cerró la jornada). Debes indicar salida y
                descanso a mano; hasta entonces no podrás fichar el día de hoy.
              </p>
            </div>
            <button
              type="button"
              disabled={ayerCompStep !== "closed"}
              onClick={abrirCompletarAyer}
              className="shrink-0 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
            >
              Completar ayer ahora
            </button>
          </div>
        </div>
      )}

      <div className="grid min-w-0 max-w-full gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="min-w-0 space-y-3">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90 sm:p-4">
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
                  disabled={
                    actionLoading !== null ||
                    forgotStep !== "closed" ||
                    (!hasOpenEntry && necesitaCompletarAyer)
                  }
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
                  !olvideFicharBotonActivo || actionLoading !== null || forgotStep !== "closed"
                }
                className="inline-flex items-center justify-center rounded-xl border-2 border-dashed border-amber-600/70 bg-amber-50/80 px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
              >
                Olvidé fichar
              </button>
              {necesitaCompletarAyer && (
                <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
                  Completa el registro de ayer (bloque rojo) antes de fichar u olvidé fichar.
                </p>
              )}
              {!olvideFicharBotonActivo && !necesitaCompletarAyer && (
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

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90 sm:p-4">
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
                        <p className="mt-1 break-all text-[10px] text-slate-500 dark:text-slate-400">
                          Modificado por:{" "}
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            {formatLastModifiedByUser(e, { sessionEmail: user?.email })}
                          </span>
                        </p>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </section>

        <section className="min-w-0 space-y-3">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Histórico reciente
                </p>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                  Últimos 7 días (lun–vie; sábado y domingo no se listan en esta vista).
                </p>
              </div>
              <span className="shrink-0 self-start rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500 dark:bg-slate-700/60 dark:text-slate-300 sm:px-3 sm:text-[11px]">
                Datos de demo (sin servidor)
              </span>
            </div>

            {loading ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Cargando histórico…
              </p>
            ) : historicoRecienteRows.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {entries.length === 0
                  ? "No hay registros de jornada en los últimos días."
                  : "No hay filas lun–vie en los últimos 7 días (o solo hay registros de fin de semana, que aquí no se muestran)."}
              </p>
            ) : (
              <>
              <div
                className="mt-3 max-h-80 min-w-0 overflow-x-auto overflow-y-auto rounded-lg border border-slate-100 [-webkit-overflow-scrolling:touch] dark:border-slate-700"
                style={{ overscrollBehaviorX: "contain" }}
              >
                <table className="w-full min-w-[940px] text-left text-xs text-slate-600 dark:text-slate-300 sm:min-w-[1000px] md:min-w-full">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Entrada</th>
                      <th className="px-3 py-2">Salida</th>
                      <th className="whitespace-normal px-3 py-2 leading-tight">
                        Entrada
                        <br />
                        <span className="font-normal normal-case text-[10px] text-slate-400">
                          (antes)
                        </span>
                      </th>
                      <th className="whitespace-normal px-3 py-2 leading-tight">
                        Salida
                        <br />
                        <span className="font-normal normal-case text-[10px] text-slate-400">
                          (antes)
                        </span>
                      </th>
                      <th className="px-3 py-2">Descanso</th>
                      <th className="px-3 py-2">Razón</th>
                      <th className="min-w-[9rem] max-w-[14rem] px-3 py-2">Modificado por</th>
                      <th className="min-w-[7.5rem] whitespace-normal px-3 py-2 leading-tight">
                        Fecha
                        <br />
                        <span className="font-normal normal-case text-[10px] text-slate-400">
                          modificación
                        </span>
                      </th>
                      <th className="px-3 py-2 text-right">Duración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoRecienteRows.map((e) => (
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
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            {formatTiempoAnterior(e.previousCheckInUtc)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            {formatTiempoAnterior(e.previousCheckOutUtc)}
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
                          <td
                            className="max-w-[14rem] px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
                            title={formatLastModifiedByUser(e, { sessionEmail: user?.email })}
                          >
                            <span className="line-clamp-2 break-all">
                              {formatLastModifiedByUser(e, { sessionEmail: user?.email })}
                            </span>
                          </td>
                          <td
                            className="whitespace-nowrap px-3 py-2 text-xs text-slate-600 dark:text-slate-300"
                            title={e.updatedAtUtc ?? ""}
                          >
                            {formatFechaModificacionUtc(e.updatedAtUtc)}
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
              <p className="mt-1.5 text-center text-[10px] text-slate-400 md:hidden">
                ← Desliza para ver fecha modificación, «antes» y duración →
              </p>
              </>
            )}
          </div>
        </section>
      </div>
        </>
      )}

      {/* Modal: completar registro de ayer (entrada + salida + descanso) */}
      {ayerCompStep !== "closed" && necesitaCompletarAyer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl dark:border dark:border-slate-600 dark:bg-slate-800">
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                Registro manual del día anterior
              </p>
              <button
                type="button"
                onClick={resetAyerCompletaModal}
                className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Cerrar
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Día: <strong>{formatDateES(fechaAyerEtiqueta)}</strong>
            </p>

            {ayerCompStep === "inicio" && (
              <>
                <h2 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-50">
                  ¿A qué hora empezaste?
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Aunque solo te faltara la salida, revisa también la hora de entrada si hace falta.
                </p>
                <TimeSelect24h
                  idPrefix="ayer-in"
                  value={ayerManStart}
                  onChange={setAyerManStart}
                />
                {ayerCompError && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{ayerCompError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetAyerCompletaModal}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAyerCompError(null);
                      setAyerCompStep("fin");
                    }}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Siguiente
                  </button>
                </div>
              </>
            )}

            {ayerCompStep === "fin" && (
              <>
                <h2 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-50">
                  ¿A qué hora terminaste?
                </h2>
                <TimeSelect24h
                  idPrefix="ayer-out"
                  value={ayerManEnd}
                  onChange={setAyerManEnd}
                />
                {ayerCompError && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{ayerCompError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAyerCompStep("inicio")}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-500"
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAyerCompError(null);
                      setAyerCompStep("descanso");
                    }}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Siguiente
                  </button>
                </div>
              </>
            )}

            {ayerCompStep === "descanso" && (
              <>
                <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-sm dark:border-rose-800 dark:bg-rose-950/40">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-rose-800 dark:text-rose-300">
                    Resumen de la jornada indicada
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    De <strong>{ayerManStart}</strong> a <strong>{ayerManEnd}</strong> (
                    {formatDateES(fechaAyerEtiqueta)})
                  </p>
                  {ayerMinutosBrutos > 0 ? (
                    <>
                      <p className="mt-2 text-lg font-bold text-rose-900 dark:text-rose-100">
                        Tiempo total: {formatMinutesShort(ayerMinutosBrutos)}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        Ese es el tiempo entre entrada y salida. Lo que declares de{" "}
                        <strong>descanso</strong> se <strong>restará</strong> de ese total para
                        calcular las <strong>horas trabajadas efectivas</strong>.
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                      Revisa la hora de salida: debe ser posterior a la de entrada.
                    </p>
                  )}
                </div>
                <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-50">
                  ¿Paraste para comer o descansar?
                </h2>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAyerCompError(null);
                      submitCompletarAyer(0);
                    }}
                    className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAyerCompError(null);
                      setAyerCompHadBreak(true);
                      setAyerCompOtroH(0);
                      setAyerCompOtroM(30);
                      setAyerCompStep("descanso_cant");
                    }}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-600"
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setAyerCompStep("fin")}
                    className="mt-1 text-xs text-slate-500 underline"
                  >
                    Atrás
                  </button>
                </div>
              </>
            )}

            {ayerCompStep === "descanso_cant" && (
              <>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  ¿Cuánto tiempo descansaste?
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Elige las horas y los minutos con los desplegables.
                </p>
                {ayerMinutosBrutos > 0 && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-800/80">
                    <p className="text-slate-600 dark:text-slate-400">
                      Tiempo total jornada:{" "}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {formatMinutesShort(ayerMinutosBrutos)}
                      </strong>
                    </p>
                    <p className="mt-1 text-slate-600 dark:text-slate-400">
                      Descanso indicado:{" "}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {formatMinutesShort(ayerCompOtroH * 60 + ayerCompOtroM)}
                      </strong>
                    </p>
                    <p className="mt-1 border-t border-slate-200 pt-1 font-semibold text-agro-800 dark:text-agro-300">
                      Trabajado efectivo (estimado):{" "}
                      {formatMinutesShort(
                        Math.max(0, ayerMinutosBrutos - (ayerCompOtroH * 60 + ayerCompOtroM))
                      )}
                    </p>
                  </div>
                )}
                <div className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-600">
                  <BreakDurationCombos
                    idPrefix="ayer-break"
                    hours={ayerCompOtroH}
                    minutes={ayerCompOtroM}
                    onHoursChange={setAyerCompOtroH}
                    onMinutesChange={setAyerCompOtroM}
                    onUserEdit={() => {}}
                  />
                </div>
                {ayerCompError && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{ayerCompError}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAyerCompStep("descanso")}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-500"
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => submitCompletarAyer()}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Guardar jornada de ayer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
                    disabled={hasEntryFor(ayerLocal) || hasEntryFor(ayerUtc)}
                    onClick={() => {
                      setForgotError(null);
                      setForgotTargetDate(ayerLocal);
                      setForgotMode("full_ayer");
                      setForgotStep("full_start");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-50"
                  >
                    Ayer
                    {(hasEntryFor(ayerLocal) || hasEntryFor(ayerUtc)) && (
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
                <div className="mt-4">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Hora de entrada
                  </p>
                  <TimeSelect24h
                    idPrefix="forgot-solo"
                    value={forgotSoloTime}
                    onChange={setForgotSoloTime}
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
                <div className="mt-4">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Hora de inicio
                  </p>
                  <TimeSelect24h
                    idPrefix="forgot-start"
                    value={forgotFullStart}
                    onChange={setForgotFullStart}
                  />
                </div>
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
                <div className="mt-4">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Hora de fin
                  </p>
                  <TimeSelect24h
                    idPrefix="forgot-end"
                    value={forgotFullEnd}
                    onChange={setForgotFullEnd}
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

