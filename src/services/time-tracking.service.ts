"use client";

import { apiClient } from "@/lib/api-client";

export interface TimeEntryDto {
  id: number;
  /** GUID real del fichaje en backend (`TimeEntries.Id`). */
  timeEntryId: string;
  companyId?: string;
  workerId: number;
  userId?: string;
  workReportId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  workDate: string; // YYYY-MM-DD (date de trabajo)
  checkInUtc: string; // ISO en UTC
  checkOutUtc: string | null; // ISO en UTC o null si sigue abierta
  isEdited: boolean;
  createdAtUtc: string;
  createdBy: number;
  updatedAtUtc: string | null;
  updatedBy: number | null;
  lastModifiedByEmail?: string | null;
  lastModifiedByName?: string | null;
  breakMinutes?: number;
  razon?: string | null;
}

export interface TimeEntrySummaryDto {
  entries: TimeEntryDto[];
}

function toIsoOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toIsoOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeTimeEntryDto(input: unknown): TimeEntryDto {
  const o = (input ?? {}) as Record<string, unknown>;
  const checkInUtc = toIsoOrEmpty(o.checkInUtc ?? o.checkIn ?? o.startAt ?? o.StartAt);
  const checkOutUtc = toIsoOrNull(o.checkOutUtc ?? o.checkOut ?? o.endAt ?? o.EndAt);
  const workDateRaw = o.workDate ?? o.WorkDate ?? o.date ?? o.Date;
  const workDate =
    typeof workDateRaw === "string" && workDateRaw.trim().length > 0
      ? workDateRaw.slice(0, 10)
      : checkInUtc.slice(0, 10);
  const workerIdRaw = o.workerId ?? o.WorkerId ?? o.userId ?? o.UserId;
  const createdAtUtc = toIsoOrEmpty(
    o.createdAtUtc ?? o.CreatedAtUtc ?? o.createdAt ?? o.CreatedAt ?? checkInUtc,
  );
  const updatedAtUtc = toIsoOrNull(
    o.updatedAtUtc ?? o.UpdatedAtUtc ?? o.updatedAt ?? o.UpdatedAt,
  );
  const userIdRaw = o.userId ?? o.UserId ?? o.applicationUserId ?? o.ApplicationUserId;
  const companyIdRaw = o.companyId ?? o.CompanyId;
  const workReportIdRaw = o.workReportId ?? o.WorkReportId;
  const entryUserEmailRaw = o.userEmail ?? o.UserEmail;
  const entryUserNameRaw = o.userName ?? o.UserName ?? o.workerName ?? o.WorkerName;
  const modifiedEmailRaw = o.lastModifiedByEmail ?? o.LastModifiedByEmail;
  const modifiedNameRaw = o.lastModifiedByName ?? o.LastModifiedByName;
  const breakMinutesRaw = o.breakMinutes ?? o.BreakMinutes ?? o.restMinutes ?? o.RestMinutes;
  const razonRaw = o.razon ?? o.Razon ?? o.reason ?? o.Reason;

  const rawId = o.id ?? o.Id;
  const timeEntryId = rawId == null ? "" : String(rawId);
  let normalizedId = Number(rawId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    // Algunos backends envían GUID como id. Generamos un entero estable
    // para mantener compatibilidad con el tipado actual del frontend.
    const raw = String(rawId ?? `${workDate}-${checkInUtc}`);
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash * 31 + raw.charCodeAt(i)) | 0;
    }
    normalizedId = Math.abs(hash) || 1;
  }

  return {
    id: normalizedId,
    timeEntryId,
    companyId: typeof companyIdRaw === "string" ? companyIdRaw : undefined,
    workerId: Number(workerIdRaw ?? 0),
    userId: typeof userIdRaw === "string" ? userIdRaw : undefined,
    workReportId: typeof workReportIdRaw === "string" ? workReportIdRaw : null,
    userName: typeof entryUserNameRaw === "string" ? entryUserNameRaw : null,
    userEmail: typeof entryUserEmailRaw === "string" ? entryUserEmailRaw : null,
    workDate,
    checkInUtc,
    checkOutUtc,
    isEdited: Boolean(o.isEdited ?? o.IsEdited ?? false),
    createdAtUtc,
    createdBy: Number(o.createdBy ?? o.CreatedBy ?? workerIdRaw ?? 0),
    updatedAtUtc,
    updatedBy:
      o.updatedBy == null && o.UpdatedBy == null
        ? null
        : Number(o.updatedBy ?? o.UpdatedBy ?? 0),
    lastModifiedByEmail: typeof modifiedEmailRaw === "string" ? modifiedEmailRaw : null,
    lastModifiedByName: typeof modifiedNameRaw === "string" ? modifiedNameRaw : null,
    breakMinutes:
      breakMinutesRaw == null
        ? 0
        : typeof breakMinutesRaw === "number"
          ? breakMinutesRaw
          : Number.parseInt(String(breakMinutesRaw), 10) || 0,
    razon: typeof razonRaw === "string" ? razonRaw : null,
  };
}

