/**
 * Adapta respuestas de GET/PUT `/api/Companies` al modelo de formulario / localStorage (`MyCompanyProfile`).
 * Contrato backend: ver `CompanyApiRow` y `CompanyApiPutBody` en types.
 */
import { getApiBaseUrl } from "@/lib/api-client";
import type { MyCompanyProfile } from "@/lib/myCompanyProfile";
import type { CompanyApiRow } from "@/types";

/** URL de logo para <img>: absoluta si el API devuelve ruta relativa (usa NEXT_PUBLIC_API_URL). */
export function resolveCompanyLogoForDisplay(logoUrl: string): string {
  const t = logoUrl.trim();
  if (!t) return "";
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("data:")) return t;
  const base = getApiBaseUrl();
  return `${base}${t.startsWith("/") ? "" : "/"}${t}`;
}

/** Fusiona fila API con `logoDataUrl` local (subida del usuario; no viene del servidor). */
export function companyApiRowToMyCompanyProfile(
  row: CompanyApiRow,
  local: MyCompanyProfile | null
): MyCompanyProfile {
  const resolvedLogo = row.logoUrl ? resolveCompanyLogoForDisplay(row.logoUrl) : "";
  return {
    companyId: row.id,
    name: row.name,
    fiscalName: row.fiscalName,
    taxId: row.taxId,
    address: row.address,
    phone: row.phone,
    email: row.email,
    website: row.website,
    ...(resolvedLogo ? { logoUrl: resolvedLogo } : {}),
    ...(local?.logoDataUrl ? { logoDataUrl: local.logoDataUrl } : {}),
  };
}
