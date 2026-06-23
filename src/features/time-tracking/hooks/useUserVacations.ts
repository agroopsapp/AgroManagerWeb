"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CalendarioLaboralDayMark } from "@/features/time-tracking/types";
import {
  isCompanyHolidayOverlapError,
  userVacationIdIndex,
  userVacationsByUserId,
} from "@/features/time-tracking/utils/userVacationsMap";
import {
  userVacationsApi,
  type UserVacationBalanceDto,
  type UserVacationDto,
} from "@/services/user-vacations.service";
import {
  messageFromApiErrorJsonBody,
  userVisibleMessageFromUnknown,
} from "@/shared/utils/apiErrorDisplay";

export type HolidayOverlapConfirm = {
  message: string;
  onConfirm: () => Promise<void>;
};

type Params = {
  companyId: string | null | undefined;
  year: number;
  /** Usuario del token (Worker). */
  authUserId: string | null | undefined;
  /** Usuario seleccionado en UI; `null` o valor especial «todas» = sin filtro userId. */
  selectedUserId: string | null;
  /** Si true, `selectedUserId` se interpreta como «todas las personas». */
  viewAllUsers: boolean;
  isWorker: boolean;
  canMutate: boolean;
};

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "status" in err && "message" in err) {
    const e = err as { status: number; message: string; body?: unknown };
    const fromBody = messageFromApiErrorJsonBody(e.body, e.status, "");
    return fromBody || e.message || "";
  }
  if (err instanceof Error) return err.message;
  return "";
}

