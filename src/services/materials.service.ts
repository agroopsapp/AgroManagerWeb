import { apiClient } from "@/lib/api-client";
import type { Material, MaterialCreateBody, MaterialUpdateBody } from "@/features/materials/types";

export type { MaterialCreateBody, MaterialUpdateBody };

const BASE = "/api/Materials";

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

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function normalizeMaterial(input: unknown): Material | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const rawId = o.id ?? o.Id;
  if (rawId == null || String(rawId).trim() === "") return null;
  const rawCompany = o.companyId ?? o.CompanyId ?? "";
  const rawCreated = o.createdAt ?? o.CreatedAt ?? "";
  const rawUnitOfMeasure = o.unitOfMeasure ?? o.UnitOfMeasure ?? o.unit ?? o.Unit ?? null;
  return {
    id: String(rawId),
    companyId: String(rawCompany),
    name: o.name != null ? String(o.name) : o.Name != null ? String(o.Name) : "",
    unitOfMeasure: strOrNull(rawUnitOfMeasure),
    description: (o.description ?? o.Description ?? "") == null
      ? ""
      : String(o.description ?? o.Description ?? ""),
    unit: (o.unit ?? o.Unit ?? "") == null ? "" : String(o.unit ?? o.Unit ?? ""),
    code: (o.code ?? o.Code ?? o.sku ?? o.Sku ?? o.reference ?? o.Reference ?? "") == null
      ? ""
      : String(o.code ?? o.Code ?? o.sku ?? o.Sku ?? o.reference ?? o.Reference ?? ""),
    createdAt: typeof rawCreated === "string" ? rawCreated : String(rawCreated),
  };
}

function bodyCreate(body: MaterialCreateBody): MaterialCreateBody {
  const name = body.name.trim();
  const u = body.unitOfMeasure;
  const trimmed = typeof u === "string" ? u.trim() : "";
  const base: MaterialCreateBody = { companyId: body.companyId.trim(), name };
  if (trimmed !== "") base.unitOfMeasure = trimmed;
  return base;
}

function bodyUpdate(body: MaterialUpdateBody): MaterialUpdateBody {
  const name = body.name.trim();
  const u = body.unitOfMeasure;
  if (u === undefined) {
    return { name };
  }
  const trimmed = typeof u === "string" ? u.trim() : "";
  if (trimmed === "") {
    return { name, unitOfMeasure: null };
  }
  return { name, unitOfMeasure: trimmed };
}

/**
 * Builder del payload para crear materiales desde la UI.
 * Nota: el contrato tipado actual de `/api/Materials` en este proyecto usa `unitOfMeasure`.
 */
export function buildMaterialCreatePayload(input: {
  companyId: string;
  name: string;
  description: string;
  unit: string;
  code: string;
}): MaterialCreateBody {
  return {
    companyId: input.companyId.trim(),
    name: input.name.trim(),
    ...(input.unit.trim().length > 0 ? { unitOfMeasure: input.unit.trim() } : {}),
  };
}

/**
 * Builder del payload para actualizar materiales desde la UI.
 */
export function buildMaterialUpdatePayload(input: {
  name: string;
  description: string;
  unit: string;
  code: string;
}): MaterialUpdateBody {
  return {
    name: input.name.trim(),
    // Si viene vacío, se envía `null` para limpiar el campo en backend (coherente con `bodyUpdate`).
    unitOfMeasure: input.unit.trim().length === 0 ? null : input.unit.trim(),
  };
}

export const materialsApi = {
  getAll(opts?: { signal?: AbortSignal; companyId?: string }): Promise<Material[]> {
    const q =
      opts?.companyId && opts.companyId.trim().length > 0
        ? `?companyId=${encodeURIComponent(opts.companyId)}`
        : "";
    return apiClient
      .get<unknown>(`${BASE}${q}`, { signal: opts?.signal })
      .then((raw) =>
        unwrapList(raw)
          .map(normalizeMaterial)
          .filter((m): m is Material => m !== null),
      );
  },

  getById(id: string, opts?: { signal?: AbortSignal }): Promise<Material> {
    return apiClient
      .get<unknown>(`${BASE}/${encodeURIComponent(id)}`, { signal: opts?.signal })
      .then((raw) => {
        const m = normalizeMaterial(raw);
        if (!m) throw new Error("Respuesta de material inválida.");
        return m;
      });
  },

  create(body: MaterialCreateBody, opts?: { signal?: AbortSignal }): Promise<Material> {
    return apiClient
      .post<unknown>(BASE, bodyCreate(body), { signal: opts?.signal })
      .then((raw) => {
        const m = normalizeMaterial(raw);
        if (!m) throw new Error("Respuesta de creación inválida.");
        return m;
      });
  },

  update(id: string, body: MaterialUpdateBody, opts?: { signal?: AbortSignal }): Promise<Material | void> {
    return apiClient
      .put<unknown>(`${BASE}/${encodeURIComponent(id)}`, bodyUpdate(body), { signal: opts?.signal })
      .then((raw) => {
        if (raw == null || (typeof raw === "object" && Object.keys(raw as object).length === 0)) {
          return undefined;
        }
        return normalizeMaterial(raw) ?? undefined;
      });
  },

  delete(id: string, opts?: { signal?: AbortSignal }): Promise<void> {
    return apiClient.delete<void>(`${BASE}/${encodeURIComponent(id)}`, { signal: opts?.signal });
  },
};
