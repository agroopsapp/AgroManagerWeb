"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatures } from "@/contexts/FeaturesContext";
import { useTheme } from "@/contexts/ThemeContext";
import { appHomePath } from "@/lib/dashboardNavGating";
import { USER_ROLE } from "@/types";

interface HeaderProps {
  onToggleMobileSidebar: () => void;
  onToggleQuickMenu: () => void;
}

export default function Header({ onToggleMobileSidebar, onToggleQuickMenu }: HeaderProps) {
  const { user } = useAuth();
  const { enableTimeTracking, enableOperativaYAnalisisMenu } = useFeatures();
  const { theme, setTheme } = useTheme();
  const panelHref = appHomePath(user?.role, enableTimeTracking, enableOperativaYAnalisisMenu);
  /** Ajustes globales solo en `/dashboard/settings` (SuperAdmin); el resto cambia tema aquí. */
  const showHeaderThemeToggle = user?.role !== USER_ROLE.SuperAdmin;

  return (
    <header className="sticky top-0 z-30 flex h-12 min-w-0 max-w-full items-center justify-between gap-2 border-b border-slate-200/70 bg-white/80 px-2 backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/50 sm:px-3 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {/* Navegación lateral + accesos rápidos (solo móvil) */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-700/70 bg-emerald-50 px-2.5 py-2 text-[11px] font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100 active:scale-[0.98] dark:border-emerald-500/60 dark:bg-emerald-950/35 dark:text-emerald-100 sm:gap-2 sm:px-3 sm:text-xs"
            aria-label="Abrir menú de navegación"
          >
            <span className="text-lg" aria-hidden>
              ☰
            </span>
            <span className="max-w-[4.5rem] truncate uppercase tracking-wide sm:max-w-none">Menú</span>
          </button>
          <button
            type="button"
            onClick={onToggleQuickMenu}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300/80 bg-white/90 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Abrir accesos rápidos"
          >
            ⊞
          </button>
        </div>
        <Link
          href={panelHref}
          className="flex items-center gap-2 text-xl font-bold text-emerald-800 dark:text-emerald-200"
        >
          <Image
            src="/agroops-logo-emerald.png"
            alt="AgroOps"
            width={160}
            height={72}
            className="h-8 w-auto max-w-[min(140px,32vw)] shrink object-contain sm:h-9 sm:max-w-[160px]"
            priority
          />
          <span className="hidden sm:inline" />
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {showHeaderThemeToggle ? (
          <div
            className="flex items-center rounded-lg border border-slate-200/80 bg-slate-50/80 p-0.5 dark:border-slate-700 dark:bg-slate-900/60"
            role="group"
            aria-label="Tema claro u oscuro"
          >
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                theme === "light"
                  ? "bg-white text-emerald-800 shadow-sm dark:bg-slate-800 dark:text-emerald-200"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
              aria-pressed={theme === "light"}
            >
              Claro
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                theme === "dark"
                  ? "bg-white text-emerald-800 shadow-sm dark:bg-slate-800 dark:text-emerald-200"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
              aria-pressed={theme === "dark"}
            >
              Oscuro
            </button>
          </div>
        ) : null}
        <div className="hidden items-center gap-2 text-slate-600 dark:text-slate-300 sm:flex">
          <span className="text-sm font-medium">{user?.email ?? "Usuario"}</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-semibold dark:bg-emerald-950/35 dark:text-emerald-200">
            {(user?.email ?? "U").charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
