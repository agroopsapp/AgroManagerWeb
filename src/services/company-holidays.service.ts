import { apiClient } from "@/lib/api-client";

/**
 * Festivos de empresa (servicio HTTP del backend).
 * En backend: Worker → solo GET; Admin / Manager / SuperAdmin → mutaciones.
 * En front: no llamar create/update/delete si el rol no es admin-like (`useCompanyHolidays` + `canMutate`).
 */
const BASE = "/api/CompanyHolidays";

export interface CompanyHolidayDto {
  id: string;
  companyId: string;
  /** YYYY-MM-DD */
  date: string;
  name: string;
  notes: string | null;
}

export interface CompanyHolidayCreateBody {
  companyId: string;
  date: string;
  name: string;
  notes?: string | null;
}

export interface CompanyHolidayBulkCreateBody {
  companyId: string;
  items: Array<{ date: string; name: string; notes?: string | null }>;
}

export interface CompanyHolidayUpdateBody {
  date?: string;
  name?: string;
  notes?: string | null;
}

export interface CompanyHolidayBulkDeleteBody {
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
      o.Results ??
      o.entries ??
      o.Entries;
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

export function normalizeCompanyHoliday(input: unknown): CompanyHolidayDto | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const idRaw = o.id ?? o.Id;
  const companyIdRaw = o.companyId ?? o.CompanyId;
  const date = normalizeDate(o.date ?? o.Date);
  const nameRaw = o.name ?? o.Name;
  if (idRaw == null || String(idRaw).trim() === "") return null;
  if (companyIdRaw == null || String(companyIdRaw).trim() === "") return null;
  if (!date) return null;
  const name = nameRaw == null ? "" : String(nameRaw).trim();
  const notesRaw = o.notes ?? o.Notes;
  const notes =
    notesRaw === null || notesRaw === undefined
      ? null
      : String(notesRaw).trim()
        ? String(notesRaw).trim()
        : null;
  return {
    id: String(idRaw).trim(),
    companyId: String(companyIdRaw).trim(),
    date,
    name: name || "Festivo",
    notes,
  };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.append(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const companyHolidaysApi = {
  async list(
    opts: { companyId?: string; year?: number; signal?: AbortSignal },
  ): Promise<CompanyHolidayDto[]> {
    const query = buildQuery({
      companyId: opts.companyId?.trim() || undefined,
      year: opts.year,
    });
    const raw = await apiClient.get<unknown>(`${BASE}${query}`, { signal: opts.signal });
    return unwrapList(raw)
      .map(normalizeCompanyHoliday)
      .filter((x): x is CompanyHolidayDto => x != null);
  },

  async getById(id: string, opts?: { signal?: AbortSignal }): Promise<CompanyHolidayDto> {
    const raw = await apiClient.get<unknown>(`${BASE}/${encodeURIComponent(id.trim())}`, {
      signal: opts?.signal,
    });
    const row = normalizeCompanyHoliday(raw);
    if (!row) throw new Error("Respuesta de festivo de empresa inválida.");
    return row;
  },

  async create(body: CompanyHolidayCreateBody, opts?: { signal?: AbortSignal }): Promise<CompanyHolidayDto> {
    const raw = await apiClient.post<unknown>(BASE, body, { signal: opts?.signal });
    const row = normalizeCompanyHoliday(raw);
    if (!row) throw new Error("Respuesta al crear festivo inválida.");
    return row;
  },

  async createBulk(
    body: CompanyHolidayBulkCreateBody,
    opts?: { signal?: AbortSignal },
  ): Promise<CompanyHolidayDto[]> {
    const raw = await apiClient.post<unknown>(`${BASE}/bulk`, body, { signal: opts?.signal });
    return unwrapList(raw)
      .map(normalizeCompanyHoliday)
      .filter((x): x is CompanyHolidayDto => x != null);
  },

  async update(
    id: string,
    body: CompanyHolidayUpdateBody,
    opts?: { signal?: AbortSignal },
  ): Promise<void> {
    await apiClient.put<unknown>(`${BASE}/${encodeURIComponent(id.trim())}`, body, {
      signal: opts?.signal,
    });
  },

  async deleteOne(id: string, opts?: { signal?: AbortSignal }): Promise<void> {
    await apiClient.delete<unknown>(`${BASE}/${encodeURIComponent(id.trim())}`, {
      signal: opts?.signal,
    });
  },

  async deleteBulk(body: CompanyHolidayBulkDeleteBody, opts?: { signal?: AbortSignal }): Promise<void> {
    await apiClient.delete<unknown>(`${BASE}/bulk`, { body, signal: opts?.signal });
  },
};
