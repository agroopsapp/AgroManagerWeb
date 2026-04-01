import { apiClient, getApiBaseUrl } from "@/lib/api-client";
import type { MyCompanyProfile } from "@/lib/myCompanyProfile";
import type {
  ClientCompanyWithAreasCreateBody,
  Company,
  CompanyApiPutBody,
  CompanyApiRow,
  CompanyArea,
} from "@/types";

const COMPANIES = "/api/Companies";
const CLIENT_COMPANIES = "/api/ClientCompanies";
const WORK_AREAS = "/api/WorkAreas";

/** Algunos controladores devuelven `{ value: [...] }` o `{ data: [...] }`. */
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

function normalizeCompanyArea(input: unknown): CompanyArea | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const id = o.id ?? o.Id;
  if (id == null || String(id).trim() === "") return null;
  const name = o.name ?? o.Name ?? "";
  const observations =
    o.observations ?? o.Observations ?? o.observaciones ?? o.Observaciones ??
    o.description ?? o.Description ?? "";
  return {
    id: String(id),
    name: name == null ? "" : String(name),
    observations: observations == null ? "" : String(observations),
  };
}

function normalizeCompanyAreas(raw: unknown): CompanyArea[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCompanyArea).filter((x): x is CompanyArea => x !== null);
}

function strOrEmpty(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function normalizeCompanyApiRow(input: unknown): CompanyApiRow | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const rawId = o.id ?? o.Id;
  if (rawId == null || String(rawId).trim() === "") return null;
  const rawCreated = o.createdAt ?? o.CreatedAt ?? "";
  return {
    id: String(rawId),
    name: strOrEmpty(o.name ?? o.Name),
    fiscalName: strOrEmpty(o.fiscalName ?? o.FiscalName),
    taxId: strOrEmpty(o.taxId ?? o.TaxId),
    address: strOrEmpty(o.address ?? o.Address),
    email: strOrEmpty(o.email ?? o.Email),
    phone: strOrEmpty(o.phone ?? o.Phone),
    website: strOrEmpty(o.website ?? o.Website),
    logoUrl: strOrEmpty(o.logoUrl ?? o.LogoUrl),
    createdAt: typeof rawCreated === "string" ? rawCreated : strOrEmpty(rawCreated),
  };
}

/** Lista de empresas del tenant (GET `/api/Companies`). Sin mock. */
export function getCompaniesFromApi(opts?: { signal?: AbortSignal }): Promise<CompanyApiRow[]> {
  return apiClient.get<unknown>(COMPANIES, { signal: opts?.signal }).then((raw) =>
    unwrapList(raw).map(normalizeCompanyApiRow).filter((x): x is CompanyApiRow => x !== null)
  );
}

/**
 * Normaliza la URL del logo mostrada en el cliente (absoluta hacia el API) al formato esperado en PUT.
 * Data URLs no se envían en `logoUrl` (campo solo para URL en servidor).
 */
