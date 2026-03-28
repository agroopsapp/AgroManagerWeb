"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE } from "@/types";

interface HeaderProps {
  onToggleMobileSidebar: () => void;
  onToggleQuickMenu: () => void;
}

export default function Header({ onToggleMobileSidebar, onToggleQuickMenu }: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const panelHref = user?.role === USER_ROLE.Worker ? "/dashboard/tasks" : "/dashboard/manager";

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 max-w-full items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:px-3 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {/* Navegación lateral + accesos rápidos (solo móvil) */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-agro-500 bg-agro-50 px-2.5 py-2 text-[11px] font-semibold text-agro-700 shadow-sm hover:bg-agro-100 active:scale-[0.98] dark:border-agro-400 dark:bg-agro-900/40 dark:text-agro-100 sm:gap-2 sm:px-3 sm:text-xs"
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
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Abrir accesos rápidos"
          >
            ⊞
          </button>
        </div>
        <Link
          href={panelHref}
          className="flex items-center gap-2 text-xl font-bold text-agro-700 dark:text-agro-400"
        >
          <Image
            src="/PngLogoTexto.png"
            alt="AgroOps"
            width={140}
            height={40}
            className="h-8 max-h-9 w-auto max-w-[min(120px,28vw)] shrink object-contain sm:h-9 sm:max-w-[140px]"
            priority
          />
          <span className="hidden sm:inline" />
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <div className="hidden items-center gap-2 text-slate-600 dark:text-slate-300 sm:flex">
          <span className="text-sm font-medium">{user?.email ?? "Usuario"}</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-agro-100 text-agro-700 font-semibold dark:bg-agro-900/50 dark:text-agro-300">
            {(user?.email ?? "U").charAt(0).toUpperCase()}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-slate-100 px-2.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 active:scale-[0.98] dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 sm:px-4 sm:text-sm"
        >
          <span className="hidden sm:inline">Cerrar sesión</span>
          <span className="sm:hidden">Salir</span>
        </button>
      </div>
    </header>
  );
}
