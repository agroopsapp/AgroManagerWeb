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
};

