import { apiClient } from "@/lib/api-client";
import type { Animal } from "@/types";

const BASE = "/api/Animals";

export const animalsApi = {
  getAll(params?: { farmId?: string }) {
    const search = new URLSearchParams();
    if (params?.farmId) search.set("farmId", params.farmId);
    const qs = search.toString();
    return apiClient.get<Animal[]>(qs ? `${BASE}?${qs}` : BASE);
  },

  getById(id: string) {
    return apiClient.get<Animal>(`${BASE}/${id}`);
  },

  create(body: Omit<Animal, "id">) {
    return apiClient.post<Animal>(BASE, body);
  },

  update(id: string, body: Partial<Animal>) {
    return apiClient.patch<Animal>(`${BASE}/${id}`, body);
  },

  delete(id: string) {
    return apiClient.delete<void>(`${BASE}/${id}`);
  },
};
