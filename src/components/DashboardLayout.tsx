"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatures } from "@/contexts/FeaturesContext";
import { TasksProvider } from "@/contexts/TasksContext";
import { USER_ROLE } from "@/types";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { MODAL_BACKDROP_CENTER, MODAL_SURFACE, MODAL_SURFACE_PAD } from "@/components/modalShell";
import { appHomePath, isDashboardPathOperativaYAnalisis } from "@/lib/dashboardNavGating";

const SIDEBAR_STORAGE_KEY = "agroops_sidebar_collapsed";

const QUICK_MENU_ITEMS = [
  // Fila 1
  { href: "/dashboard", label: "Panel", icon: "🏠" },
  { href: "/dashboard/tasks", label: "Tareas", icon: "📋" },
  { href: "/dashboard/unassigned-tasks", label: "Tareas sin asignar", icon: "📌", adminOnly: true },
  { href: "/dashboard/incidents", label: "Incidencias animales", icon: "⚠" },
  { href: "/dashboard/time-tracking", label: "Registro de jornada", icon: "⏱" },
  { href: "/dashboard/time-tracking/vacaciones-y-festivos", label: "Vacaciones y festivos", icon: "📅" },
  { href: "/dashboard/team-hours", label: "Horas del equipo", icon: "👥", adminOnly: true },
  { href: "/dashboard/companies", label: "Empresas", icon: "🏢", adminOnly: true },
  { href: "/dashboard/services", label: "Servicios", icon: "🛠️" },
  // Fila 2 (después de operativa)
  { href: "/dashboard/animals", label: "Animales", icon: "🐄" },
  { href: "/dashboard/users", label: "Trabajadores", icon: "👤" },
  { href: "/dashboard/farms", label: "Granjas", icon: "🌾" },
  // Fila 3
  { href: "/dashboard/stats", label: "Estadísticas", icon: "📈" },
  { href: "/dashboard/settings", label: "Ajustes", icon: "⚙" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isReady } = useAuth();
  const { enableAnimals, enableTimeTracking, enableOperativaYAnalisisMenu } = useFeatures();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace("/login");
  }, [user, isReady, router]);

  useEffect(() => {
    if (!isReady || !user) return;
    if (!enableOperativaYAnalisisMenu && pathname && isDashboardPathOperativaYAnalisis(pathname)) {
      const dest = appHomePath(user.role, enableTimeTracking, enableOperativaYAnalisisMenu);
      if (pathname !== dest) router.replace(dest);
    }
  }, [isReady, user, pathname, enableOperativaYAnalisisMenu, enableTimeTracking, router]);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "true") setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (mobileSidebarOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileSidebarOpen]);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-agro-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center dark:bg-slate-900">
        <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
          No hay sesión activa o ha caducado. Vuelve a iniciar sesión para entrar al panel.
        </p>
        <Link
          href="/login"
          className="rounded-xl bg-agro-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-agro-700"
        >
          Ir al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <TasksProvider>
    {/* `h-[100dvh]` + `overflow-hidden`: el scroll queda en `<main>`; si el shell crece con
        `min-h-screen` solamente, a veces hace scroll el documento y el `sticky` de las páginas
        (p. ej. filtros en team-hours) deja de “pegar” bien. */}
    <div className="flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      <Header
        onToggleMobileSidebar={() => setMobileSidebarOpen((v) => !v)}
        onToggleQuickMenu={() => setQuickMenuOpen((v) => !v)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* Menú rápido: grid 3x3 */}
        {quickMenuOpen && (
          <div
            className={`fixed inset-0 z-50 ${MODAL_BACKDROP_CENTER}`}
            onClick={() => setQuickMenuOpen(false)}
          >
            <div
              className={`w-full max-w-xs ${MODAL_SURFACE} ${MODAL_SURFACE_PAD}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Menú rápido
                </p>
                <button
                  type="button"
                  aria-label="Cerrar menú rápido"
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  onClick={() => setQuickMenuOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {QUICK_MENU_ITEMS.map(({ href, label, icon, adminOnly }) => {
                  const isAdminLike =
                    user?.role === USER_ROLE.Admin ||
                    user?.role === USER_ROLE.SuperAdmin ||
                    user?.role === USER_ROLE.Manager;

                  if (href === "/dashboard" && user?.role === USER_ROLE.Worker) {
                    return null;
                  }

                  if (adminOnly && !isAdminLike) {
                    return null;
                  }
                  if (!enableTimeTracking && href === "/dashboard/time-tracking") {
                    return null;
                  }
                  if (!enableTimeTracking && href.startsWith("/dashboard/time-tracking/")) {
                    return null;
                  }
                  if (!enableTimeTracking && href === "/dashboard/team-hours") {
                    return null;
                  }
                  if (!enableOperativaYAnalisisMenu && isDashboardPathOperativaYAnalisis(href)) {
                    return null;
                  }
                  if (
                    !enableAnimals &&
                    (href === "/dashboard/incidents" || href === "/dashboard/animals")
                  ) {
                    return null;
                  }
                  return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setQuickMenuOpen(false)}
                    className="flex min-h-[80px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <span className="text-2xl" aria-hidden>
                      {icon}
                    </span>
                    <span className="mt-1 max-w-[90px] text-[11px] leading-tight text-center">
                      {label}
                    </span>
                  </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {mobileSidebarOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              aria-label="Cerrar menú de navegación"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-[min(20rem,88vw)] shadow-2xl md:hidden">
              <Sidebar
                pathname={pathname}
                collapsed={false}
                mobileDrawer
                onToggle={() => setMobileSidebarOpen(false)}
                onNavigate={() => setMobileSidebarOpen(false)}
              />
            </div>
          </>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
          {/* Misma altura que main: flex-1 bajo el header + stretch en fila. Si cambias h-14 en Header, el bloque sigue llenando el viewport. */}
          <div className="hidden min-h-0 shrink-0 self-stretch md:flex md:flex-col">
            <Sidebar pathname={pathname} collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
          </div>
          <main className="min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto bg-slate-50 px-3 py-4 md:min-h-0 md:p-6 dark:bg-slate-900">
            {children}
          </main>
        </div>
      </div>
    </div>
    </TasksProvider>
  );
}
