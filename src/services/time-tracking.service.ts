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
  /** Estado de jornada (`status` en JSON del API). */
  status?: string | null;
}

export interface TimeEntrySummaryDto {
  entries: TimeEntryDto[];
}

/**
 * Texto de descanso alineado con `breakSummary` en GET /api/TimeEntries/rows.
 * Algunos handlers solo persisten o exponen este campo y no `breakMinutes`.
 */
export function breakSummaryFromMinutes(minutes: number): string {
  const n = Math.max(0, Math.round(minutes));
  return `${n} min`;
}

/** Cuerpo POST /api/TimeEntries (CreateTimeEntryRequest, JSON camelCase). */
export interface CreateTimeEntryBody {
  companyId: string;
  userId: string;
  workDate: string;
  startAt: string;
  endAt: string;
  status: string;
  breakMinutes: number;
  /** Opcional pero recomendable si el API persiste el resumen como en filas. */
  breakSummary?: string;
}

/** Cuerpo PUT /api/TimeEntries/{id} — lo omitido suele no cambiar en el handler. */
export interface UpdateTimeEntryBody {
  workDate?: string;
  startAt?: string;
  endAt?: string;
  status?: string;
  breakMinutes?: number;
  breakSummary?: string;
  isManuallyCompleted?: boolean;
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
  const statusRaw = o.status ?? o.Status;

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
    status:
      statusRaw === null || statusRaw === undefined
        ? null
        : typeof statusRaw === "string"
          ? statusRaw
          : String(statusRaw),
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

/**
 * Query para GET /api/TimeEntries/rows (page, pageSize numéricos).
 * Regla general: booleans solo si true, excepto `excludedFromTimeTracking` que admite true/false (nullable).
 */
function buildRowsQuery(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (value === false && key !== "excludedFromTimeTracking") continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Respuesta de `GET /api/TimeEntries/rows` (camelCase o PascalCase).
 * Cada elemento de `items` con `rowKind: "timeEntry"` suele incluir `status` (p. ej. Closed, Vacation, SickLeave).
 */
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
    excludedFromTimeTracking: opts.excludedFromTimeTracking,
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
  /**
   * Filtro nullable (bool?) alineado con backend.
   * - omitido: legacy (no filtra)
   * - true: solo excluidos
   * - false: solo NO excluidos
   */
  excludedFromTimeTracking?: boolean;
  page?: number;
  /** Entre 1 y 200 en backend. */
  pageSize?: number;
  onlyWorkingDaysWithoutWorkReport?: boolean;
  clientCompanyId?: string;
  serviceId?: string;
  workAreaId?: string;
};

/** GET /api/TimeEntries/rows/summary — mismos filtros que `rows` (sin paginación). */
export type TimeEntryRowsSummaryQuery = {
  from: string;
  to: string;
  userId?: string;
  /** Igual que en `rows`: filtro nullable (bool?) por exclusión de fichaje. */
  excludedFromTimeTracking?: boolean;
  hoursPerWorkingDay?: number;
  onlyWorkingDaysWithoutWorkReport?: boolean;
  clientCompanyId?: string;
  serviceId?: string;
  workAreaId?: string;
};

export type TimeEntryRowsSummaryDto = {
  from: string;
  to: string;
  filtersApplied: Record<string, unknown>;
  scope?: { peopleCount?: number; note?: string };
  workingDaysInRange: number;
  hoursPerWorkingDay: number;
  theoreticalCapHours: number;
  workedHoursTotal: number;
  workedMinutesTotal: number;
  donutObjectiveVsWorked: {
    hoursImputedUpToCap: number;
    hoursGapToObjective: number;
    hoursExtraOverObjective: number;
  };
  timeEntryCount: number;
  normalEntryCount: number;
  manualEntryCount: number;
  normalHoursTotal: number;
  manualHoursTotal: number;
  distinctWorkDaysWithEntry: number;
  workingDaysWithoutEntry: number;
  missingHoursAtStandardDay: number;
  percentOfTheoreticalCovered: number;
  kpiTeamGrid: {
    laborablePersonDaySlots: number;
    slotsWithAnyTimeEntry: number;
    slotsWithClosedTimeEntry: number;
    slotsWithoutEntry: number;
    closedEntriesWithServerPart: number;
    closedEntriesWithoutServerPart: number;
  };
  byMonth: Array<{
    year: number;
    month: number;
    workedHours: number;
    theoreticalHours: number;
    timeEntryCount: number;
    distinctWorkDaysWithEntry: number;
  }>;
};

function numSummary(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseTimeEntryRowsSummary(raw: unknown): TimeEntryRowsSummaryDto | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const from = String(o.from ?? o.From ?? "").trim();
  const to = String(o.to ?? o.To ?? "").trim();
  if (!from || !to) return null;

  const donutRaw = (o.donutObjectiveVsWorked ?? o.DonutObjectiveVsWorked ?? {}) as Record<
    string,
    unknown
  >;
  const gridRaw = (o.kpiTeamGrid ?? o.KpiTeamGrid ?? {}) as Record<string, unknown>;
  const scopeRaw = (o.scope ?? o.Scope ?? {}) as Record<string, unknown>;
  const filtersRaw = (o.filtersApplied ?? o.FiltersApplied ?? {}) as Record<string, unknown>;

  const byMonthRaw = o.byMonth ?? o.ByMonth;
  const byMonth: TimeEntryRowsSummaryDto["byMonth"] = Array.isArray(byMonthRaw)
    ? byMonthRaw.map((row) => {
        const r = (row ?? {}) as Record<string, unknown>;
        return {
          year: numSummary(r.year ?? r.Year, 0),
          month: numSummary(r.month ?? r.Month, 0),
          workedHours: numSummary(r.workedHours ?? r.WorkedHours, 0),
          theoreticalHours: numSummary(r.theoreticalHours ?? r.TheoreticalHours, 0),
          timeEntryCount: numSummary(r.timeEntryCount ?? r.TimeEntryCount, 0),
          distinctWorkDaysWithEntry: numSummary(
            r.distinctWorkDaysWithEntry ?? r.DistinctWorkDaysWithEntry,
            0,
          ),
        };
      })
    : [];

  return {
    from,
    to,
    filtersApplied: filtersRaw,
    scope: {
      peopleCount:
        scopeRaw.peopleCount == null && scopeRaw.PeopleCount == null
          ? undefined
          : numSummary(scopeRaw.peopleCount ?? scopeRaw.PeopleCount, 0),
      note: typeof scopeRaw.note === "string" ? scopeRaw.note : undefined,
    },
    workingDaysInRange: numSummary(o.workingDaysInRange ?? o.WorkingDaysInRange, 0),
    hoursPerWorkingDay: numSummary(o.hoursPerWorkingDay ?? o.HoursPerWorkingDay, 8) || 8,
    theoreticalCapHours: numSummary(o.theoreticalCapHours ?? o.TheoreticalCapHours, 0),
    workedHoursTotal: numSummary(o.workedHoursTotal ?? o.WorkedHoursTotal, 0),
    workedMinutesTotal: numSummary(o.workedMinutesTotal ?? o.WorkedMinutesTotal, 0),
    donutObjectiveVsWorked: {
      hoursImputedUpToCap: numSummary(
        donutRaw.hoursImputedUpToCap ?? donutRaw.HoursImputedUpToCap,
        0,
      ),
      hoursGapToObjective: numSummary(
        donutRaw.hoursGapToObjective ?? donutRaw.HoursGapToObjective,
        0,
      ),
      hoursExtraOverObjective: numSummary(
        donutRaw.hoursExtraOverObjective ?? donutRaw.HoursExtraOverObjective,
        0,
      ),
    },
    timeEntryCount: numSummary(o.timeEntryCount ?? o.TimeEntryCount, 0),
    normalEntryCount: numSummary(o.normalEntryCount ?? o.NormalEntryCount, 0),
    manualEntryCount: numSummary(o.manualEntryCount ?? o.ManualEntryCount, 0),
    normalHoursTotal: numSummary(o.normalHoursTotal ?? o.NormalHoursTotal, 0),
    manualHoursTotal: numSummary(o.manualHoursTotal ?? o.ManualHoursTotal, 0),
    distinctWorkDaysWithEntry: numSummary(
      o.distinctWorkDaysWithEntry ?? o.DistinctWorkDaysWithEntry,
      0,
    ),
    workingDaysWithoutEntry: numSummary(
      o.workingDaysWithoutEntry ?? o.WorkingDaysWithoutEntry,
      0,
    ),
    missingHoursAtStandardDay: numSummary(
      o.missingHoursAtStandardDay ?? o.MissingHoursAtStandardDay,
      0,
    ),
    percentOfTheoreticalCovered: numSummary(
      o.percentOfTheoreticalCovered ?? o.PercentOfTheoreticalCovered,
      0,
    ),
    kpiTeamGrid: {
      laborablePersonDaySlots: numSummary(
        gridRaw.laborablePersonDaySlots ?? gridRaw.LaborablePersonDaySlots,
        0,
      ),
      slotsWithAnyTimeEntry: numSummary(
        gridRaw.slotsWithAnyTimeEntry ?? gridRaw.SlotsWithAnyTimeEntry,
        0,
      ),
      slotsWithClosedTimeEntry: numSummary(
        gridRaw.slotsWithClosedTimeEntry ?? gridRaw.SlotsWithClosedTimeEntry,
        0,
      ),
      slotsWithoutEntry: numSummary(gridRaw.slotsWithoutEntry ?? gridRaw.SlotsWithoutEntry, 0),
      closedEntriesWithServerPart: numSummary(
        gridRaw.closedEntriesWithServerPart ?? gridRaw.ClosedEntriesWithServerPart,
        0,
      ),
      closedEntriesWithoutServerPart: numSummary(
        gridRaw.closedEntriesWithoutServerPart ?? gridRaw.ClosedEntriesWithoutServerPart,
        0,
      ),
    },
    byMonth,
  };
}

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

