import { apiClient } from "@/lib/api-client";
import type { Farm } from "@/types";

const BASE = "/api/Farms";

function normalizeFarm(input: unknown): Farm {
  const o = (input ?? {}) as Record<string, unknown>;

  const rawId =
    o.id ??
    o.Id ??
    o.farmId ??
    o.FarmId ??
    o.farmID ??
    o.FarmID;

  const rawName = o.name ?? o.Name;
  const rawLocation =
    o.location ??
    o.Location ??
    o.address ??
    o.Address;

  return {
    id: rawId == null ? "" : String(rawId),
    name: rawName == null ? "" : String(rawName),
    location: rawLocation == null ? "" : String(rawLocation),
  };
}

export const farmsApi = {
  getAll(opts?: { signal?: AbortSignal }) {
    return apiClient.get<unknown[]>(BASE, { signal: opts?.signal }).then((list) => (Array.isArray(list) ? list.map(normalizeFarm) : []));
  },

  getById(id: string) {
    return apiClient.get<unknown>(`${BASE}/${id}`).then(normalizeFarm);
  },

  create(body: Omit<Farm, "id">) {
    return apiClient.post<unknown>(BASE, body).then(normalizeFarm);
  },

  update(id: string, body: Partial<Farm>) {
    // Algunos endpoints ASP.NET validan que el id venga también en el body.
    return apiClient
      .patch<unknown>(`${BASE}/${id}`, { id, ...body })
      .then((res) => (res == null ? normalizeFarm({ id, ...body }) : normalizeFarm(res)));
  },

  delete(id: string) {
    return apiClient.delete<void>(`${BASE}/${id}`);
  },
};
