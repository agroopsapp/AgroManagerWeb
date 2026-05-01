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
 * Rutas permitidas en el "modo fichador" (cuando el menú debe quedarse solo con Jornada).
 * Nota: algunas pantallas del fichador cuelgan como subrutas de `/dashboard/time-tracking/*`.
 */
export const DASHBOARD_ALLOWED_PATHS_FICHADOR = [
  "/dashboard/time-tracking",
  "/dashboard/time-tracking/vacaciones-y-festivos",
  "/dashboard/time-tracking/partes-de-obra",
  "/dashboard/team-hours",
] as const;

export type DashboardAllowedPathFichador = (typeof DASHBOARD_ALLOWED_PATHS_FICHADOR)[number];

export function isDashboardAllowedPathFichador(pathname: string | null): pathname is DashboardAllowedPathFichador {
  if (!pathname) return false;
  return (DASHBOARD_ALLOWED_PATHS_FICHADOR as readonly string[]).includes(pathname);
}

export function isDashboardAllowedPathFichadorOrChild(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/dashboard/team-hours") return true;
  if (pathname === "/dashboard/time-tracking") return true;
  return pathname.startsWith("/dashboard/time-tracking/");
}

/** Rutas de administración típicas del ámbito fichador (no operativa/tareas). */
const FICHADOR_ADMIN_LIKE_PATH_PREFIXES = [
  "/dashboard/my-company",
  "/dashboard/companies",
  "/dashboard/services",
  "/dashboard/users",
] as const;

function matchesFichadorAdminLikePath(pathname: string): boolean {
  return FICHADOR_ADMIN_LIKE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Rutas permitidas cuando el dashboard está acotado al fichador:
 * - Worker: solo jornada (`time-tracking` + hijos) y horas del equipo.
 * - Admin / Manager: lo anterior más Mi empresa, empresas, servicios y trabajadores.
 * - SuperAdmin: no usar esta función para bloquear (el layout no redirige a SA).
 */
export function isDashboardPathAccessibleInFichadorShell(
  role: UserRole | undefined,
  pathname: string | null,
): boolean {
  if (!pathname) return false;
  if (isDashboardAllowedPathFichadorOrChild(pathname)) return true;
  if (role === USER_ROLE.Admin || role === USER_ROLE.Manager) {
    return matchesFichadorAdminLikePath(pathname);
  }
  return false;
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
