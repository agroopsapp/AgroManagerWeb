import { apiClient } from "@/lib/api-client";
import type { Farm } from "@/types";

const BASE = "/api/Farms";

export const farmsApi = {
  getAll() {
    return apiClient.get<Farm[]>(BASE);
  },

  getById(id: string) {
    return apiClient.get<Farm>(`${BASE}/${id}`);
  },

  create(body: Omit<Farm, "id">) {
    return apiClient.post<Farm>(BASE, body);
  },

  update(id: string, body: Partial<Farm>) {
    return apiClient.patch<Farm>(`${BASE}/${id}`, body);
  },

  delete(id: string) {
    return apiClient.delete<void>(`${BASE}/${id}`);
  },
};
