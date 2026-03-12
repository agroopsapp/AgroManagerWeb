import { apiClient } from "@/lib/api-client";
import type { Task, TaskStatus } from "@/types";

const BASE = "/api/Tasks";

export const tasksApi = {
  getAll(params?: { date?: string; status?: TaskStatus }) {
    const search = new URLSearchParams();
    if (params?.date) search.set("date", params.date);
    if (params?.status) search.set("status", params.status);
    const qs = search.toString();
    return apiClient.get<Task[]>(qs ? `${BASE}?${qs}` : BASE);
  },

  getById(id: string) {
    return apiClient.get<Task>(`${BASE}/${id}`);
  },

  create(body: Omit<Task, "id">) {
    return apiClient.post<Task>(BASE, body);
  },

  update(id: string, body: Partial<Task>) {
    return apiClient.patch<Task>(`${BASE}/${id}`, body);
  },

  updateStatus(id: string, status: TaskStatus) {
    return apiClient.patch<Task>(`${BASE}/${id}/status`, { status });
  },

  updateComments(id: string, comments: string[]) {
    return apiClient.patch<Task>(`${BASE}/${id}/comments`, { comments });
  },

  updateDate(id: string, date: string) {
    return apiClient.patch<Task>(`${BASE}/${id}/date`, { date });
  },

  delete(id: string) {
    return apiClient.delete<void>(`${BASE}/${id}`);
  },
};
