import { apiClient } from "@/lib/api-client";

/**
 * Cupo anual de vacaciones por empresa (servicio HTTP).
 * Permisos backend: Worker → solo GET. Admin / Manager / SuperAdmin → mutaciones.
 * El front no debe disparar create/update/delete si el rol no es admin-like.
 */
const BASE = "/api/CompanyVacationAllowances";

export interface CompanyVacationAllowanceDto {
  id: string;
  companyId: string;
  year: number;
  daysAllowed: number;
  /** UTC ISO-8601. */
  createdAt: string;
}

export interface CompanyVacationAllowanceCreateBody {
  /** El backend ignora este campo si no eres SuperAdmin (usa el del token). */
  companyId?: string;
  year: number;
  daysAllowed: number;
}

export interface CompanyVacationAllowanceUpdateBody {
  /** Único campo editable. El año no se cambia (se conserva histórico). */
  daysAllowed: number;
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

export function normalizeCompanyVacationAllowance(
  input: unknown,
): CompanyVacationAllowanceDto | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const idRaw = o.id ?? o.Id;
  const companyIdRaw = o.companyId ?? o.CompanyId;
  const yearRaw = o.year ?? o.Year;
  const daysRaw = o.daysAllowed ?? o.DaysAllowed;
  const createdAtRaw = o.createdAt ?? o.CreatedAt;

  if (idRaw == null || String(idRaw).trim() === "") return null;
  if (companyIdRaw == null || String(companyIdRaw).trim() === "") return null;

  const year = typeof yearRaw === "number" ? yearRaw : Number(yearRaw);
  const days = typeof daysRaw === "number" ? daysRaw : Number(daysRaw);
  if (!Number.isFinite(year) || !Number.isFinite(days)) return null;

  return {
    id: String(idRaw).trim(),
    companyId: String(companyIdRaw).trim(),
    year: Math.trunc(year),
    daysAllowed: Math.max(0, Math.trunc(days)),
    createdAt: typeof createdAtRaw === "string" ? createdAtRaw : "",
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

export const companyVacationAllowancesApi = {
  /** Lista de cupos (ordenada en backend descendente por `year`). */
  async list(
    opts: { companyId?: string; year?: number; signal?: AbortSignal } = {},
  ): Promise<CompanyVacationAllowanceDto[]> {
    const query = buildQuery({
      companyId: opts.companyId?.trim() || undefined,
      year: opts.year,
    });
    const raw = await apiClient.get<unknown>(`${BASE}${query}`, { signal: opts.signal });
    return unwrapList(raw)
      .map(normalizeCompanyVacationAllowance)
      .filter((x): x is CompanyVacationAllowanceDto => x != null);
  },

  async getById(
    id: string,
    opts?: { signal?: AbortSignal },
  ): Promise<CompanyVacationAllowanceDto> {
    const raw = await apiClient.get<unknown>(
      `${BASE}/${encodeURIComponent(id.trim())}`,
      { signal: opts?.signal },
    );
    const row = normalizeCompanyVacationAllowance(raw);
    if (!row) throw new Error("Respuesta de cupo de vacaciones inválida.");
    return row;
  },

  async create(
    body: CompanyVacationAllowanceCreateBody,
    opts?: { signal?: AbortSignal },
  ): Promise<CompanyVacationAllowanceDto> {
    const raw = await apiClient.post<unknown>(BASE, body, { signal: opts?.signal });
    const row = normalizeCompanyVacationAllowance(raw);
    if (!row) throw new Error("Respuesta al crear el cupo inválida.");
    return row;
  },

  /** Solo edita `daysAllowed`. El backend responde 204 sin cuerpo. */
  async update(
    id: string,
    body: CompanyVacationAllowanceUpdateBody,
    opts?: { signal?: AbortSignal },
  ): Promise<void> {
    await apiClient.put<unknown>(
      `${BASE}/${encodeURIComponent(id.trim())}`,
      body,
      { signal: opts?.signal },
    );
  },

  /** Baja lógica. 204 No Content. */
  async deleteOne(id: string, opts?: { signal?: AbortSignal }): Promise<void> {
    await apiClient.delete<unknown>(
      `${BASE}/${encodeURIComponent(id.trim())}`,
      { signal: opts?.signal },
    );
  },
};
