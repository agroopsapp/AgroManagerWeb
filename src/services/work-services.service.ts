import { apiClient } from "@/lib/api-client";
import type { Material, WorkService } from "@/types";

const BASE = "/api/Services";
const MATERIALS_BASE = "/api/Materials";

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

function normalizeWorkService(input: unknown): WorkService {
  const o = (input ?? {}) as Record<string, unknown>;
  const rawId = o.id ?? o.Id ?? o.workServiceId ?? o.WorkServiceId;
  const rawName = o.name ?? o.Name;
  const rawDescription = o.description ?? o.Description ?? "";
  return {
    id: rawId == null ? "" : String(rawId),
    name: rawName == null ? "" : String(rawName),
    description: rawDescription == null ? "" : String(rawDescription),
  };
}

export const workServicesApi = {
  getAll(opts?: { signal?: AbortSignal; companyId?: string }): Promise<WorkService[]> {
    const query =
      opts?.companyId && opts.companyId.trim().length > 0
        ? `?companyId=${encodeURIComponent(opts.companyId)}`
        : "";
    return apiClient
      .get<unknown>(`${BASE}${query}`, { signal: opts?.signal })
      .then((raw) => unwrapList(raw).map(normalizeWorkService).filter((s) => s.id && s.name));
  },

  getById(id: string, opts?: { signal?: AbortSignal }): Promise<WorkService> {
    return apiClient
      .get<unknown>(`${BASE}/${encodeURIComponent(id)}`, { signal: opts?.signal })
      .then(normalizeWorkService);
  },

  create(body: { companyId: string; name: string }): Promise<WorkService> {
    return apiClient.post<unknown>(BASE, body).then(normalizeWorkService);
  },

  update(id: string, body: { name: string }): Promise<void> {
    return apiClient.put<void>(`${BASE}/${encodeURIComponent(id)}`, body);
  },

  delete(id: string): Promise<void> {
    return apiClient.delete<void>(`${BASE}/${encodeURIComponent(id)}`);
  },
};

// --- Materiales (catálogo del tenant) ---

function normalizeMaterial(input: unknown): Material | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const rawId = o.id ?? o.Id;
  if (rawId == null || String(rawId).trim() === "") return null;
  const companyId = o.companyId ?? o.CompanyId ?? "";
  const name = o.name ?? o.Name ?? "";
  const description = o.description ?? o.Description ?? "";
  const unit = o.unit ?? o.Unit ?? "";
  const unitOfMeasure = o.unitOfMeasure ?? o.UnitOfMeasure ?? unit ?? "";
  const code = o.code ?? o.Code ?? o.sku ?? o.Sku ?? o.reference ?? o.Reference ?? "";
  const createdAt = o.createdAt ?? o.CreatedAt ?? o.createdAtUtc ?? o.CreatedAtUtc ?? "";
  return {
    id: String(rawId),
    companyId: companyId == null ? "" : String(companyId),
    name: name == null ? "" : String(name),
    description: description == null ? "" : String(description),
    unit: unit == null ? "" : String(unit),
    unitOfMeasure:
      unitOfMeasure == null || String(unitOfMeasure).trim() === "" ? null : String(unitOfMeasure),
    code: code == null ? "" : String(code),
    createdAt: createdAt == null ? "" : String(createdAt),
  };
}

/** Alta de material — alinear con `CreateMaterialRequest` del backend (camelCase JSON). */
export type MaterialCreateBody = {
  companyId: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  code?: string | null;
};

/** Actualización de material — alinear con `UpdateMaterialRequest`. */
export type MaterialUpdateBody = {
  name: string;
  description?: string | null;
  unit?: string | null;
  code?: string | null;
};

function trimMaterialField(s: string): string | null | undefined {
  const t = s.trim();
  return t === "" ? undefined : t;
}

export function buildMaterialCreatePayload(input: {
  companyId: string;
  name: string;
  description: string;
  unit: string;
  code: string;
}): MaterialCreateBody {
  const body: MaterialCreateBody = {
    companyId: input.companyId.trim(),
    name: input.name.trim(),
  };
  const d = trimMaterialField(input.description);
  const u = trimMaterialField(input.unit);
  const c = trimMaterialField(input.code);
  if (d !== undefined) body.description = d;
  if (u !== undefined) body.unit = u;
  if (c !== undefined) body.code = c;
  return body;
}

export function buildMaterialUpdatePayload(input: {
  name: string;
  description: string;
  unit: string;
  code: string;
}): MaterialUpdateBody {
  const body: MaterialUpdateBody = {
    name: input.name.trim(),
  };
  const d = trimMaterialField(input.description);
  const u = trimMaterialField(input.unit);
  const c = trimMaterialField(input.code);
  if (d !== undefined) body.description = d;
  if (u !== undefined) body.unit = u;
  if (c !== undefined) body.code = c;
  return body;
}

export const materialsApi = {
  getAll(opts?: { signal?: AbortSignal; companyId?: string }): Promise<Material[]> {
    const q =
      opts?.companyId && opts.companyId.trim().length > 0
        ? `?companyId=${encodeURIComponent(opts.companyId.trim())}`
        : "";
    return apiClient
      .get<unknown>(`${MATERIALS_BASE}${q}`, { signal: opts?.signal })
      .then((raw) =>
        unwrapList(raw)
          .map(normalizeMaterial)
          .filter((m): m is Material => m !== null && Boolean(m.name)),
      );
  },

  getById(id: string, opts?: { signal?: AbortSignal }): Promise<Material> {
    return apiClient
      .get<unknown>(`${MATERIALS_BASE}/${encodeURIComponent(id)}`, { signal: opts?.signal })
      .then((raw) => {
        const m = normalizeMaterial(raw);
        if (m) return m;
        throw new Error("Respuesta inválida al obtener el material.");
      });
  },

  create(body: MaterialCreateBody): Promise<Material> {
    return apiClient.post<unknown>(MATERIALS_BASE, body).then((raw) => {
      const m = normalizeMaterial(raw);
      if (m) return m;
      throw new Error("Respuesta inválida al crear el material.");
    });
  },

  update(id: string, body: MaterialUpdateBody): Promise<void> {
    return apiClient.put<void>(`${MATERIALS_BASE}/${encodeURIComponent(id)}`, body);
  },

  delete(id: string): Promise<void> {
    return apiClient.delete<void>(`${MATERIALS_BASE}/${encodeURIComponent(id)}`);
  },
};
