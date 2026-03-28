import { apiClient } from "@/lib/api-client";
import type { Role } from "@/types";

const BASE = "/api/Roles";

type ApiRoleRow = Role & { Id?: string; Name?: string };

function mapRole(row: ApiRoleRow): Role {
  return {
    id: row.id ?? row.Id ?? "",
    name: row.name ?? row.Name ?? "",
  };
}

export const rolesApi = {
  async getAll(opts?: { signal?: AbortSignal }): Promise<Role[]> {
    const raw = await apiClient.get<ApiRoleRow[]>(BASE, { signal: opts?.signal });
    if (!Array.isArray(raw)) return [];
    return raw.map(mapRole).filter((r) => r.id);
  },
};
