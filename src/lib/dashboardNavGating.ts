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

/**
 * Ruta de inicio tras login / logo «panel».
 * Con fichaje activo, **todos** los roles entran en Registro de jornada (`/dashboard/time-tracking`).
 */
export function appHomePath(
  role: UserRole | undefined,
  enableTimeTracking: boolean,
  enableOperativaYAnalisisMenu: boolean,
): string {
  if (enableTimeTracking) {
    return "/dashboard/time-tracking";
  }
  if (role === USER_ROLE.Worker) {
    return workerHomePath(enableTimeTracking, enableOperativaYAnalisisMenu);
  }
  if (enableOperativaYAnalisisMenu) {
    return "/dashboard";
  }
  return "/dashboard/my-company";
}

/**
 * Destino del trabajador cuando no debe ver `/dashboard` (evita bucle con la redirección del panel).
 * Sin fichaje: tareas si hay menú operativo; si no, Mi empresa.
 */
export function workerHomePath(
  enableTimeTracking: boolean,
  enableOperativaYAnalisisMenu: boolean,
): string {
  if (enableTimeTracking) {
    return "/dashboard/time-tracking";
  }
  if (enableOperativaYAnalisisMenu) return "/dashboard/tasks";
  return "/dashboard/my-company";
}