function unwrapEntries(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const entries =
      o.entries ??
      o.Entries ??
      o.value ??
      o.Value ??
      o.data ??
      o.Data ??
      o.items ??
      o.Items ??
      o.results ??
      o.Results;
    if (Array.isArray(entries)) return entries;
  }
  return [];
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.append(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Query para GET /api/TimeEntries/rows (page, pageSize numéricos, booleans solo si true). */
function buildRowsQuery(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (value === false) continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Respuesta paginada de filas de grid (camelCase / PascalCase). */
export type TimeEntryRowsPageDto = {
  page: number;
  pageSize: number;
  totalCount: number;
  filtersApplied: Record<string, unknown>;
  items: unknown[];
};

function parseTimeEntryRowsPage(raw: unknown): TimeEntryRowsPageDto {
  const o = (raw ?? {}) as Record<string, unknown>;
  const itemsRaw = o.items ?? o.Items;
  return {
    page: Number(o.page ?? o.Page ?? 1) || 1,
    pageSize: Number(o.pageSize ?? o.PageSize ?? 0) || 0,
    totalCount: Number(o.totalCount ?? o.TotalCount ?? 0) || 0,
    filtersApplied: (o.filtersApplied ?? o.FiltersApplied ?? {}) as Record<string, unknown>,
    items: Array.isArray(itemsRaw) ? itemsRaw : [],
  };
}

const TIME_ENTRY_ROWS_TIMEOUT_MS = 30_000;
const TIME_ENTRY_ROWS_MAX_PAGE_SIZE = 200;
const TIME_ENTRY_ROWS_MAX_PAGES = 100;

async function fetchTimeEntryRowsPageImpl(
  opts: TimeEntryRowsQuery & { signal?: AbortSignal }
): Promise<TimeEntryRowsPageDto> {
  const pageSize = Math.min(
    TIME_ENTRY_ROWS_MAX_PAGE_SIZE,
    Math.max(1, opts.pageSize ?? 50)
  );
  const page = Math.max(1, opts.page ?? 1);
  const query = buildRowsQuery({
    from: opts.from,
    to: opts.to,
    userId: opts.userId?.trim() ? opts.userId.trim() : undefined,
    page,
    pageSize,
    onlyWorkingDaysWithoutWorkReport:
      opts.onlyWorkingDaysWithoutWorkReport === true ? true : undefined,
    clientCompanyId: opts.clientCompanyId?.trim() || undefined,
    serviceId: opts.serviceId?.trim() || undefined,
    workAreaId: opts.workAreaId?.trim() || undefined,
  });
  const raw = await apiClient.get<unknown>(`/api/TimeEntries/rows${query}`, {
    signal: opts.signal,
    timeoutMs: TIME_ENTRY_ROWS_TIMEOUT_MS,
  });
  return parseTimeEntryRowsPage(raw);
}

export type TimeEntryRowsQuery = {
  from: string;
  to: string;
  /** Si se omite, el backend aplica reglas por rol (todas las personas visibles). */
  userId?: string;
  page?: number;
  /** Entre 1 y 200 en backend. */
  pageSize?: number;
  onlyWorkingDaysWithoutWorkReport?: boolean;
  clientCompanyId?: string;
  serviceId?: string;
  workAreaId?: string;
};

export const timeTrackingApi = {
  /**
   * Devuelve fichajes según permisos del backend.
   * - Sin userId: worker -> suyos; admin/manager -> empresa; superadmin -> todos.
   * - Con userId: backend vuelve a validar permisos.
   */
  async getEntries(
    opts?: { userId?: string; signal?: AbortSignal },
  ): Promise<TimeEntryDto[]> {
    const query = buildQuery({
      userId: opts?.userId?.trim() ? opts.userId.trim() : undefined,
    });
    const data = await apiClient.get<unknown>(`/api/TimeEntries${query}`, {
      signal: opts?.signal,
    });
    return unwrapEntries(data).map(normalizeTimeEntryDto);
  },

  /** Alias semántico para pantalla "Mis fichajes". */
  async getMyEntries(opts?: { signal?: AbortSignal }): Promise<TimeEntryDto[]> {
    const data = await apiClient.get<unknown>("/api/TimeEntries/mine", {
      signal: opts?.signal,
    });
    return unwrapEntries(data).map(normalizeTimeEntryDto);
  },

  /** Marca entrada del trabajador autenticado. */
  async checkIn(): Promise<TimeEntryDto> {
    const raw = await apiClient.post<unknown>("/api/TimeEntries/start", {});
    return normalizeTimeEntryDto(raw);
  },

  /** Finaliza la jornada del trabajador autenticado. */
  async finish(breakMinutes: number): Promise<TimeEntryDto> {
    const raw = await apiClient.post<unknown>("/api/TimeEntries/finish", { breakMinutes });
    return normalizeTimeEntryDto(raw);
  },

  /** Registra una jornada completa manual (Olvidé fichar). */
  async createManualClosedEntry(body: {
    companyId: string;
    userId: string;
    workDate: string;
    startAt: string;
    endAt: string;
    status: "Closed";
    breakMinutes: number;
  }): Promise<TimeEntryDto> {
    const raw = await apiClient.post<unknown>("/api/TimeEntries", body);
    return normalizeTimeEntryDto(raw);
  },

  /**
   * Una página de GET /api/TimeEntries/rows (grid equipo / informes).
   */
  async getTimeEntryRowsPage(
    opts: TimeEntryRowsQuery & { signal?: AbortSignal }
  ): Promise<TimeEntryRowsPageDto> {
    return fetchTimeEntryRowsPageImpl(opts);
  },

  /**
   * Descarga todas las páginas del rango [from, to] para rellenar el grid denso en cliente.
   * El API solo devuelve días con datos; el cruce con calendario hace `useEquipo`.
   */
  async getTimeEntryRowsAllItems(
    opts: Omit<TimeEntryRowsQuery, "page" | "pageSize"> & {
      signal?: AbortSignal;
      pageSize?: number;
      maxPages?: number;
    }
  ): Promise<{ items: unknown[]; totalCount: number; filtersApplied: Record<string, unknown> }> {
    const pageSize = Math.min(
      TIME_ENTRY_ROWS_MAX_PAGE_SIZE,
      Math.max(1, opts.pageSize ?? TIME_ENTRY_ROWS_MAX_PAGE_SIZE)
    );
    const maxPages = opts.maxPages ?? TIME_ENTRY_ROWS_MAX_PAGES;
    const all: unknown[] = [];
    let totalCount = 0;
    let filtersApplied: Record<string, unknown> = {};

    for (let page = 1; page <= maxPages; page++) {
      const parsed = await fetchTimeEntryRowsPageImpl({
        ...opts,
        page,
        pageSize,
      });
      if (page === 1) {
        totalCount = parsed.totalCount;
        filtersApplied = parsed.filtersApplied;
      }
      all.push(...parsed.items);
      if (parsed.items.length === 0) break;
      if (parsed.items.length < pageSize) break;
      if (totalCount > 0 && all.length >= totalCount) break;
    }

    return { items: all, totalCount, filtersApplied };
  },
};