export function useUserVacations({
  companyId,
  year,
  authUserId,
  selectedUserId,
  viewAllUsers,
  isWorker,
  canMutate,
}: Params) {
  const companyIdTrim = companyId?.trim() ?? "";
  const authUid = authUserId?.trim() ?? "";

  const [rows, setRows] = useState<UserVacationDto[]>([]);
  const [balance, setBalance] = useState<UserVacationBalanceDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [holidayOverlapConfirm, setHolidayOverlapConfirm] =
    useState<HolidayOverlapConfirm | null>(null);

  const fetchSeq = useRef(0);
  const balanceSeq = useRef(0);

  const balanceUserId = useMemo(() => {
    if (isWorker) return authUid || null;
    if (viewAllUsers || !selectedUserId?.trim()) return null;
    return selectedUserId.trim();
  }, [isWorker, authUid, viewAllUsers, selectedUserId]);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      const seq = ++fetchSeq.current;
      if (!isWorker && !selectedUserId?.trim()) {
        setRows([]);
        setError(null);
        if (seq === fetchSeq.current) setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        let list: UserVacationDto[] = [];
        if (isWorker) {
          if (!authUid) {
            setRows([]);
            return;
          }
          list = await userVacationsApi.mine({ year, signal });
        } else if (viewAllUsers) {
          list = await userVacationsApi.list({
            companyId: companyIdTrim || undefined,
            year,
            signal,
          });
        } else {
          const uid = selectedUserId?.trim();
          if (!uid) {
            setRows([]);
            return;
          }
          list = await userVacationsApi.list({
            companyId: companyIdTrim || undefined,
            userId: uid,
            year,
            signal,
          });
        }
        if (seq !== fetchSeq.current) return;
        setRows(list);
      } catch (e) {
        if (signal?.aborted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (seq !== fetchSeq.current) return;
        setRows([]);
        setError(
          userVisibleMessageFromUnknown(e, "No se pudieron cargar las vacaciones."),
        );
      } finally {
        if (seq === fetchSeq.current) setLoading(false);
      }
    },
    [isWorker, authUid, viewAllUsers, companyIdTrim, selectedUserId, year],
  );

  const reloadBalance = useCallback(
    async (signal?: AbortSignal) => {
      if (!balanceUserId) {
        setBalance(null);
        setBalanceLoading(false);
        return;
      }
      const seq = ++balanceSeq.current;
      setBalanceLoading(true);
      try {
        const b = await userVacationsApi.balance(balanceUserId, year, { signal });
        if (seq !== balanceSeq.current) return;
        setBalance(b);
      } catch (e) {
        if (signal?.aborted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (seq !== balanceSeq.current) return;
        setBalance(null);
      } finally {
        if (seq === balanceSeq.current) setBalanceLoading(false);
      }
    },
    [balanceUserId, year],
  );

  useEffect(() => {
    const ac = new AbortController();
    void reload(ac.signal);
    return () => ac.abort();
  }, [reload]);

  useEffect(() => {
    const ac = new AbortController();
    void reloadBalance(ac.signal);
    return () => ac.abort();
  }, [reloadBalance]);

  const idIndex = useMemo(() => userVacationIdIndex(rows), [rows]);

  const vacationsByUserId = useMemo(
    () => userVacationsByUserId(rows),
    [rows],
  );

  const clearHolidayOverlapConfirm = useCallback(() => {
    setHolidayOverlapConfirm(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const runWithHolidayOverlapRetry = useCallback(
    async (
      action: (confirmOverlapsCompanyHoliday: boolean) => Promise<void>,
    ): Promise<"ok" | "overlap_pending"> => {
      try {
        await action(false);
        return "ok";
      } catch (e) {
        const msg = extractErrorMessage(e);
        if (isCompanyHolidayOverlapError(msg)) {
          setHolidayOverlapConfirm({
            message: msg,
            onConfirm: async () => {
              setHolidayOverlapConfirm(null);
              setSaving(true);
              setError(null);
              try {
                await action(true);
                await reload();
                await reloadBalance();
              } catch (retryErr) {
                setError(
                  userVisibleMessageFromUnknown(
                    retryErr,
                    "No se pudo guardar la vacación.",
                  ),
                );
                throw retryErr;
              } finally {
                setSaving(false);
              }
            },
          });
          return "overlap_pending";
        }
        throw e;
      }
    },
    [reload, reloadBalance],
  );

  const setVacationMark = useCallback(
    async (userId: string, dateISO: string, mark: CalendarioLaboralDayMark | null) => {
      if (!canMutate) return;
      const uid = userId.trim();
      if (!uid || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return;

      setSaving(true);
      setError(null);
      try {
        const existingId = idIndex[uid]?.[dateISO];

        if (mark == null || mark.kind !== "vacaciones") {
          if (!existingId) return;
          await userVacationsApi.deleteOne(existingId);
          setRows((prev) => prev.filter((r) => r.id !== existingId));
          await reloadBalance();
          return;
        }

        if (existingId) return;

        if (!companyIdTrim) {
          setError("Falta companyId para crear la vacación.");
          return;
        }

        const result = await runWithHolidayOverlapRetry(async (confirmOverlaps) => {
          const created = await userVacationsApi.create({
            companyId: companyIdTrim,
            userId: uid,
            date: dateISO,
            confirmOverlapsCompanyHoliday: confirmOverlaps,
          });
          setRows((prev) => {
            const without = prev.filter((r) => !(r.userId === uid && r.date === dateISO));
            return [...without, created];
          });
        });
        if (result === "ok") await reloadBalance();
      } catch (e) {
        setError(userVisibleMessageFromUnknown(e, "No se pudo guardar la vacación."));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [
      canMutate,
      idIndex,
      companyIdTrim,
      runWithHolidayOverlapRetry,
      reloadBalance,
    ],
  );

  const setVacationMarksBulk = useCallback(
    async (userId: string, dates: string[], mark: CalendarioLaboralDayMark) => {
      if (!canMutate || mark.kind !== "vacaciones") return;
      const uid = userId.trim();
      if (!uid) return;
      const validDates = Array.from(
        new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))),
      );
      if (validDates.length === 0) return;

      const toCreate = validDates.filter((d) => !idIndex[uid]?.[d]);
      if (toCreate.length === 0) return;

      if (!companyIdTrim) {
        setError("Falta companyId para crear las vacaciones.");
        return;
      }

      setSaving(true);
      setError(null);
      try {
        const result = await runWithHolidayOverlapRetry(async (confirmOverlaps) => {
          const created = await userVacationsApi.createBulk({
            companyId: companyIdTrim,
            userId: uid,
            dates: toCreate,
            confirmOverlapsCompanyHoliday: confirmOverlaps,
          });
          setRows((prev) => {
            const createdDates = new Set(created.map((c) => c.date));
            const rest = prev.filter(
              (r) => !(r.userId === uid && createdDates.has(r.date)),
            );
            return [...rest, ...created];
          });
        });
        if (result === "ok") await reloadBalance();
      } catch (e) {
        setError(
          userVisibleMessageFromUnknown(e, "No se pudieron guardar las vacaciones del rango."),
        );
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [canMutate, idIndex, companyIdTrim, runWithHolidayOverlapRetry, reloadBalance],
  );

  const clearVacationMarksBulk = useCallback(
    async (userId: string, dates: string[]) => {
      if (!canMutate) return;
      const uid = userId.trim();
      if (!uid) return;
      const ids = dates
        .map((d) => idIndex[uid]?.[d])
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) return;

      setSaving(true);
      setError(null);
      try {
        if (ids.length === 1) {
          await userVacationsApi.deleteOne(ids[0]);
        } else {
          await userVacationsApi.deleteBulk({ ids });
        }
        const idSet = new Set(ids);
        setRows((prev) => prev.filter((r) => !idSet.has(r.id)));
        await reloadBalance();
      } catch (e) {
        setError(
          userVisibleMessageFromUnknown(e, "No se pudieron quitar las vacaciones del rango."),
        );
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [canMutate, idIndex, reloadBalance],
  );

  return {
    vacationsByUserId,
    balance,
    loading,
    balanceLoading,
    error,
    saving,
    hydrated: !loading,
    holidayOverlapConfirm,
    clearHolidayOverlapConfirm,
    clearError,
    setVacationMark,
    setVacationMarksBulk,
    clearVacationMarksBulk,
    reload,
    reloadBalance,
  };
}
