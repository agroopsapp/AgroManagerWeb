"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  onToggleMobileSidebar: () => void;
  onToggleQuickMenu: () => void;
}

export default function Header({ onToggleMobileSidebar, onToggleQuickMenu }: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 md:px-6">
      <div className="flex items-center gap-1">
        {/* Botón menú rápido (solo móvil) */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={onToggleQuickMenu}
            className="inline-flex items-center gap-2 rounded-full border border-agro-500 bg-agro-50 px-3 py-2 text-xs font-semibold text-agro-700 shadow-sm hover:bg-agro-100 active:scale-[0.98] dark:border-agro-400 dark:bg-agro-900/40 dark:text-agro-100"
            aria-label="Abrir menú principal"
          >
            <span className="text-lg" aria-hidden>
              ☰
            </span>
            <span className="uppercase tracking-wide">Menú</span>
          </button>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xl font-bold text-agro-700 dark:text-agro-400"
        >
          <Image
            src="/PngLogoTexto.png"
            alt="AgroOps"
            width={140}
            height={40}
            className="shrink-0 h-9 w-auto object-contain"
            priority
          />
          <span className="hidden sm:inline" />
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 text-slate-600 dark:text-slate-300 sm:flex">
          <span className="text-sm font-medium">{user?.email ?? "Usuario"}</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-agro-100 text-agro-700 font-semibold dark:bg-agro-900/50 dark:text-agro-300">
            {(user?.email ?? "U").charAt(0).toUpperCase()}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 active:scale-[0.98] dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
