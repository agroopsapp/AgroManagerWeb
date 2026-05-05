import { apiClient } from "@/lib/api-client";
import type { Material, MaterialCreateBody, MaterialUpdateBody } from "@/features/materials/types";

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
  return {
    id: String(rawId),
    companyId: String(rawCompany),
    name: o.name != null ? String(o.name) : o.Name != null ? String(o.Name) : "",
    unitOfMeasure: strOrNull(o.unitOfMeasure ?? o.UnitOfMeasure),
    createdAt: typeof rawCreated === "string" ? rawCreated : String(rawCreated),
  };
}

function bodyCreate(body: MaterialCreateBody): MaterialCreateBody {
  const name = body.name.trim();
  const u = body.unitOfMeasure;
  const trimmed = typeof u === "string" ? u.trim() : "";
  if (trimmed === "") {
    return { companyId: body.companyId, name };
  }
  return { companyId: body.companyId, name, unitOfMeasure: trimmed };
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