export function companyLogoUrlForPut(displayUrl: string): string {
  const t = displayUrl.trim();
  if (!t || t.startsWith("data:")) return "";
  const base = getApiBaseUrl();
  if (t.startsWith(base)) {
    const rest = t.slice(base.length);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return t;
}

/** Arma el cuerpo de PUT a partir del formulario; mantiene el contrato `CompanyApiPutBody` en un solo sitio. */
export function buildMyCompanyPutBody(form: MyCompanyProfile): CompanyApiPutBody {
  return {
    name: form.name.trim(),
    fiscalName: (form.fiscalName ?? "").trim(),
    taxId: form.taxId.trim(),
    address: form.address.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    website: form.website.trim(),
    logoUrl: companyLogoUrlForPut(form.logoUrl ?? ""),
  };
}

/** Actualiza empresa (PUT `/api/Companies/{id}`). */
export function putCompanyOnApi(id: string, body: CompanyApiPutBody): Promise<CompanyApiRow> {
  return apiClient.put<unknown>(`${COMPANIES}/${encodeURIComponent(id)}`, body).then((raw) => {
    const row = normalizeCompanyApiRow(raw);
    if (row) return row;
    return {
      id,
      name: body.name,
      fiscalName: body.fiscalName,
      taxId: body.taxId,
      address: body.address,
      email: body.email,
      phone: body.phone,
      website: body.website,
      logoUrl: body.logoUrl,
      createdAt: "",
    };
  });
}

/**
 * Crea empresa cliente con áreas (POST `/api/ClientCompanies/with-areas`).
 * `body.companyId` debe ser el GUID de la empresa del tenant (p. ej. primer elemento de GET `/api/Companies`).
 *
 * La respuesta viene envuelta: `{ clientCompany: {...}, workAreas: [...] }`.
 * Extraemos la empresa y mapeamos las áreas (el backend devuelve `description`, no `observations`).
 */
export function postClientCompanyWithAreas(body: ClientCompanyWithAreasCreateBody): Promise<Company> {
  return apiClient.post<unknown>(`${CLIENT_COMPANIES}/with-areas`, body).then((raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const companyPayload = o.clientCompany ?? o.ClientCompany ?? raw;
    const areasPayload = o.workAreas ?? o.WorkAreas;

    const c = normalizeCompany(companyPayload);
    if (Array.isArray(areasPayload) && areasPayload.length > 0) {
      c.areas = normalizeCompanyAreas(areasPayload);
    }
    if (c.id) return c;
    throw new Error("Respuesta invalida del backend al crear empresa.");
  });
}

function normalizeCompany(input: unknown): Company {
  const o = (input ?? {}) as Record<string, unknown>;

  const rawId =
    o.id ??
    o.Id ??
    o.companyId ??
    o.CompanyId ??
    o.customerCompanyId ??
    o.CustomerCompanyId;
  const rawName = o.name ?? o.Name;
  const rawTax =
    o.taxId ??
    o.TaxId ??
    o.cif ??
    o.Cif ??
    o.nif ??
    o.Nif ??
    "";
  const rawAddress =
    o.address ?? o.Address ?? o.location ?? o.Location ?? "";
  const rawAreas = o.areas ?? o.Areas;

  return {
    id: rawId == null ? "" : String(rawId),
    name: rawName == null ? "" : String(rawName),
    taxId: rawTax == null ? "" : String(rawTax),
    address: rawAddress == null ? "" : String(rawAddress),
    areas: normalizeCompanyAreas(rawAreas),
  };
}

/**
 * GET /api/ClientCompanies/{id}/with-areas → ClientCompanyWithWorkAreasDto.
 * Devuelve la empresa con todas sus áreas de trabajo; útil para el formulario de edición.
 */
export function getClientCompanyWithAreas(id: string): Promise<Company> {
  return apiClient
    .get<unknown>(`${CLIENT_COMPANIES}/${encodeURIComponent(id)}/with-areas`)
    .then((raw) => {
      const o = (raw ?? {}) as Record<string, unknown>;
      const companyPayload = o.clientCompany ?? o.ClientCompany ?? raw;
      const areasPayload = o.workAreas ?? o.WorkAreas;

      const c = normalizeCompany(companyPayload);
      if (Array.isArray(areasPayload) && areasPayload.length > 0) {
        c.areas = normalizeCompanyAreas(areasPayload);
      }
      return c;
    });
}

/** DELETE /api/WorkAreas/{id} — elimina un área de trabajo existente. */
export function deleteWorkArea(id: string): Promise<void> {
  return apiClient.delete<void>(`${WORK_AREAS}/${encodeURIComponent(id)}`);
}

export const companiesApi = {
  /** GET /api/ClientCompanies — lista de empresas cliente. */
  getAll(): Promise<Company[]> {
    return apiClient
      .get<unknown>(CLIENT_COMPANIES)
      .then((raw) => unwrapList(raw).map(normalizeCompany));
  },

  /** GET /api/ClientCompanies/{id} */
  getById(id: string): Promise<Company> {
    return apiClient
      .get<unknown>(`${CLIENT_COMPANIES}/${encodeURIComponent(id)}`)
      .then(normalizeCompany);
  },

  /** PUT /api/ClientCompanies/{id}/with-areas */
  update(
    id: string,
    body: {
      name: string;
      taxId: string;
      address: string;
      areas: { id: string | null; name: string; observations: string | null }[];
    },
  ): Promise<Company> {
    return apiClient
      .put<unknown>(
        `${CLIENT_COMPANIES}/${encodeURIComponent(id)}/with-areas`,
        body,
      )
      .then((raw) => {
        const o = (raw ?? {}) as Record<string, unknown>;
        const companyPayload = o.clientCompany ?? o.ClientCompany ?? raw;
        const areasPayload = o.workAreas ?? o.WorkAreas;

        const c = normalizeCompany(companyPayload);
        if (Array.isArray(areasPayload) && areasPayload.length > 0) {
          c.areas = normalizeCompanyAreas(areasPayload);
        }
        if (c.id) return c;
        throw new Error("Respuesta invalida del backend al actualizar empresa.");
      });
  },

  /** DELETE /api/ClientCompanies/{id} */
  delete(id: string): Promise<void> {
    return apiClient.delete<void>(
      `${CLIENT_COMPANIES}/${encodeURIComponent(id)}`,
    );
  },
};
