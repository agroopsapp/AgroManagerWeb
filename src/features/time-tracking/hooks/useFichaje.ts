"use client";
import { useEffect, useMemo, useState } from "react";
import { FICHADOR_STORAGE_KEY } from "@/lib/fichadorStorage";
import { workerIdForLoggedUser } from "@/lib/fichajeWorker";
import { getTasksFromRecord, getWorkPartsForWorker } from "@/lib/workPartsStorage";
import {
  localCalendarISO,
  localTodayISO,
  workDateWithinLastNDays,
} from "@/shared/utils/time";
import {
  historicoFilaSinImputarPasado,
  type HistoricoPersonalFila,
} from "@/features/time-tracking/utils/formatters";
import {
  createInitialMockEntries,
  MOCK_WORKERS_FICHA,
} from "@/mocks/time-tracking.mock";
import type { TimeEntryMock } from "@/features/time-tracking/types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

type AuthUser = { id?: string; email?: string | null; role?: string } | null | undefined;

interface Params {
  user: AuthUser;
  isReady: boolean;
  miWorkerId: number;
}

export function useFichaje({ user, isReady, miWorkerId }: Params) {
  const [entries, setEntries] = useState<TimeEntryMock[]>([]);
  const [entriesHydrated, setEntriesHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"checkin" | "checkout" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = localTodayISO();

  // Partes guardados
  const [myWorkParts, setMyWorkParts] = useState<ReturnType<typeof getWorkPartsForWorker>>([]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setMyWorkParts(getWorkPartsForWorker(miWorkerId));
    refresh();
    window.addEventListener("agromanager-workparts-changed", refresh);
    return () => window.removeEventListener("agromanager-workparts-changed", refresh);
  }, [miWorkerId]);

  // Hydrate entries from localStorage or mock
  useEffect(() => {
    if (!isReady) return;
    const wid = workerIdForLoggedUser(user as Parameters<typeof workerIdForLoggedUser>[0]);
    const email = (user?.email?.trim()) || "usuario@empresa.demo";
    if (FICHADOR_PERSISTIR_DATOS && typeof window !== "undefined") {
      const stored = parseStoredTimeEntries(localStorage.getItem(FICHADOR_STORAGE_KEY));
      if (stored !== null) {
        const mine = stored.filter((e) => e.workerId === wid);
        setEntries(mine.length > 0 ? mine : createInitialMockEntries(wid, email));
      } else {
        setEntries(createInitialMockEntries(wid, email));
      }
    } else {
      setEntries(createInitialMockEntries(wid, email));
    }
    setEntriesHydrated(true);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, user?.id, user?.email]);

  // Persist to localStorage
  useEffect(() => {
    if (!FICHADOR_PERSISTIR_DATOS || !entriesHydrated || typeof window === "undefined") return;
    try {
      localStorage.setItem(FICHADOR_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* quota / privado */
    }
  }, [entries, entriesHydrated]);

  // ----- Derived -----

  const todayEntriesPersonal = useMemo(
    () => entries.filter((e) => e.workDate === today && e.workerId === miWorkerId),
    [entries, today, miWorkerId]
  );

  const openEntry = useMemo(
    () =>
      todayEntriesPersonal
        .slice()
        .sort((a, b) => new Date(b.checkInUtc).getTime() - new Date(a.checkInUtc).getTime())
        .find((e) => e.checkOutUtc === null) ?? null,
    [todayEntriesPersonal]
  );

  const hasOpenEntry = !!openEntry;

  const closedTodayEntry = useMemo(
    () =>
      todayEntriesPersonal
        .filter((e) => e.checkOutUtc !== null)
        .sort(
          (a, b) =>
            new Date(b.checkOutUtc!).getTime() - new Date(a.checkOutUtc!).getTime()
        )[0] ?? null,
    [todayEntriesPersonal]
  );

  const jornadaCompletadaHoy = closedTodayEntry !== null && !hasOpenEntry;

  const workPartSummaryByDate = useMemo(() => {
    const m = new Map<string, { has: boolean; tasks: number }>();
    for (const p of myWorkParts) {
      if (!p?.workDate) continue;
      if (m.has(p.workDate)) continue;
      m.set(p.workDate, { has: true, tasks: getTasksFromRecord(p).length });
    }
    return m;
  }, [myWorkParts]);

  const historicoPersonalFilas = useMemo((): HistoricoPersonalFila[] => {
    const todayLocal = localTodayISO();
    const wid = miWorkerId;
    const filas: HistoricoPersonalFila[] = [];
    for (let delta = 0; delta < 7; delta++) {
      const d = new Date();
      d.setDate(d.getDate() - delta);
      const wd = localCalendarISO(d);
      if (!workDateWithinLastNDays(wd, 7)) continue;
      const dayEntries = entries.filter((x) => x.workerId === wid && x.workDate === wd);
      const e =
        dayEntries.length === 0
          ? null
          : [...dayEntries].sort(
              (a, b) => new Date(b.checkInUtc).getTime() - new Date(a.checkInUtc).getTime()
            )[0];
      if (wd < todayLocal) {
        if (!e) filas.push({ kind: "sinRegistro", workDate: wd });
        else filas.push({ kind: "entry", entry: e });
      } else if (e) {
        filas.push({ kind: "entry", entry: e });
      }
    }
    filas.sort((a, b) => {
      const da = a.kind === "entry" ? a.entry.workDate : a.workDate;
      const db = b.kind === "entry" ? b.entry.workDate : b.workDate;
      return db.localeCompare(da);
    });
    return filas;
  }, [entries, miWorkerId]);

  const hasEntryForDate = (workDate: string) =>
    entries.some((e) => e.workDate === workDate && e.workerId === miWorkerId);

  // ----- Handlers -----

  const handleCheckIn = async () => {
    setError(null);
    const workDate = localTodayISO();
    const yaHayFichajeHoy = entries.some(
      (e) => e.workDate === workDate && e.workerId === miWorkerId
    );
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
        if (prev.some((e) => e.workDate === wd && e.workerId === miWorkerId)) return prev;
        const maxId = prev.reduce((max, e) => (e.id > max ? e.id : max), 0);
        const newEntry: TimeEntryMock = {
          id: maxId + 1,
          workerId: miWorkerId,
          workDate: wd,
          checkInUtc: now.toISOString(),
          checkOutUtc: null,
          isEdited: false,
          createdAtUtc: now.toISOString(),
          createdBy: miWorkerId,
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

  return {
    entries,
    setEntries,
    loading,
    actionLoading,
    setActionLoading,
    error,
    setError,
    today,
    openEntry,
    hasOpenEntry,
    closedTodayEntry,
    jornadaCompletadaHoy,
    todayEntriesPersonal,
    myWorkParts,
    workPartSummaryByDate,
    historicoPersonalFilas,
    hasEntryForDate,
    handleCheckIn,
  };
}

// Re-export type for use in MOCK_WORKERS_FICHA reference
export { MOCK_WORKERS_FICHA };
