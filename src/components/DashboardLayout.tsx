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
          <main className="min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto bg-slate-50 px-3 py-3 md:min-h-0 md:p-5 dark:bg-slate-950">
            {children}
          </main>
        </div>

        {/* Botón flotante (móvil): abrir navegación sin header */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="fixed bottom-4 left-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-700 text-lg font-semibold text-white shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-800 active:scale-[0.98] md:hidden"
          aria-label="Abrir menú"
          title="Menú"
        >
          ☰
        </button>
      </div>
    </div>
    </TasksProvider>
    </FlashSuccessProvider>
  );
}
