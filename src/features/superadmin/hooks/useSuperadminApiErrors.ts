"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { superadminApi } from "@/services";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";
import type { ApiErrorLogRecordDto } from "@/features/superadmin/types";

const DEFAULT_PAGE_SIZE = 50;

export function useSuperadminApiErrors(enabled: boolean) {
  const [items, setItems] = useState<ApiErrorLogRecordDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterText, setFilterText] = useState("");
  const [filterHttp, setFilterHttp] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterCompanyId, setFilterCompanyId] = useState("");
  const [filterUsuarioId, setFilterUsuarioId] = useState("");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApiErrorLogRecordDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (p: number, ps: number, signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await superadminApi.listApiErrors(p, ps, { signal });
        if (signal.aborted) return;
        setItems(res.items);
        setTotalCount(res.totalCount);
      } catch (e) {
        if (signal.aborted) return;
        setError(userVisibleMessageFromUnknown(e, "No se pudieron cargar los errores."));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    loadPage(page, pageSize, ac.signal);
    return () => ac.abort();
  }, [enabled, page, pageSize, loadPage]);

  const filteredItems = useMemo(() => {
    const t = filterText.trim().toLowerCase();
    const http = filterHttp.trim();
    const met = filterMethod.trim().toUpperCase();
    const co = filterCompanyId.trim().toLowerCase();
    const us = filterUsuarioId.trim().toLowerCase();

    return items.filter((row) => {
      if (http && String(row.codigoHttp) !== http) return false;
      if (met && row.metodoHttp.toUpperCase() !== met) return false;
      if (co) {
        const cid = row.companyId?.toLowerCase() ?? "";
        if (!cid.includes(co)) return false;
      }
      if (us) {
        const uid = row.usuarioId?.toLowerCase() ?? "";
        if (!uid.includes(us)) return false;
      }
      if (t) {
        const blob = [
          row.mensajeError,
          row.rutaEndpoint,
          row.traceId,
          row.tipoExcepcion,
          row.rolNombre,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!blob.includes(t)) return false;
      }
      return true;
    });
  }, [items, filterText, filterHttp, filterMethod, filterCompanyId, filterUsuarioId]);

  const openDetail = useCallback((id: string) => {
    setDetailId(id);
    setDetail(null);
    setDetailError(null);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  useEffect(() => {
    if (!detailId || !enabled) return;
    const ac = new AbortController();
    setDetailLoading(true);
    setDetailError(null);
    superadminApi
      .getApiError(detailId, { signal: ac.signal })
      .then((r) => {
        if (!ac.signal.aborted) setDetail(r);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setDetailError(userVisibleMessageFromUnknown(e, "No se pudo cargar el detalle."));
      })
      .finally(() => {
        if (!ac.signal.aborted) setDetailLoading(false);
      });
    return () => ac.abort();
  }, [detailId, enabled]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const reload = useCallback(() => {
    const ac = new AbortController();
    return loadPage(page, pageSize, ac.signal);
  }, [loadPage, page, pageSize]);

  return {
    items: filteredItems,
    totalCount,
    page,
    pageSize,
    setPage,
    setPageSize: (n: number) => {
      setPage(1);
      setPageSize(Math.min(100, Math.max(1, n)));
    },
    loading,
    error,
    filterText,
    setFilterText,
    filterHttp,
    setFilterHttp,
    filterMethod,
    setFilterMethod,
    filterCompanyId,
    setFilterCompanyId,
    filterUsuarioId,
    setFilterUsuarioId,
    reload,
    totalPages,
    detailId,
    detail,
    detailLoading,
    detailError,
    openDetail,
    closeDetail,
  };
}
