import { apiClient } from "@/lib/api-client";
import type { User } from "@/types";

const BASE = "/api/Users";

interface ApiUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  telefono?: string | null;
  roleId?: string;
  roleName?: string;
  createdAt?: string;
  companyId?: string;
  companyName?: string;
}

function mapApiUserToUser(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    phone: (apiUser.telefono ?? apiUser.phone ?? "").trim(),
    roleId: apiUser.roleId ?? "",
    roleName: apiUser.roleName,
    companyId: apiUser.companyId,
    companyName: apiUser.companyName,
  };
}

/** Body para POST /api/Users (mismo contrato que en Postman). */
export interface CreateUserPayload {
  companyId: string;
  name: string;
  email: string;
  password: string;
  roleId: string;
  telefono?: string;
}

/** Body para PUT /api/Users/{id} */
export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  roleId?: string;
  telefono?: string;
}

/** Body para PATCH /api/Users/{userId}/password */
export interface ChangePasswordPayload {
  password: string;
}

export const usersApi = {
  /** Sin `companyId`: GET /api/Users. Con `companyId`: GET /api/Users/company/{id}. */
  async getAll(companyId?: string, opts?: { signal?: AbortSignal }) {
    const path = companyId ? `${BASE}/company/${companyId}` : BASE;
    const users = await apiClient.get<ApiUser[]>(path, { signal: opts?.signal });
    if (!Array.isArray(users)) return [];
    return users.map(mapApiUserToUser);
  },

  getById(id: string) {
    return apiClient.get<ApiUser>(`${BASE}/${id}`).then(mapApiUserToUser);
  },

  create(body: CreateUserPayload) {
    return apiClient.post<ApiUser>(BASE, body).then(mapApiUserToUser);
  },

  update(id: string, body: UpdateUserPayload) {
    return apiClient.put<ApiUser>(`${BASE}/${id}`, body).then(mapApiUserToUser);
  },

  /** PATCH /api/Users/{userId}/password → [HttpPatch("{userId:guid}/password")] */
  changePassword(userId: string, body: ChangePasswordPayload) {
    const id = userId.trim();
    return apiClient.patch<void>(`${BASE}/${encodeURIComponent(id)}/password`, body);
  },

  /** DELETE /api/Users/{userId} → encaja con [HttpDelete("{userId:guid}")] */
  delete(id: string) {
    const userId = id.trim();
    return apiClient.delete<void>(`${BASE}/${encodeURIComponent(userId)}`);
  },
};