  /** Alta manual de fila de día (jornada, ausencia, etc.) — POST /api/TimeEntries. */
  async createTimeEntry(body: CreateTimeEntryBody): Promise<TimeEntryDto> {
    const raw = await apiClient.post<unknown>("/api/TimeEntries", body);
    return normalizeTimeEntryDto(raw);
  },

  /** Actualiza fila existente — PUT /api/TimeEntries/{id} (204 sin cuerpo). */
  async updateTimeEntry(timeEntryId: string, body: UpdateTimeEntryBody): Promise<void> {
    const id = encodeURIComponent(timeEntryId.trim());
    await apiClient.put<unknown>(`/api/TimeEntries/${id}`, body);
  },

  /** Elimina la fila de fichaje del día — DELETE /api/TimeEntries/{id} (204 sin cuerpo). */
  async deleteTimeEntry(timeEntryId: string, opts?: { signal?: AbortSignal }): Promise<void> {
    const id = encodeURIComponent(timeEntryId.trim());
    await apiClient.delete<unknown>(`/api/TimeEntries/${id}`, { signal: opts?.signal });
  },

  /** Registra una jornada completa manual (Olvidé fichar). */
  async createManualClosedEntry(
    body: Omit<CreateTimeEntryBody, "status">,
  ): Promise<TimeEntryDto> {
    return timeTrackingApi.createTimeEntry({ ...body, status: "Closed" });
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
   * Resumen agregado para KPIs y gráficos (mismos filtros que `rows`, sin paginación).
   */
  async getTimeEntryRowsSummary(
    opts: TimeEntryRowsSummaryQuery & { signal?: AbortSignal },
  ): Promise<TimeEntryRowsSummaryDto> {
    const query = buildRowsQuery({
      from: opts.from,
      to: opts.to,
      userId: opts.userId?.trim() ? opts.userId.trim() : undefined,
      excludedFromTimeTracking: opts.excludedFromTimeTracking,
      hoursPerWorkingDay:
        opts.hoursPerWorkingDay != null && Number.isFinite(opts.hoursPerWorkingDay)
          ? opts.hoursPerWorkingDay
          : undefined,
      onlyWorkingDaysWithoutWorkReport:
        opts.onlyWorkingDaysWithoutWorkReport === true ? true : undefined,
      clientCompanyId: opts.clientCompanyId?.trim() || undefined,
      serviceId: opts.serviceId?.trim() || undefined,
      workAreaId: opts.workAreaId?.trim() || undefined,
    });
    const raw = await apiClient.get<unknown>(`/api/TimeEntries/rows/summary${query}`, {
      signal: opts.signal,
      timeoutMs: TIME_ENTRY_ROWS_TIMEOUT_MS,
    });
    const parsed = parseTimeEntryRowsSummary(raw);
    if (!parsed) {
      throw new Error("Respuesta de resumen de fichajes inválida.");
    }
    return parsed;
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

