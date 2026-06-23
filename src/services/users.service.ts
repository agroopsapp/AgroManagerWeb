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
  CompanyId?: string;
  companyName?: string;
  CompanyName?: string;
  excludedFromTimeTracking?: boolean | null;
  ExcludedFromTimeTracking?: boolean | null;
}

function parseExcludedFromTimeTracking(raw: ApiUser): boolean {
  const v = raw.excludedFromTimeTracking ?? raw.ExcludedFromTimeTracking;
  if (v === true) return true;
  if (v === false) return false;
  return false;
}

function mapApiUserToUser(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    phone: (apiUser.telefono ?? apiUser.phone ?? "").trim(),
    roleId: apiUser.roleId ?? "",
    roleName: apiUser.roleName,
    companyId:
      apiUser.companyId != null
        ? String(apiUser.companyId)
        : apiUser.CompanyId != null
          ? String(apiUser.CompanyId)
          : undefined,
    companyName:
      (apiUser.companyName ?? apiUser.CompanyName)?.toString().trim() || undefined,
    excludedFromTimeTracking: parseExcludedFromTimeTracking(apiUser),
  };
}

/** Body de alta de usuario. */
export interface CreateUserPayload {
  companyId: string;
  name: string;
  email: string;
  password: string;
  roleId: string;
  telefono?: string;
  /** Si se omite, el backend equivale a `false`. */
  excludedFromTimeTracking?: boolean;
}

/**
 * Body de actualización de usuario (UpdateUserRequest).
 * El backend espera `companyId`, `name`, `email`, `roleId`, `telefono` y `excludedFromTimeTracking`.
 */
export interface UpdateUserPayload {
  companyId: string;
  name: string;
  email: string;
  roleId: string;
  telefono?: string;
  password?: string;
  excludedFromTimeTracking: boolean;
}

/** Cuerpo JSON alineado con el contrato (siempre `telefono` y flag explícitos). */
function toUpdateUserWire(body: UpdateUserPayload): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    companyId: body.companyId.trim(),
    name: body.name,
    email: body.email,
    roleId: body.roleId,
    telefono: (body.telefono ?? "").trim(),
    excludedFromTimeTracking: body.excludedFromTimeTracking === true,
  };
  const pw = body.password?.trim();
  if (pw) wire.password = pw;
  return wire;
}

/** Body de cambio de contraseña. */
export interface ChangePasswordPayload {
  password: string;
}

export const usersApi = {
  /**
   * Listado de usuarios (ámbito según token / políticas del backend).
   * Filtro opcional (backend): `?excludedFromTimeTracking=true` (solo los excluidos).
   */
  async getAll(opts?: { signal?: AbortSignal; excludedFromTimeTracking?: boolean }) {
    const qs = opts?.excludedFromTimeTracking ? "?excludedFromTimeTracking=true" : "";
    const users = await apiClient.get<ApiUser[]>(`${BASE}${qs}`, { signal: opts?.signal });
    if (!Array.isArray(users)) return [];
    return users.map(mapApiUserToUser);
  },

  getById(id: string, opts?: { signal?: AbortSignal }) {
    const userId = id.trim();
    return apiClient.get<ApiUser>(`${BASE}/${encodeURIComponent(userId)}`, { signal: opts?.signal }).then(mapApiUserToUser);
  },

  create(body: CreateUserPayload) {
    return apiClient.post<ApiUser>(BASE, body).then(mapApiUserToUser);
  },

  /**
   * Actualización de usuario. Si el servidor responde 204 o sin JSON, se vuelve a pedir el usuario.
   */
  update(id: string, body: UpdateUserPayload, opts?: { signal?: AbortSignal }) {
    const userId = id.trim();
    const wire = toUpdateUserWire(body);
    return apiClient
      .put<ApiUser | undefined>(`${BASE}/${encodeURIComponent(userId)}`, wire, { signal: opts?.signal })
      .then(async (raw) => {
        if (raw != null && typeof raw === "object") {
          const rid = (raw as { id?: unknown; Id?: unknown }).id ?? (raw as { Id?: unknown }).Id;
          if (rid != null && String(rid).trim() !== "") {
            return mapApiUserToUser(raw as ApiUser);
          }
        }
        return usersApi.getById(userId, { signal: opts?.signal });
      });
  },

  /** Cambio de contraseña del usuario. */
  changePassword(userId: string, body: ChangePasswordPayload) {
    const id = userId.trim();
    return apiClient.patch<void>(`${BASE}/${encodeURIComponent(id)}/password`, body);
  },

  /** Baja de usuario. */
  delete(id: string) {
    const userId = id.trim();
    return apiClient.delete<void>(`${BASE}/${encodeURIComponent(userId)}`);
  },
};
