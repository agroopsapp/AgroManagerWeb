import { apiClient } from "@/lib/api-client";
import type {
  ApiErrorLogPagedResultDto,
  ApiErrorLogRecordDto,
  SuperadminCreateCompanyBody,
  SuperadminParentCompanyDto,
  SuperadminUpdateCompanyBody,
} from "@/features/superadmin/types";
import type { User } from "@/types";

const BASE = "/api/superadmin";

function strOrEmpty(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function normalizeCompany(input: unknown): SuperadminParentCompanyDto | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const id = o.id ?? o.Id;
  if (id == null || String(id).trim() === "") return null;
  const createdAt = o.createdAt ?? o.CreatedAt ?? "";
  return {
    id: String(id),
    name: strOrEmpty(o.name ?? o.Name),
    fiscalName: strOrEmpty(o.fiscalName ?? o.FiscalName),
    taxId: strOrEmpty(o.taxId ?? o.TaxId),
    address: strOrEmpty(o.address ?? o.Address),
    email: strOrEmpty(o.email ?? o.Email),
    phone: strOrEmpty(o.phone ?? o.Phone),
    website: strOrEmpty(o.website ?? o.Website),
    logoUrl: strOrEmpty(o.logoUrl ?? o.LogoUrl),
    createdAt: typeof createdAt === "string" ? createdAt : strOrEmpty(createdAt),
  };
}

function normalizeErrorRecord(input: unknown): ApiErrorLogRecordDto | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const id = o.id ?? o.Id;
  if (id == null || String(id).trim() === "") return null;
  const codigo = o.codigoHttp ?? o.CodigoHttp ?? 0;
  return {
    id: String(id),
    fechaHoraUtc: strOrEmpty(o.fechaHoraUtc ?? o.FechaHoraUtc),
    usuarioId: o.usuarioId != null ? String(o.usuarioId) : o.UsuarioId != null ? String(o.UsuarioId) : null,
    companyId: o.companyId != null ? String(o.companyId) : o.CompanyId != null ? String(o.CompanyId) : null,
    rolNombre: o.rolNombre != null ? String(o.rolNombre) : o.RolNombre != null ? String(o.RolNombre) : null,
    codigoHttp: typeof codigo === "number" ? codigo : Number(codigo) || 0,
    metodoHttp: strOrEmpty(o.metodoHttp ?? o.MetodoHttp),
    rutaEndpoint: strOrEmpty(o.rutaEndpoint ?? o.RutaEndpoint),
    traceId: o.traceId != null ? String(o.traceId) : o.TraceId != null ? String(o.TraceId) : null,
    tipoExcepcion:
      o.tipoExcepcion != null ? String(o.tipoExcepcion) : o.TipoExcepcion != null ? String(o.TipoExcepcion) : null,
    mensajeError:
      o.mensajeError != null ? String(o.mensajeError) : o.MensajeError != null ? String(o.MensajeError) : null,
  };
}

/** Respuesta lista: array plano o envoltorio típico ASP.NET. */
function unwrapList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const inner =
      o.value ?? o.Value ?? o.data ?? o.Data ?? o.items ?? o.Items ?? o.results ?? o.Results;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

interface ApiUserRow {
  id?: unknown;
  Id?: unknown;
  name?: unknown;
  Name?: unknown;
  email?: unknown;
  Email?: unknown;
  phone?: unknown;
  Phone?: unknown;
  telefono?: unknown;
  Telefono?: unknown;
  roleId?: unknown;
  RoleId?: unknown;
  roleName?: unknown;
  RoleName?: unknown;
  companyId?: unknown;
  CompanyId?: unknown;
  companyName?: unknown;
  CompanyName?: unknown;
  excludedFromTimeTracking?: unknown;
  ExcludedFromTimeTracking?: unknown;
}

function parseExcludedLoose(u: ApiUserRow): boolean {
  const v = u.excludedFromTimeTracking ?? u.ExcludedFromTimeTracking;
  if (v === true) return true;
  if (v === false || v == null) return false;
  if (typeof v === "string" && v.toLowerCase() === "true") return true;
  return false;
}

