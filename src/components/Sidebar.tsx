"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFeatures } from "@/contexts/FeaturesContext";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE } from "@/types";

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
      { href: "/dashboard/time-tracking", label: "Registro de jornada", icon: "⏱" },
      { href: "/dashboard/unassigned-tasks", label: "Tareas sin asignar", icon: "📌", adminOnly: true },
      { href: "/dashboard/incidents", label: "Incidencias animales", icon: "⚠" },
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

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { enableAnimals, enableTimeTracking } = useFeatures();
  const { user } = useAuth();
  const role = user?.role;
  const canSeeAnimals =
    enableAnimals && (role === USER_ROLE.Admin || role === USER_ROLE.SuperAdmin);

  return (
    <aside
      className={`shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-700 dark:bg-slate-800 ${
        collapsed ? "w-full md:w-16" : "w-full md:w-56 lg:w-64"
      }`}
    >
      <nav className="flex flex-col gap-1 p-2 md:p-3">
        {navSections.map((section) => (
          <div key={section.title} className="flex-1 md:flex-none">
            {!collapsed && (
              <p className="mt-2 mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {section.title}
              </p>
            )}
            {section.items.map(({ href, label, icon, adminOnly }) => {
              // Solo Admin/SuperAdmin ven "Tareas sin asignar"
              if (adminOnly && role !== USER_ROLE.Admin && role !== USER_ROLE.SuperAdmin) {
                return null;
              }
              if (!enableTimeTracking && href === "/dashboard/time-tracking") {
                return null;
              }
              // Ocultar rutas de animales cuando la funcionalidad está desactivada
              // o el usuario no es Admin / SuperAdmin
              if (
                !canSeeAnimals &&
                (href === "/dashboard/incidents" || href === "/dashboard/animals")
              ) {
                return null;
              }
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={`flex items-center rounded-lg px-3 py-3 text-sm font-medium transition md:py-2.5 ${
                    collapsed ? "justify-center md:px-3" : "gap-3 px-4"
                  } ${
                    isActive
                      ? "bg-agro-100 text-agro-800 dark:bg-agro-900/40 dark:text-agro-200"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  }`}
                >
                  <span className="text-lg shrink-0" aria-hidden>
                    {icon}
                  </span>
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="mt-2 flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 md:px-3"
        >
          <span className="text-xl shrink-0" aria-hidden>{collapsed ? "»" : "«"}</span>
        </button>
      </nav>
    </aside>
  );
}
