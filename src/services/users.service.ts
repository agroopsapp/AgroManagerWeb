import { apiClient } from "@/lib/api-client";
import type { User } from "@/types";

const BASE = "/api/Users";

export const usersApi = {
  getAll() {
    return apiClient.get<User[]>(BASE);
  },

  getById(id: string) {
    return apiClient.get<User>(`${BASE}/${id}`);
  },

  create(body: Omit<User, "id">) {
    return apiClient.post<User>(BASE, body);
  },

  update(id: string, body: Partial<User>) {
    return apiClient.patch<User>(`${BASE}/${id}`, body);
  },

  delete(id: string) {
    return apiClient.delete<void>(`${BASE}/${id}`);
  },
};
