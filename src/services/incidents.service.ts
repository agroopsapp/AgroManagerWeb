import { apiClient } from "@/lib/api-client";
import type { AnimalCase, IncidentStatus } from "@/types";

const BASE = "/api/Incidents";

export const incidentsApi = {
  getAll(params?: { animalId?: string; status?: IncidentStatus }) {
    const search = new URLSearchParams();
    if (params?.animalId) search.set("animalId", params.animalId);
    if (params?.status) search.set("status", params.status);
    const qs = search.toString();
    return apiClient.get<AnimalCase[]>(qs ? `${BASE}?${qs}` : BASE);
  },

  getById(id: string) {
    return apiClient.get<AnimalCase>(`${BASE}/${id}`);
  },

  create(body: Omit<AnimalCase, "id">) {
    return apiClient.post<AnimalCase>(BASE, body);
  },

  update(id: string, body: Partial<AnimalCase>) {
    return apiClient.patch<AnimalCase>(`${BASE}/${id}`, body);
  },

  updateStatus(id: string, status: IncidentStatus) {
    return apiClient.patch<AnimalCase>(`${BASE}/${id}/status`, { status });
  },

  delete(id: string) {
    return apiClient.delete<void>(`${BASE}/${id}`);
  },
};
