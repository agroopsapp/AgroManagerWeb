// Datos mock del feature time-tracking
// Solo se usan en desarrollo. En producción serán reemplazados por llamadas API:
//   GET /api/TimeEntries?workerId=X
//   GET /api/TimeEntries/team?range=...
//   POST /api/TimeEntries

import type { TimeEntryMock, TimeEntryRazon } from "@/features/time-tracking/types";
import {
  localCalendarISO,
  localYesterdayISO,
  workDateIsWeekend,
  dateTimeLocalToUtcIso,
  checkoutLocalIsoAfterCheckin,
  dateOfLastFriday,
  dateOfLastMonday,
} from "@/shared/utils/time";

/** Emails demo por trabajador (hasta que el API devuelva `lastModifiedBy*`). */
export const MOCK_APP_USER_EMAIL_BY_WORKER: Record<number, string> = {
  1: "juan.perez@empresa.demo",
  2: "pedro.garcia@empresa.demo",
  3: "luis.lopez@empresa.demo",
  4: "ana.martinez@empresa.demo",
};
export const MOCK_RRHH_LAST_MODIFIER = "rrhh@empresa.demo";

/**
 * Demo "ayer" (solo una activa):
 * - CIERRE_AUTO (recomendado): fichó entrada, olvidó salida → el sistema cierra a 23:59; debe reimputar.
 * - SIN_CERRAR: misma situación pero jornada aún abierta (sin salida en BD).
 * Ambas false: sin bloqueo por ayer; el histórico sigue mostrando otros días.
 *
 * Otro caso realista en el histórico (sin entrada ni salida): día laborable sin fila en BD
 * → fila roja «Sin imputar (día laboral)» (olvidó fichar de punta a punta / usar «Olvidé fichar»).
 */
export const MOCK_DEMO_YESTERDAY_SIN_CERRAR = false;
export const MOCK_DEMO_YESTERDAY_CIERRE_AUTO = true;

/** Nombres demo para la vista admin (equipo). */
export const MOCK_WORKERS_FICHA: { id: number; name: string }[] = [
  { id: 1, name: "Juan Pérez" },
  { id: 2, name: "Pedro García" },
  { id: 3, name: "Luis López" },
  { id: 4, name: "Ana Martínez" },
];

export function workerNameById(id: number): string {
  return MOCK_WORKERS_FICHA.find((w) => w.id === id)?.name ?? `Trabajador #${id}`;
}

// Genera registros de ejemplo solo para el trabajador de la sesión (fichaje personal).
export function createInitialMockEntries(workerId: number, sessionEmail: string): TimeEntryMock[] {
  const now = new Date();
  const baseWorkerId = workerId;
  const baseCreatedBy = workerId;
  const who =
    sessionEmail.trim() || (MOCK_APP_USER_EMAIL_BY_WORKER[workerId] ?? "usuario@empresa.demo");

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
        (razon === "imputacion_manual_error" ? MOCK_RRHH_LAST_MODIFIER : who),
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
      lastModifiedByEmail: who,
    };
  };

  /** Ayer: el servidor cerró a las 23:59 del mismo día — obliga a reimputar (misma UX que sin salida). */
  const makeAyerCierreAuto2359 = (): TimeEntryMock => {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    const workDate = localCalendarISO(d);
    const start = new Date(d);
    start.setHours(8, 5, 0, 0);
    const end2359 = new Date(d);
    end2359.setHours(23, 59, 0, 0);
    const startIso = start.toISOString();
    const outIso = end2359.toISOString();
    return {
      id: 101,
      workerId: baseWorkerId,
      workDate,
      checkInUtc: startIso,
      checkOutUtc: outIso,
      isEdited: true,
      createdAtUtc: startIso,
      createdBy: baseCreatedBy,
      updatedAtUtc: outIso,
      updatedBy: baseCreatedBy,
      breakMinutes: 0,
      razon: "imputacion_normal",
      cierreAutomaticoMedianoche: true,
      lastModifiedByEmail: who,
    };
  };

  const viernesPasado = dateOfLastFriday(now);
  const lunesPasado = dateOfLastMonday(now);
  const ayerStr = localYesterdayISO();

  const historialAntiguo: TimeEntryMock[] = [];
  const demoAyer =
    MOCK_DEMO_YESTERDAY_SIN_CERRAR || MOCK_DEMO_YESTERDAY_CIERRE_AUTO;
  // No duplicar el día de "ayer" si ya va en el registro demo (p. ej. ayer = lunes o viernes)
  if (!demoAyer || localCalendarISO(lunesPasado) !== ayerStr) {
    historialAntiguo.push(makeClosedEntry(lunesPasado, 202, 8, 16, 60, "imputacion_normal", who));
  }
  if (!demoAyer || localCalendarISO(viernesPasado) !== ayerStr) {
    historialAntiguo.push(
      makeClosedEntry(viernesPasado, 201, 8, 17, 30, "imputacion_normal", who)
    );
  }

  if (MOCK_DEMO_YESTERDAY_SIN_CERRAR) {
    return [makeAyerEntradaSinSalida(), ...historialAntiguo];
  }
  if (MOCK_DEMO_YESTERDAY_CIERRE_AUTO) {
    return [makeAyerCierreAuto2359(), ...historialAntiguo];
  }

  return [...historialAntiguo];
}

/**
 * Demo equipo: últimos 12 meses hasta **hoy** (sin días futuros).
 * ~90 % de días laborables imputados; resto sin registro (ej. baja).
 * Mezcla normal / manual. En producción vendrá del API.
 */
export function createTeamHistorialDemo(): TimeEntryMock[] {
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
