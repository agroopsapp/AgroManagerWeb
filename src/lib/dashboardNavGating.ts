import { USER_ROLE, type UserRole } from "@/types";

/**
 * Rutas que se ocultan del menú y del menú rápido cuando `enableOperativaYAnalisisMenu` es false.
 * Incluye el Panel (`/dashboard`) y el resto de operativa / datos / análisis afectados.
 */
export const DASHBOARD_PATHS_OPERATIVA_Y_ANALISIS = [
  "/dashboard",
  "/dashboard/tasks",
  "/dashboard/unassigned-tasks",
  "/dashboard/incidents",
  "/dashboard/animals",
  "/dashboard/farms",
  "/dashboard/stats",
] as const;

export type DashboardPathOperativaYAnalisis = (typeof DASHBOARD_PATHS_OPERATIVA_Y_ANALISIS)[number];

export function isDashboardPathOperativaYAnalisis(pathname: string | null): pathname is DashboardPathOperativaYAnalisis {
  if (!pathname) return false;
  return (DASHBOARD_PATHS_OPERATIVA_Y_ANALISIS as readonly string[]).includes(pathname);
}

/** Inicio coherente con menú: si el Panel está oculto, admin/manager van a jornada o Mi empresa. */
export function appHomePath(
  role: UserRole | undefined,
  enableTimeTracking: boolean,
  enableOperativaYAnalisisMenu: boolean,
): string {
  if (role === USER_ROLE.Worker) {
    return workerHomePath(enableTimeTracking, enableOperativaYAnalisisMenu);
  }
  if (enableOperativaYAnalisisMenu) {
    return "/dashboard";
  }
  if (enableTimeTracking) {
    return "/dashboard/time-tracking";
  }
  return "/dashboard/my-company";
}

/**
 * Pantalla inicial del rol Worker si «Tareas» no está en el menú.
 * Evita devolver `/dashboard`: esa ruta redirige al trabajador y generaría un bucle.
 */
export function workerHomePath(
  enableTimeTracking: boolean,
  enableOperativaYAnalisisMenu: boolean,
): string {
  if (enableOperativaYAnalisisMenu) return "/dashboard/tasks";
  if (enableTimeTracking) return "/dashboard/time-tracking";
  return "/dashboard/my-company";
}
