"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CalendarioLaboralDayMark } from "@/features/time-tracking/types";
import {
  companyHolidaysApi,
  type CompanyHolidayDto,
} from "@/services/company-holidays.service";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";
import {
  companyHolidaysToIndex,
  DEFAULT_COMPANY_HOLIDAY_NAME,
} from "@/features/time-tracking/utils/companyHolidaysMap";

type Params = {
  companyId: string | null | undefined;
  year: number;
  /**
   * Si `false` (Worker): solo consulta el listado — nunca alta/edición/baja.
   * El backend debe devolver 403 en mutaciones; el front no las dispara.
   */
  canMutate: boolean;
};

function holidayNameFromMark(mark: CalendarioLaboralDayMark | null): string {
  const note = mark?.note?.trim();
  return note && note.length > 0 ? note.slice(0, 120) : DEFAULT_COMPANY_HOLIDAY_NAME;
}

export function useCompanyHolidays({ companyId, year, canMutate }: Params) {
  const companyIdTrim = companyId?.trim() ?? "";
  const [rows, setRows] = useState<CompanyHolidayDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fetchSeq = useRef(0);

  const index = useMemo(() => companyHolidaysToIndex(rows), [rows]);

  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!companyIdTrim) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await companyHolidaysApi.list({
        companyId: companyIdTrim,
        year,
        signal,
      });
      if (seq !== fetchSeq.current) return;
      setRows(list);
    } catch (e) {
      if (signal?.aborted) return;
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (e instanceof Error && e.name === "AbortError") return;
      if (seq !== fetchSeq.current) return;
      setRows([]);
      setError(userVisibleMessageFromUnknown(e, "No se pudieron cargar los festivos de empresa."));
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [companyIdTrim, year]);

  useEffect(() => {
    const ac = new AbortController();
    void reload(ac.signal);
    return () => ac.abort();
  }, [reload]);

  const setHolidayMark = useCallback(
    async (dateISO: string, mark: CalendarioLaboralDayMark | null) => {
      if (!companyIdTrim) return;
      if (!canMutate) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return;

      setSaving(true);
      setError(null);
      try {
        const existingId = index.idByDate[dateISO];

        if (mark == null || mark.kind !== "festivo") {
          if (existingId) {
            await companyHolidaysApi.deleteOne(existingId);
            setRows((prev) => prev.filter((r) => r.id !== existingId));
          }
          return;
        }

        const name = holidayNameFromMark(mark);
        const notes = mark.note?.trim() ? mark.note.trim().slice(0, 500) : null;

        if (existingId) {
          await companyHolidaysApi.update(existingId, { date: dateISO, name, notes });
          setRows((prev) =>
            prev.map((r) =>
              r.id === existingId ? { ...r, date: dateISO, name, notes } : r,
            ),
          );
          return;
        }

        const created = await companyHolidaysApi.create({
          companyId: companyIdTrim,
          date: dateISO,
          name,
          notes: notes ?? undefined,
        });
        setRows((prev) => {
          const withoutSameDate = prev.filter((r) => r.date !== dateISO);
          return [...withoutSameDate, created];
        });
      } catch (e) {
        setError(userVisibleMessageFromUnknown(e, "No se pudo guardar el festivo."));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [canMutate, companyIdTrim, index.idByDate],
  );

  const setHolidayMarksBulk = useCallback(
    async (dates: string[], mark: CalendarioLaboralDayMark) => {
      if (!companyIdTrim || !canMutate) return;
      if (mark.kind !== "festivo") return;
      const validDates = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
      if (validDates.length === 0) return;

      const name = holidayNameFromMark(mark);
      const notes = mark.note?.trim() ? mark.note.trim().slice(0, 500) : null;

      const toCreate = validDates.filter((d) => !index.idByDate[d]);
      const toUpdate = validDates.filter((d) => index.idByDate[d]);

      setSaving(true);
      setError(null);
      try {
        if (toCreate.length > 0) {
          const created = await companyHolidaysApi.createBulk({
            companyId: companyIdTrim,
            items: toCreate.map((date) => ({ date, name, notes: notes ?? undefined })),
          });
          setRows((prev) => {
            const createdDates = new Set(created.map((c) => c.date));
            const rest = prev.filter((r) => !createdDates.has(r.date));
            return [...rest, ...created];
          });
        }

        await Promise.all(
          toUpdate.map(async (dateISO) => {
            const id = index.idByDate[dateISO];
            if (!id) return;
            await companyHolidaysApi.update(id, { date: dateISO, name, notes });
          }),
        );

        if (toUpdate.length > 0) {
          setRows((prev) =>
            prev.map((r) =>
              toUpdate.includes(r.date) ? { ...r, name, notes } : r,
            ),
          );
        }
      } catch (e) {
        setError(userVisibleMessageFromUnknown(e, "No se pudieron guardar los festivos del rango."));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [canMutate, companyIdTrim, index.idByDate],
  );

  const clearHolidayMarksBulk = useCallback(
    async (dates: string[]) => {
      if (!companyIdTrim || !canMutate) return;
      const ids = dates
        .map((d) => index.idByDate[d])
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) return;

      setSaving(true);
      setError(null);
      try {
        await companyHolidaysApi.deleteBulk({ ids });
        const idSet = new Set(ids);
        setRows((prev) => prev.filter((r) => !idSet.has(r.id)));
      } catch (e) {
        setError(userVisibleMessageFromUnknown(e, "No se pudieron quitar los festivos del rango."));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [canMutate, companyIdTrim, index.idByDate],
  );

  const holidayList = useMemo(
    () => [...rows].sort((a, b) => a.date.localeCompare(b.date)),
    [rows],
  );

  return {
    holidaysByDate: index.holidaysByDate,
    holidayList,
    loading,
    error,
    saving,
    hydrated: !loading,
    setHolidayMark,
    setHolidayMarksBulk,
    clearHolidayMarksBulk,
    reload,
  };
}
