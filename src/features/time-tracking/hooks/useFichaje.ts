"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFlashSuccess } from "@/contexts/FlashSuccessContext";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";
import { getTasksFromRecord, getWorkPartsForWorker } from "@/lib/workPartsStorage";
import { timeTrackingApi } from "@/services/time-tracking.service";
import {
  localCalendarISO,
  localTodayISO,
  workDateWithinLastNDays,
} from "@/shared/utils/time";
import {
  historicoFilaSinImputarPasado,
  type HistoricoPersonalFila,
} from "@/features/time-tracking/utils/formatters";
import type { TimeEntryMock } from "@/features/time-tracking/types";
import { mapTimeEntryRowsItemToMock } from "@/features/time-tracking/utils/mapTimeEntryRowsItemToMock";
import {
  normalizeTimeEntryForSession,
  pickPreferredDayEntry,
  timeEntryBelongsToSessionUser,
} from "@/features/time-tracking/utils/timeEntrySessionMatch";
import { timeEntryDtoToMock } from "@/features/time-tracking/utils/timeEntryDtoToMock";

type AuthUser = { id?: string; email?: string | null; role?: string } | null | undefined;

interface Params {
  user: AuthUser;
  isReady: boolean;
  miWorkerId: number;
}

export function useFichaje({ user, isReady, miWorkerId }: Params) {
  const { showSuccess } = useFlashSuccess();
  const [entries, setEntries] = useState<TimeEntryMock[]>([]);
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

  // Hydrate entries from backend (últimos 7 días).
  useEffect(() => {
    if (!isReady) return;
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await timeTrackingApi.getMyEntries({ signal: ac.signal });
        if (ac.signal.aborted) return;
        const sessionUserId = user?.id ?? null;
        const entriesMapped = list
          .map((e) => mapTimeEntryRowsItemToMock(e))
          .filter((x): x is TimeEntryMock => x != null)
          .filter((e) => timeEntryBelongsToSessionUser(e, sessionUserId, miWorkerId))
          .map((e) => normalizeTimeEntryForSession(e, sessionUserId, miWorkerId));
        const filteredLast7 = entriesMapped.filter((e) =>
          workDateWithinLastNDays(e.workDate, 7),
        );
        setEntries(filteredLast7);
      } catch (e) {
        if (ac.signal.aborted) return;
        const msg =
          userVisibleMessageFromUnknown(e, "No se pudieron cargar tus fichajes.");
        setError(msg);
        setEntries([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [isReady, user?.id, user?.email, miWorkerId]);

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
    const sessionUserId = user?.id ?? null;
    const filas: HistoricoPersonalFila[] = [];
    for (let delta = 0; delta < 7; delta++) {
      const d = new Date();
      d.setDate(d.getDate() - delta);
      const wd = localCalendarISO(d);
      if (!workDateWithinLastNDays(wd, 7)) continue;
      const dayEntries = entries.filter(
        (x) =>
          x.workDate === wd && timeEntryBelongsToSessionUser(x, sessionUserId, miWorkerId),
      );
      const e = pickPreferredDayEntry(dayEntries);
      if (!e) filas.push({ kind: "sinRegistro", workDate: wd });
      else filas.push({ kind: "entry", entry: e });
    }
    filas.sort((a, b) => {
      const da = a.kind === "entry" ? a.entry.workDate : a.workDate;
      const db = b.kind === "entry" ? b.entry.workDate : b.workDate;
      return db.localeCompare(da);
    });
    return filas;
  }, [entries, miWorkerId, user?.id]);

  const hasEntryForDate = useCallback(
    (workDate: string) =>
      entries.some(
        (e) =>
          e.workDate === workDate &&
          timeEntryBelongsToSessionUser(e, user?.id ?? null, miWorkerId),
      ),
    [entries, miWorkerId, user?.id],
  );

  // ----- Handlers -----

  const handleCheckIn = useCallback(async () => {
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
      const created = await timeTrackingApi.checkIn();
      setEntries((prev) => {
        const next = timeEntryDtoToMock(created, miWorkerId);
        const withoutSameId = prev.filter((e) => e.id !== next.id);
        return [...withoutSameId, next];
      });
      showSuccess("Entrada de jornada registrada correctamente.");
    } catch (e) {
      const msg =
        userVisibleMessageFromUnknown(e, "No se pudo registrar la entrada.");
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  }, [entries, miWorkerId, user?.email, showSuccess]);

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
