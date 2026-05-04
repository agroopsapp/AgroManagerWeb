"use client";

import Link from "next/link";
import { useFeatures } from "@/contexts/FeaturesContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  DASHBOARD_NAV_SECTIONS,
  isDashboardNavLinkVisible,
} from "@/lib/dashboardNavSections";

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

  const visibility = {
    role,
    enableAnimals,
    enableTimeTracking,
    enableOperativaYAnalisisMenu,
  };

  const showLabels = mobileDrawer || !collapsed;

  return (
    <aside className={asideClass(collapsed, mobileDrawer)}>
      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2 md:p-3">
        {DASHBOARD_NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => isDashboardNavLinkVisible(item, visibility));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="flex shrink-0 flex-col gap-1">
              {showLabels && (
                <p className="mb-0.5 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
          className="mt-auto flex w-full shrink-0 items-center justify-center rounded-lg px-3 py-2.5 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 md:px-3"
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
