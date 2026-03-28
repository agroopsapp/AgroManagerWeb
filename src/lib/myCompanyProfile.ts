export type MyCompanyProfile = {
  /** Id de empresa en API (`/api/Companies`), útil para futuros PATCH. */
  companyId?: string;
  name: string;
  /** Razón social (API: `fiscalName`). */
  fiscalName?: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  /** Logo servido por el backend (`logoUrl`). */
  logoUrl?: string;
  /** Logo en PNG/JPEG como data URL (subida local / PDF). */
  logoDataUrl?: string;
};

/** Valores iniciales del formulario (sin datos de API). */
export const emptyMyCompanyProfile: MyCompanyProfile = {
  name: "",
  fiscalName: "",
  taxId: "",
  address: "",
  phone: "",
  email: "",
  website: "",
};

/** Evento al guardar/borrar perfil en localStorage (sincronizar pestañas / UI). */
export const MY_COMPANY_PROFILE_CHANGED_EVENT = "agromanager-my-company-changed";

const KEY = "agromanager_my_company_profile_v1";

export function getMyCompanyProfile(): MyCompanyProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<MyCompanyProfile> | null;
    if (!p || typeof p !== "object") return null;
    return {
      ...(typeof p.companyId === "string" && p.companyId ? { companyId: p.companyId } : {}),
      name: typeof p.name === "string" ? p.name : "",
      ...(typeof p.fiscalName === "string" ? { fiscalName: p.fiscalName } : {}),
      taxId: typeof p.taxId === "string" ? p.taxId : "",
      address: typeof p.address === "string" ? p.address : "",
      phone: typeof p.phone === "string" ? p.phone : "",
      email: typeof p.email === "string" ? p.email : "",
      website: typeof p.website === "string" ? p.website : "",
      ...(typeof p.logoUrl === "string" && p.logoUrl ? { logoUrl: p.logoUrl } : {}),
      ...(typeof p.logoDataUrl === "string" && p.logoDataUrl.startsWith("data:image/")
        ? { logoDataUrl: p.logoDataUrl }
        : {}),
    };
  } catch {
    return null;
  }
}

export function saveMyCompanyProfile(profile: MyCompanyProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent(MY_COMPANY_PROFILE_CHANGED_EVENT));
  } catch {
    /* quota */
  }
}

export function clearMyCompanyProfile(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent(MY_COMPANY_PROFILE_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

