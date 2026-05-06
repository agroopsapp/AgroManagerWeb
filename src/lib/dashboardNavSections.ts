import {
  DASHBOARD_PATHS_OPERATIVA_Y_ANALISIS,
  isDashboardPathAccessibleInFichadorShell,
} from "@/lib/dashboardNavGating";
import { USER_ROLE, type UserRole } from "@/types";
import type { ReactNode } from "react";
import {
  IconAlert,
  IconAnimal,
  IconBriefcase,
  IconBuildings,
  IconChart,
  IconClipboard,
  IconFarm,
  IconHome,
  IconPackage,
  IconPin,
  IconSettings,
  IconUser,
} from "@/components/icons/SidebarIcons";

const PATHS_OCULTOS_SIN_OPERATIVA = new Set<string>(DASHBOARD_PATHS_OPERATIVA_Y_ANALISIS);

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
  /** Solo rol `SuperAdmin` (API `/api/superadmin/*`). */
  superAdminOnly?: boolean;
};

export type DashboardNavSection = {
  title: string;
  items: DashboardNavItem[];
};

/**
 * Orden del menú lateral y menú rápido.
 * **Hoy:** fichaje del día y obra en curso. **Gestión:** calendario laboral (vacaciones/festivos), empresa, materiales, catálogos y personal (según rol).
 */
export const DASHBOARD_NAV_SECTIONS: DashboardNavSection[] = [
  {
    title: "Operativa",
    items: [
      { href: "/dashboard", label: "Panel", icon: IconHome() },
      { href: "/dashboard/tasks", label: "Tareas", icon: IconClipboard() },
      { href: "/dashboard/unassigned-tasks", label: "Tareas sin asignar", icon: IconPin(), adminOnly: true },
      { href: "/dashboard/incidents", label: "Incidencias animales", icon: IconAlert() },
    ],
  },
  {
    title: "Hoy",
    items: [
      { href: "/dashboard/time-tracking", label: "Registro de jornada", icon: IconChart() },
      { href: "/dashboard/time-tracking/partes-de-obra", label: "Partes de obra", icon: IconClipboard() },
      { href: "/dashboard/team-hours", label: "Fichajes y partes", icon: IconUser() },
    ],
  },
  {
    title: "Gestión",
    items: [
      { href: "/dashboard/time-tracking/vacaciones-y-festivos", label: "Vacaciones y festivos", icon: IconChart() },
      { href: "/dashboard/my-company", label: "Mi empresa", icon: IconBriefcase() },
      { href: "/dashboard/companies", label: "Empresas", icon: IconBuildings() },
      { href: "/dashboard/materiales", label: "Materiales", icon: IconPackage() },
      { href: "/dashboard/services", label: "Servicios", icon: IconPin() },
      { href: "/dashboard/users", label: "Trabajadores", icon: IconUser() },
    ],
  },
  {
    title: "Datos",
    items: [
      { href: "/dashboard/animals", label: "Animales", icon: IconAnimal() },
      { href: "/dashboard/farms", label: "Granjas", icon: IconFarm() },
    ],
  },
  {
    title: "Análisis",
    items: [{ href: "/dashboard/stats", label: "Estadísticas", icon: IconChart() }],
  },
  {
    title: "Sistema",
    items: [
      { href: "/dashboard/superadmin", label: "Superadmin", icon: IconAlert(), superAdminOnly: true },
      { href: "/dashboard/settings", label: "Ajustes", icon: IconSettings(), superAdminOnly: true },
    ],
  },
];

export type DashboardNavVisibilityInput = {
  role: UserRole | undefined;
  enableAnimals: boolean;
  enableTimeTracking: boolean;
  enableOperativaYAnalisisMenu: boolean;
};

/** Misma regla para sidebar y menú rápido (`DashboardLayout`). */
export function isDashboardNavLinkVisible(
  item: DashboardNavItem,
  input: DashboardNavVisibilityInput,
): boolean {
  const { role, enableAnimals, enableTimeTracking, enableOperativaYAnalisisMenu } = input;
  const isSuperAdmin = role === USER_ROLE.SuperAdmin;
  const isAdminLike =
    role === USER_ROLE.Admin || role === USER_ROLE.SuperAdmin || role === USER_ROLE.Manager;
  const canSeeAnimals = enableAnimals && isAdminLike;

  if (item.href === "/dashboard" && role === USER_ROLE.Worker) return false;
  if (!isSuperAdmin && !isDashboardPathAccessibleInFichadorShell(role, item.href)) return false;
  if (item.superAdminOnly && role !== USER_ROLE.SuperAdmin) return false;
  if (item.adminOnly && !isAdminLike) return false;
  if (!enableTimeTracking && item.href === "/dashboard/time-tracking") return false;
  if (!enableTimeTracking && item.href.startsWith("/dashboard/time-tracking/")) return false;
  if (!enableTimeTracking && item.href === "/dashboard/team-hours") return false;
  if (!enableOperativaYAnalisisMenu && PATHS_OCULTOS_SIN_OPERATIVA.has(item.href)) return false;
  if (
    !canSeeAnimals &&
    (item.href === "/dashboard/incidents" || item.href === "/dashboard/animals")
  ) {
    return false;
  }
  return true;
}
