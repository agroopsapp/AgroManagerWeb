"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { TasksProvider } from "@/contexts/TasksContext";
import { USER_ROLE } from "@/types";
import Header from "./Header";
import Sidebar from "./Sidebar";

const SIDEBAR_STORAGE_KEY = "agroops_sidebar_collapsed";

const QUICK_MENU_ITEMS = [
  // Fila 1
  { href: "/dashboard", label: "Panel", icon: "🏠" },
  { href: "/dashboard/tasks", label: "Tareas", icon: "📋" },
  { href: "/dashboard/time-tracking", label: "Registro de jornada", icon: "⏱" },
  { href: "/dashboard/unassigned-tasks", label: "Tareas sin asignar", icon: "📌", adminOnly: true },
  { href: "/dashboard/incidents", label: "Incidencias animales", icon: "⚠" },
  // Fila 2
  { href: "/dashboard/animals", label: "Animales", icon: "🐄" },
  { href: "/dashboard/users", label: "Trabajadores", icon: "👤" },
  { href: "/dashboard/farms", label: "Granjas", icon: "🌾" },
  // Fila 3
  { href: "/dashboard/stats", label: "Estadísticas", icon: "📈" },
  { href: "/dashboard/settings", label: "Ajustes", icon: "⚙" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isReady } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace("/login");
  }, [user, isReady, router]);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "true") setSidebarCollapsed(true);
  }, []);

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

  if (!user) return null;

  return (
    <TasksProvider>
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-900">
      <Header
        onToggleMobileSidebar={() => setMobileSidebarOpen((v) => !v)}
        onToggleQuickMenu={() => setQuickMenuOpen((v) => !v)}
      />
      <div className="flex flex-1">
        {/* Menú rápido: grid 3x3 */}
        {quickMenuOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setQuickMenuOpen(false)}
          >
            <div
              className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900 dark:border dark:border-slate-700"
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
                  if (adminOnly && user?.role !== USER_ROLE.Admin && user?.role !== USER_ROLE.SuperAdmin) {
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

        {/* Layout escritorio */}
        <div className="hidden w-full md:flex md:flex-row">
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
          <main className="flex-1 overflow-auto bg-slate-50 p-6 dark:bg-slate-900">{children}</main>
        </div>

        {/* Contenido móvil (sin sidebar fijo) */}
        <main className="flex-1 overflow-auto bg-slate-50 p-4 dark:bg-slate-900 md:hidden">{children}</main>
      </div>
    </div>
    </TasksProvider>
  );
}
