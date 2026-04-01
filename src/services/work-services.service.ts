import { apiClient } from "@/lib/api-client";
import type { WorkService } from "@/types";

const BASE = "/api/Services";

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
