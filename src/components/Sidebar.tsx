"use client";

import Link from "next/link";
import { useFeatures } from "@/contexts/FeaturesContext";
import { useAuth } from "@/contexts/AuthContext";
import { DASHBOARD_PATHS_OPERATIVA_Y_ANALISIS } from "@/lib/dashboardNavGating";
import { USER_ROLE } from "@/types";

const PATHS_OCULTOS_SIN_OPERATIVA = new Set<string>(DASHBOARD_PATHS_OPERATIVA_Y_ANALISIS);

type NavItem = {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Operativa",
    items: [
      { href: "/dashboard", label: "Panel", icon: "🏠" },
      { href: "/dashboard/tasks", label: "Tareas", icon: "📋" },
      { href: "/dashboard/unassigned-tasks", label: "Tareas sin asignar", icon: "📌", adminOnly: true },
      { href: "/dashboard/incidents", label: "Incidencias animales", icon: "⚠" },
    ],
  },
  {
    title: "Jornada",
    items: [
      { href: "/dashboard/time-tracking", label: "Registro de jornada", icon: "⏱" },
      { href: "/dashboard/time-tracking/vacaciones-y-festivos", label: "Vacaciones y festivos", icon: "📅" },
      { href: "/dashboard/team-hours", label: "Horas del equipo", icon: "👥", adminOnly: true },
      { href: "/dashboard/my-company", label: "Mi empresa", icon: "🏷️" },
      { href: "/dashboard/companies", label: "Empresas", icon: "🏢", adminOnly: true },
      { href: "/dashboard/services", label: "Servicios", icon: "🛠️" },
    ],
  },
  {
    title: "Datos",
    items: [
      { href: "/dashboard/animals", label: "Animales", icon: "🐄" },
      { href: "/dashboard/users", label: "Trabajadores", icon: "👤" },
      { href: "/dashboard/farms", label: "Granjas", icon: "🌾" },
    ],
  },
  {
    title: "Análisis",
    items: [{ href: "/dashboard/stats", label: "Estadísticas", icon: "📈" }],
  },
  {
    title: "Sistema",
    items: [{ href: "/dashboard/settings", label: "Ajustes", icon: "⚙" }],
  },
];

export interface SidebarProps {
  /** Ruta actual (la lee el layout para evitar `usePathname` en este chunk: menos fallos con Turbopack). */
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
  /** Cierra el cajón al pulsar un enlace (móvil). */
  onNavigate?: () => void;
  /** Panel lateral móvil: ancho completo del contenedor, botón «Cerrar». */
  mobileDrawer?: boolean;
}

/** Fondo gris, distinto del `main` (slate-50 / slate-900). */
const asideSurfaceClass =
  "border-r border-slate-400/80 bg-slate-300 shadow-[inset_-1px_0_0_0_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-950 dark:shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.25)]";

const asideClass = (collapsed: boolean, mobileDrawer?: boolean) =>
  mobileDrawer
    ? `flex h-full min-h-0 w-full flex-col overflow-hidden ${asideSurfaceClass}`
    : `flex h-full min-h-0 shrink-0 flex-col ${asideSurfaceClass} transition-[width] duration-200 ${
        collapsed ? "w-full md:w-16" : "w-full md:w-56 lg:w-64"
      }`;

export default function Sidebar({ pathname, collapsed, onToggle, onNavigate, mobileDrawer }: SidebarProps) {
  const { enableAnimals, enableTimeTracking, enableOperativaYAnalisisMenu } = useFeatures();
  const { user } = useAuth();
  const role = user?.role;
  const isAdminLike =
    role === USER_ROLE.Admin || role === USER_ROLE.SuperAdmin || role === USER_ROLE.Manager;
  const canSeeAnimals = enableAnimals && isAdminLike;

  const isNavItemVisible = (item: NavItem): boolean => {
    if (item.href === "/dashboard" && role === USER_ROLE.Worker) return false;
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
  };

  const showLabels = mobileDrawer || !collapsed;

  return (
    <aside className={asideClass(collapsed, mobileDrawer)}>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2 md:p-3">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(isNavItemVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="shrink-0">
              {showLabels && (
                <p className="mt-2 mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {section.title}
                </p>
              )}
              {visibleItems.map(({ href, label, icon }) => {
                const isActive =
                  href === "/dashboard/time-tracking"
                    ? pathname === "/dashboard/time-tracking"
                    : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={showLabels ? undefined : label}
                    onClick={() => onNavigate?.()}
                    className={`flex items-center rounded-lg px-3 py-3 text-sm font-medium transition md:py-2.5 ${
                      showLabels ? "gap-3 px-4" : "justify-center md:px-3"
                    } ${
                      isActive
                        ? "bg-agro-100 text-agro-800 dark:bg-agro-900/40 dark:text-agro-200"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                    }`}
                  >
                    <span className="text-lg shrink-0" aria-hidden>
                      {icon}
                    </span>
                    {showLabels && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onToggle}
          aria-label={mobileDrawer ? "Cerrar menú" : collapsed ? "Expandir menú" : "Colapsar menú"}
          className="mt-2 flex w-full shrink-0 items-center justify-center rounded-lg px-3 py-2.5 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 md:px-3"
        >
          {mobileDrawer ? (
            <span className="text-sm font-semibold">Cerrar menú</span>
          ) : (
            <span className="text-xl shrink-0" aria-hidden>
              {collapsed ? "»" : "«"}
            </span>
          )}
        </button>
      </nav>
    </aside>
  );
}
