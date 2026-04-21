"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { superadminApi } from "@/services";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";
import type { SuperadminCreateCompanyBody, SuperadminParentCompanyDto, SuperadminUpdateCompanyBody } from "@/features/superadmin/types";

export function useSuperadminParentCompanies(enabled: boolean) {
  const [companies, setCompanies] = useState<SuperadminParentCompanyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const list = await superadminApi.listCompanies({ signal });
      if (signal.aborted) return;
      setCompanies(list);
    } catch (e) {
      if (signal.aborted) return;
      setError(userVisibleMessageFromUnknown(e, "No se pudieron cargar las empresas."));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [enabled, load]);

  const filteredCompanies = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => {
      const blob = [
        c.id,
        c.name,
        c.fiscalName,
        c.taxId,
        c.email,
        c.address,
        c.phone,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [companies, filterText]);

  const createCompany = useCallback(async (body: SuperadminCreateCompanyBody) => {
    const created = await superadminApi.createCompany(body);
    setCompanies((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
    return created;
  }, []);

  const updateCompany = useCallback(async (id: string, body: SuperadminUpdateCompanyBody) => {
    await superadminApi.updateCompany(id, body);
    setCompanies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...body, id: c.id, createdAt: c.createdAt } : c)),
    );
  }, []);

  const deleteCompany = useCallback(async (id: string) => {
    await superadminApi.deleteCompany(id);
    setCompanies((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return {
    companies,
    filteredCompanies,
    loading,
    error,
    filterText,
    setFilterText,
    reload: () => {
      const ac = new AbortController();
      return load(ac.signal);
    },
    createCompany,
    updateCompany,
    deleteCompany,
  };
}