function mapSuperadminApiUserToUser(row: unknown): User | null {
  if (!row || typeof row !== "object") return null;
  const u = row as ApiUserRow;
  const id = u.id ?? u.Id;
  if (id == null || String(id).trim() === "") return null;
  const phone = (u.telefono ?? u.Telefono ?? u.phone ?? u.Phone ?? "") as string;
  const roleId = u.roleId ?? u.RoleId;
  return {
    id: String(id),
    name: strOrEmpty(u.name ?? u.Name),
    email: strOrEmpty(u.email ?? u.Email),
    phone: typeof phone === "string" ? phone.trim() : "",
    roleId: roleId != null ? String(roleId) : "",
    roleName: u.roleName != null ? String(u.roleName) : u.RoleName != null ? String(u.RoleName) : undefined,
    companyId: u.companyId != null ? String(u.companyId) : u.CompanyId != null ? String(u.CompanyId) : undefined,
    companyName:
      u.companyName != null ? String(u.companyName) : u.CompanyName != null ? String(u.CompanyName) : undefined,
    excludedFromTimeTracking: parseExcludedLoose(u),
  };
}

function normalizePagedErrors(raw: unknown): ApiErrorLogPagedResultDto {
  if (!raw || typeof raw !== "object") {
    return { items: [], totalCount: 0, page: 1, pageSize: 50 };
  }
  const o = raw as Record<string, unknown>;
  const itemsRaw = o.items ?? o.Items;
  const items = Array.isArray(itemsRaw)
    ? itemsRaw.map(normalizeErrorRecord).filter((x): x is ApiErrorLogRecordDto => x !== null)
    : [];
  const totalCount = Number(o.totalCount ?? o.TotalCount ?? items.length) || 0;
  const page = Number(o.page ?? o.Page ?? 1) || 1;
  const pageSize = Number(o.pageSize ?? o.PageSize ?? 50) || 50;
  return { items, totalCount, page, pageSize };
}

export const superadminApi = {
  listCompanies(opts?: { signal?: AbortSignal }): Promise<SuperadminParentCompanyDto[]> {
    return apiClient.get<unknown>(`${BASE}/companies`, { signal: opts?.signal }).then((raw) => {
      if (!Array.isArray(raw)) return [];
      return raw.map(normalizeCompany).filter((x): x is SuperadminParentCompanyDto => x !== null);
    });
  },

  getCompany(id: string, opts?: { signal?: AbortSignal }): Promise<SuperadminParentCompanyDto> {
    return apiClient.get<unknown>(`${BASE}/companies/${encodeURIComponent(id)}`, { signal: opts?.signal }).then((raw) => {
      const c = normalizeCompany(raw);
      if (!c) throw new Error("Respuesta de empresa inválida.");
      return c;
    });
  },

  createCompany(body: SuperadminCreateCompanyBody, opts?: { signal?: AbortSignal }): Promise<SuperadminParentCompanyDto> {
    return apiClient.post<unknown>(`${BASE}/companies`, body, { signal: opts?.signal }).then((raw) => {
      const c = normalizeCompany(raw);
      if (!c) throw new Error("Respuesta de creación inválida.");
      return c;
    });
  },

  updateCompany(
    id: string,
    body: SuperadminUpdateCompanyBody,
    opts?: { signal?: AbortSignal },
  ): Promise<void> {
    return apiClient.put<void>(`${BASE}/companies/${encodeURIComponent(id)}`, body, { signal: opts?.signal });
  },

  deleteCompany(id: string, opts?: { signal?: AbortSignal }): Promise<void> {
    return apiClient.delete<void>(`${BASE}/companies/${encodeURIComponent(id)}`, { signal: opts?.signal });
  },

  /** GET `/api/superadmin/companies/{companyId}/users` (solo SuperAdmin). */
  listCompanyUsers(companyId: string, opts?: { signal?: AbortSignal }): Promise<User[]> {
    const id = companyId.trim();
    return apiClient
      .get<unknown>(`${BASE}/companies/${encodeURIComponent(id)}/users`, { signal: opts?.signal })
      .then((raw) =>
        unwrapList(raw)
          .map(mapSuperadminApiUserToUser)
          .filter((x): x is User => x !== null),
      );
  },

  listApiErrors(
    page: number,
    pageSize: number,
    opts?: { signal?: AbortSignal },
  ): Promise<ApiErrorLogPagedResultDto> {
    const ps = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const p = Math.max(1, Math.floor(page));
    const q = new URLSearchParams({ page: String(p), pageSize: String(ps) });
    return apiClient
      .get<unknown>(`${BASE}/registros-errores-api?${q.toString()}`, { signal: opts?.signal })
      .then(normalizePagedErrors);
  },

  getApiError(id: string, opts?: { signal?: AbortSignal }): Promise<ApiErrorLogRecordDto> {
    return apiClient
      .get<unknown>(`${BASE}/registros-errores-api/${encodeURIComponent(id)}`, { signal: opts?.signal })
      .then((raw) => {
        const r = normalizeErrorRecord(raw);
        if (!r) throw new Error("Respuesta de error API inválida.");
        return r;
      });
  },
};
