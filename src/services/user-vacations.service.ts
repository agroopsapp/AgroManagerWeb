import { apiClient } from "@/lib/api-client";

/**
 * API de negocio de vacaciones (`/api/UserVacations`).
 * Crea/borra fichajes con `status: Vacation` (valida cupo y festivos).
 */
const BASE = "/api/UserVacations";

export interface UserVacationDto {
  /** Id del fichaje (`TimeEntries.Id`); sirve para DELETE. */
  id: string;
  companyId: string;
  userId: string;
  userName: string | null;
  /** YYYY-MM-DD */
  date: string;
}

export interface UserVacationBalanceDto {
  userId: string;
  year: number;
  daysAllowed: number | null;
  usedDays: number;
  remainingDays: number | null;
}

export interface UserVacationCreateBody {
  companyId: string;
  userId: string;
  date: string;
  confirmOverlapsCompanyHoliday?: boolean;
}

export interface UserVacationBulkCreateBody {
  companyId: string;
  userId: string;
  dates: string[];
  confirmOverlapsCompanyHoliday?: boolean;
}

export interface UserVacationBulkDeleteBody {
  ids: string[];
}

function unwrapList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const inner =
      o.value ??
      o.Value ??
      o.data ??
      o.Data ??
      o.items ??
      o.Items ??
      o.results ??
      o.Results;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

function normalizeDate(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "";
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function numOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function numOrZero(raw: unknown): number {
  const n = numOrNull(raw);
  return n ?? 0;
}

export function normalizeUserVacation(input: unknown): UserVacationDto | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const idRaw = o.id ?? o.Id;
  const companyIdRaw = o.companyId ?? o.CompanyId;
  const userIdRaw = o.userId ?? o.UserId;
  const date = normalizeDate(o.date ?? o.Date);
  if (idRaw == null || String(idRaw).trim() === "") return null;
  if (companyIdRaw == null || String(companyIdRaw).trim() === "") return null;
  if (userIdRaw == null || String(userIdRaw).trim() === "") return null;
  if (!date) return null;
  const userNameRaw = o.userName ?? o.UserName;
  const userName =
    userNameRaw === null || userNameRaw === undefined
      ? null
      : String(userNameRaw).trim()
        ? String(userNameRaw).trim()
        : null;
  return {
    id: String(idRaw).trim(),
    companyId: String(companyIdRaw).trim(),
    userId: String(userIdRaw).trim(),
    userName,
    date,
  };
}

export function normalizeUserVacationBalance(input: unknown): UserVacationBalanceDto | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const userIdRaw = o.userId ?? o.UserId;
  const yearRaw = o.year ?? o.Year;
  if (userIdRaw == null || String(userIdRaw).trim() === "") return null;
  const year = typeof yearRaw === "number" ? yearRaw : Number(yearRaw);
  if (!Number.isFinite(year)) return null;
  return {
    userId: String(userIdRaw).trim(),
    year: Math.trunc(year),
    daysAllowed: numOrNull(o.daysAllowed ?? o.DaysAllowed),
    usedDays: numOrZero(o.usedDays ?? o.UsedDays),
    remainingDays: numOrNull(o.remainingDays ?? o.RemainingDays),
  };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const userVacationsApi = {
  async list(
    opts: {
      companyId?: string;
      userId?: string;
      from?: string;
      to?: string;
      year?: number;
      signal?: AbortSignal;
    } = {},
  ): Promise<UserVacationDto[]> {
    const query = buildQuery({
      companyId: opts.companyId?.trim() || undefined,
      userId: opts.userId?.trim() || undefined,
      from: opts.from,
      to: opts.to,
      year: opts.year,
    });
    const raw = await apiClient.get<unknown>(`${BASE}${query}`, { signal: opts.signal });
    return unwrapList(raw)
      .map(normalizeUserVacation)
      .filter((x): x is UserVacationDto => x != null);
  },

  async mine(
    opts: { from?: string; to?: string; year?: number; signal?: AbortSignal } = {},
  ): Promise<UserVacationDto[]> {
    const query = buildQuery({
      from: opts.from,
      to: opts.to,
      year: opts.year,
    });
    const raw = await apiClient.get<unknown>(`${BASE}/mine${query}`, { signal: opts.signal });
    return unwrapList(raw)
      .map(normalizeUserVacation)
      .filter((x): x is UserVacationDto => x != null);
  },

  async balance(
    userId: string,
    year: number,
    opts?: { signal?: AbortSignal },
  ): Promise<UserVacationBalanceDto> {
    const query = buildQuery({ userId: userId.trim(), year });
    const raw = await apiClient.get<unknown>(`${BASE}/balance${query}`, {
      signal: opts?.signal,
    });
    const row = normalizeUserVacationBalance(raw);
    if (!row) throw new Error("Respuesta de saldo de vacaciones inválida.");
    return row;
  },

  async getById(id: string, opts?: { signal?: AbortSignal }): Promise<UserVacationDto> {
    const raw = await apiClient.get<unknown>(`${BASE}/${encodeURIComponent(id.trim())}`, {
      signal: opts?.signal,
    });
    const row = normalizeUserVacation(raw);
    if (!row) throw new Error("Respuesta de vacación inválida.");
    return row;
  },

  async create(
    body: UserVacationCreateBody,
    opts?: { signal?: AbortSignal },
  ): Promise<UserVacationDto> {
    const raw = await apiClient.post<unknown>(BASE, body, { signal: opts?.signal });
    const row = normalizeUserVacation(raw);
    if (!row) throw new Error("Respuesta al crear vacación inválida.");
    return row;
  },

  async createBulk(
    body: UserVacationBulkCreateBody,
    opts?: { signal?: AbortSignal },
  ): Promise<UserVacationDto[]> {
    const raw = await apiClient.post<unknown>(`${BASE}/bulk`, body, { signal: opts?.signal });
    return unwrapList(raw)
      .map(normalizeUserVacation)
      .filter((x): x is UserVacationDto => x != null);
  },

  async deleteOne(id: string, opts?: { signal?: AbortSignal }): Promise<void> {
    await apiClient.delete<unknown>(`${BASE}/${encodeURIComponent(id.trim())}`, {
      signal: opts?.signal,
    });
  },

  async deleteBulk(body: UserVacationBulkDeleteBody, opts?: { signal?: AbortSignal }): Promise<void> {
    await apiClient.delete<unknown>(`${BASE}/bulk`, { body, signal: opts?.signal });
  },
};
