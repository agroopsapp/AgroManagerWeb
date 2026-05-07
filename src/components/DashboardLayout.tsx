"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { FlashSuccessProvider } from "@/contexts/FlashSuccessContext";
import { useFeatures } from "@/contexts/FeaturesContext";
import { TasksProvider } from "@/contexts/TasksContext";
import { USER_ROLE } from "@/types";
import Sidebar from "./Sidebar";
import { MODAL_BACKDROP_CENTER } from "@/components/modalShell";
import {
  appHomePath,
  isDashboardPathAccessibleInFichadorShell,
  isDashboardPathOperativaYAnalisis,
} from "@/lib/dashboardNavGating";
import { IconChart, IconClipboard, IconUser } from "@/components/icons/SidebarIcons";

const SIDEBAR_STORAGE_KEY = "agroops_sidebar_collapsed";

export default function DashboardLayout({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  const { user, isReady } = useAuth();
  const { enableAnimals, enableTimeTracking, enableOperativaYAnalisisMenu } = useFeatures();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace("/login");
  }, [user, isReady, router]);

  useEffect(() => {
    if (!isReady || !user) return;
    // Cierre del dashboard: si NO es SuperAdmin, solo fichador (+ gestión típica para Admin/Manager).
    if (
      user.role !== USER_ROLE.SuperAdmin &&
      !isDashboardPathAccessibleInFichadorShell(user.role, pathname)
    ) {
      const dest = appHomePath(user.role, enableTimeTracking, enableOperativaYAnalisisMenu);
      if (pathname !== dest) router.replace(dest);
    }
  }, [isReady, user, pathname, enableTimeTracking, enableOperativaYAnalisisMenu, router]);

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

  const quickNavItems = [
    { href: "/dashboard/time-tracking", label: "Registro", icon: IconChart() },
    { href: "/dashboard/time-tracking/partes-de-obra", label: "Partes", icon: IconClipboard() },
    { href: "/dashboard/team-hours", label: "Fichajes", icon: IconUser() },
  ] as const;

  return (
    <FlashSuccessProvider>
    <TasksProvider>
    {/* `h-[100dvh]` + `overflow-hidden`: el scroll queda en `<main>`; si el shell crece con
        `min-h-screen` solamente, a veces hace scroll el documento y el `sticky` de las páginas
        (p. ej. filtros en team-hours) deja de “pegar” bien. */}
    <div className="flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
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
          <main className="min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto bg-slate-50 px-3 py-3 pb-24 md:min-h-0 md:p-5 dark:bg-slate-950">
            {children}
          </main>
        </div>

        {/* Barra rápida (móvil): cambios de módulo sin abrir menú */}
        <nav
          className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg shadow-slate-950/10 backdrop-blur-md md:hidden dark:border-slate-700/80 dark:bg-slate-900/85"
          aria-label="Navegación rápida"
        >
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-2 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-slate-800/60"
            aria-label="Abrir menú"
            title="Menú"
          >
            <span className="text-base leading-none" aria-hidden>
              ☰
            </span>
            <span className="leading-none">Menú</span>
          </button>
          {quickNavItems.map((it) => {
            const active =
              it.href === "/dashboard/time-tracking"
                ? pathname === "/dashboard/time-tracking"
                : pathname === it.href || pathname.startsWith(`${it.href}/`);
            const cls = active
              ? "bg-emerald-700 text-white"
              : "text-slate-700 hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-slate-800/60";
            return (
              <Link
                key={it.href}
                href={it.href}
                className={[
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-2 py-2 text-[11px] font-semibold transition",
                  cls,
                ].join(" ")}
              >
                <span className={["text-base leading-none", active ? "text-white/95" : ""].join(" ")} aria-hidden>
                  {it.icon}
                </span>
                <span className="leading-none">{it.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* El menú completo se abre desde la barra rápida (móvil). */}
      </div>
    </div>
    </TasksProvider>
    </FlashSuccessProvider>
  );
}
