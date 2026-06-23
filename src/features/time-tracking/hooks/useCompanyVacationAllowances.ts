"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  companyVacationAllowancesApi,
  type CompanyVacationAllowanceDto,
} from "@/services/company-vacation-allowances.service";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";

type Params = {
  /** Empresa del tenant (token); el backend la fuerza para no-SuperAdmin. */
  companyId: string | null | undefined;
  /**
   * Si `false` (Worker): solo consulta el listado — nunca alta/edición/baja.
   * El backend devuelve 401 en mutaciones; el front no las dispara.
   */
  canMutate: boolean;
};

export function useCompanyVacationAllowances({ companyId, canMutate }: Params) {
  const companyIdTrim = companyId?.trim() ?? "";
  const [rows, setRows] = useState<CompanyVacationAllowanceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fetchSeq = useRef(0);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
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
        const list = await companyVacationAllowancesApi.list({
          companyId: companyIdTrim,
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
        setError(
          userVisibleMessageFromUnknown(
            e,
            "No se pudieron cargar los cupos de vacaciones.",
          ),
        );
      } finally {
        if (seq === fetchSeq.current) setLoading(false);
      }
    },
    [companyIdTrim],
  );

  useEffect(() => {
    const ac = new AbortController();
    void reload(ac.signal);
    return () => ac.abort();
  }, [reload]);

  /** Cupos ordenados descendente por año (igual que devuelve el backend). */
  const allowanceList = useMemo(
    () => [...rows].sort((a, b) => b.year - a.year),
    [rows],
  );

  const findByYear = useCallback(
    (year: number): CompanyVacationAllowanceDto | null =>
      rows.find((r) => r.year === year) ?? null,
    [rows],
  );

  const create = useCallback(
    async (body: { year: number; daysAllowed: number }) => {
      if (!companyIdTrim || !canMutate) return null;
      setSaving(true);
      setError(null);
      try {
        const created = await companyVacationAllowancesApi.create({
          companyId: companyIdTrim,
          year: body.year,
          daysAllowed: body.daysAllowed,
        });
        setRows((prev) => {
          const without = prev.filter((r) => r.year !== created.year);
          return [...without, created];
        });
        return created;
      } catch (e) {
        const msg = userVisibleMessageFromUnknown(e, "No se pudo crear el cupo.");
        setError(msg);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [companyIdTrim, canMutate],
  );

  const update = useCallback(
    async (id: string, daysAllowed: number) => {
      if (!companyIdTrim || !canMutate) return;
      setSaving(true);
      setError(null);
      try {
        await companyVacationAllowancesApi.update(id, { daysAllowed });
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, daysAllowed } : r)),
        );
      } catch (e) {
        const msg = userVisibleMessageFromUnknown(e, "No se pudo actualizar el cupo.");
        setError(msg);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [companyIdTrim, canMutate],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!companyIdTrim || !canMutate) return;
      setSaving(true);
      setError(null);
      try {
        await companyVacationAllowancesApi.deleteOne(id);
        setRows((prev) => prev.filter((r) => r.id !== id));
      } catch (e) {
        const msg = userVisibleMessageFromUnknown(e, "No se pudo eliminar el cupo.");
        setError(msg);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [companyIdTrim, canMutate],
  );

  return {
    allowanceList,
    loading,
    error,
    saving,
    hydrated: !loading,
    findByYear,
    create,
    update,
    remove,
    reload,
    clearError: () => setError(null),
  };
}
