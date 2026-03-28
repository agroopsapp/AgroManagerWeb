import { apiClient, ApiError, getApiBaseUrl } from "@/lib/api-client";
import type { MyCompanyProfile } from "@/lib/myCompanyProfile";
import { customerCompanyMock } from "@/lib/customerCompanyMock";
import type {
  ClientCompanyWithAreasCreateBody,
  Company,
  CompanyApiPutBody,
  CompanyApiRow,
  CompanyArea,
} from "@/types";

const BASE = "/api/CustomerCompany";
const COMPANIES = "/api/Companies";
const CLIENT_COMPANIES = "/api/ClientCompanies";

/** En `false` (por defecto) se usan datos mock en localStorage. Para API real: `NEXT_PUBLIC_CUSTOMER_COMPANY_USE_API=true` */
const useRealCustomerCompanyApi =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_CUSTOMER_COMPANY_USE_API === "true";

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
    o.observations ?? o.Observations ?? o.observaciones ?? o.Observaciones ?? "";
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
 */
export function postClientCompanyWithAreas(body: ClientCompanyWithAreasCreateBody): Promise<Company> {
  return apiClient.post<unknown>(`${CLIENT_COMPANIES}/with-areas`, body).then((raw) => {
    const c = normalizeCompany(raw);
    if (c.id) return c;
    return normalizeCompany({
      id: `client-${Date.now()}`,
      name: body.name,
      taxId: body.taxId,
      address: body.address,
      areas: body.areas.map((a, i) => ({
        id: `area-${i}`,
        name: a.name,
        observations: a.observations ?? "",
      })),
    });
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

export const companiesApi = {
  getAll() {
    if (!useRealCustomerCompanyApi) {
      return customerCompanyMock.getAll();
    }
    return apiClient
      .get<unknown>(BASE)
      .then((raw) => unwrapList(raw).map(normalizeCompany))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          return customerCompanyMock.getAll();
        }
        throw e;
      });
  },

  getById(id: string) {
    if (!useRealCustomerCompanyApi) {
      return customerCompanyMock.getById(id);
    }
    return apiClient.get<unknown>(`${BASE}/${id}`).then(normalizeCompany);
  },

  create(body: Omit<Company, "id">) {
    if (!useRealCustomerCompanyApi) {
      return customerCompanyMock.create(body);
    }
    return apiClient.post<unknown>(BASE, body).then(normalizeCompany);
  },

  update(id: string, body: Partial<Company>) {
    if (!useRealCustomerCompanyApi) {
      return customerCompanyMock.update(id, body);
    }
    return apiClient
      .patch<unknown>(`${BASE}/${id}`, { id, ...body })
      .then((res) => (res == null ? normalizeCompany({ id, ...body }) : normalizeCompany(res)));
  },

  delete(id: string) {
    if (!useRealCustomerCompanyApi) {
      return customerCompanyMock.delete(id);
    }
    return apiClient.delete<void>(`${BASE}/${id}`);
  },
};
