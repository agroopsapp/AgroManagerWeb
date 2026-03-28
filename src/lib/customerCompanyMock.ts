import type { Company, CompanyArea } from "@/types";

const STORAGE_KEY = "agromanager_customer_companies_mock_v1";

function coerceArea(raw: unknown): CompanyArea | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = o.id != null ? String(o.id) : "";
  const name = o.name != null ? String(o.name) : "";
  if (!id) return null;
  const obs =
    o.observations ??
    o.Observations ??
    o.observaciones ??
    o.Observaciones ??
    "";
  return {
    id,
    name,
    observations: obs == null ? "" : String(obs),
  };
}

function coerceAreas(raw: unknown): CompanyArea[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceArea).filter((x): x is CompanyArea => x !== null);
}

/** Coincide con el companyId de pruebas en trabajadores (users page). */
const DEMO: Company[] = [
  {
    id: "356d0a75-654a-4d07-b65c-25f97f854178",
    name: "Agro Demo S.L.",
    taxId: "B12345678",
    address: "Calle Mayor 1, 09001 Burgos",
    areas: [
      {
        id: "ar-demo-1",
        name: "Finca Norte",
        observations: "Regadío por pivote. 45 ha cereal.",
      },
      {
        id: "ar-demo-2",
        name: "Nave maquinaria",
        observations: "Acceso por puerta lateral. Horario 8–14 h.",
      },
    ],
  },
  {
    id: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
    name: "Granjas Unidas Sociedad Cooperativa",
    taxId: "F87654321",
    address: "Polígono Industrial Sur, parcela 12, Sevilla",
    areas: [],
  },
  {
    id: "b2c3d4e5-f6a7-4890-b123-456789abcdef",
    name: "Campo y Ganadería del Norte",
    taxId: "B10876543",
    address: "Carretera N-1 km 42, Miranda de Ebro",
    areas: [],
  },
];

function coerceCompany(raw: unknown): Company | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = o.id != null ? String(o.id) : "";
  const name = o.name != null ? String(o.name) : "";
  if (!id || !name) return null;
  const areasRaw = o.areas ?? o.Areas;
  const logoRaw = o.logoUrl ?? o.logo_url ?? o.LogoUrl;
  return {
    id,
    name,
    taxId: o.taxId != null ? String(o.taxId) : "",
    address: o.address != null ? String(o.address) : "",
    ...(logoRaw != null && String(logoRaw).trim() !== ""
      ? { logoUrl: String(logoRaw).trim() }
      : {}),
    areas: coerceAreas(areasRaw),
  };
}

function readList(): Company[] {
  if (typeof window === "undefined") return DEMO.map((c) => ({ ...c }));
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = DEMO.map((c) => ({ ...c }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEMO.map((c) => ({ ...c }));
    return parsed.map(coerceCompany).filter((x): x is Company => x !== null);
  } catch {
    return DEMO.map((c) => ({ ...c }));
  }
}

function writeList(list: Company[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

export const customerCompanyMock = {
  getAll(): Promise<Company[]> {
    return Promise.resolve(readList());
  },

  getById(id: string): Promise<Company> {
    const c = readList().find((x) => x.id === id);
    if (!c) return Promise.reject(new Error("Empresa no encontrada."));
    return Promise.resolve({ ...c });
  },

  create(body: Omit<Company, "id">): Promise<Company> {
    const list = readList();
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `cc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const row: Company = {
      id,
      name: body.name,
      taxId: body.taxId ?? "",
      address: body.address ?? "",
      areas: Array.isArray(body.areas) ? body.areas.map((a) => ({ ...a })) : [],
      ...(body.logoUrl?.trim() ? { logoUrl: body.logoUrl.trim() } : {}),
    };
    writeList([row, ...list]);
    return Promise.resolve({ ...row });
  },

  update(id: string, body: Partial<Company>): Promise<Company> {
    const list = readList();
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return Promise.reject(new Error("Empresa no encontrada."));
    const next: Company = {
      ...list[i],
      ...body,
      id,
      logoUrl:
        body.logoUrl !== undefined
          ? body.logoUrl.trim() || undefined
          : list[i].logoUrl,
      areas:
        body.areas !== undefined
          ? body.areas.map((a) => ({ ...a }))
          : list[i].areas.map((a) => ({ ...a })),
    };
    list[i] = next;
    writeList(list);
    return Promise.resolve({ ...next });
  },

  delete(id: string): Promise<void> {
    writeList(readList().filter((x) => x.id !== id));
    return Promise.resolve();
  },
};
