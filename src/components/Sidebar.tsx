"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

/** Fondo alineado con marca (verde oscuro + degradado esmeralda). */
const asideSurfaceClass =
  "border-r border-emerald-950/30 bg-gradient-to-b from-[#045041] via-[#063D2E] to-[#0B5A3D] text-emerald-50 shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.25)] dark:border-emerald-600/35";

const asideClass = (collapsed: boolean, mobileDrawer?: boolean) =>
  mobileDrawer
    ? `flex h-full min-h-0 w-full flex-col overflow-hidden ${asideSurfaceClass}`
    : `flex h-full min-h-0 shrink-0 flex-col ${asideSurfaceClass} transition-[width] duration-200 ${
        collapsed ? "w-full md:w-16" : "w-full md:w-56 lg:w-64"
      }`;

export default function Sidebar({ pathname, collapsed, onToggle, onNavigate, mobileDrawer }: SidebarProps) {
  const { enableAnimals, enableTimeTracking, enableOperativaYAnalisisMenu } = useFeatures();
  const { user, logout } = useAuth();
  const router = useRouter();
  const role = user?.role;

  const visibility = {
    role,
    enableAnimals,
    enableTimeTracking,
    enableOperativaYAnalisisMenu,
  };

  const showLabels = mobileDrawer || !collapsed;

  const handleLogout = () => {
    const ok = window.confirm("¿Seguro que quieres cerrar sesión?");
    if (!ok) return;
    logout();
    onNavigate?.();
    router.push("/login");
  };

  return (
    <aside className={`${asideClass(collapsed, mobileDrawer)} relative`}>
      {/* Brillo superior sutil (no tapa el contenido) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-16 bg-gradient-to-b from-emerald-400/12 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-px bg-gradient-to-r from-transparent via-emerald-300/35 to-transparent"
        aria-hidden
      />
      {/* Fondo fotográfico: parte inferior (arranca a media altura del menú) */}
      <div className="pointer-events-none absolute inset-x-0 top-[44%] bottom-0 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0 scale-[1.04] bg-cover bg-center opacity-[0.95] mix-blend-soft-light saturate-[1.25] contrast-[1.12] brightness-[1.06]"
          style={{ backgroundImage: "url('/login-bg.png')" }}
        />
        {/* Suave transición arriba y protección abajo para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/15 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/88 via-emerald-950/25 to-transparent" />
      </div>
      <nav className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2 md:p-3">
        {DASHBOARD_NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => isDashboardNavLinkVisible(item, visibility));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="flex shrink-0 flex-col gap-1">
              {showLabels && (
                <p className="mb-0.5 px-2 text-xs font-semibold uppercase tracking-wide text-emerald-100/85">
                  {section.title}
                </p>
              )}
              {visibleItems.map(({ href, label, icon }) => {
                const isActive =
                  href === "/dashboard/time-tracking"
                    ? pathname === "/dashboard/time-tracking"
                    : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <div key={href} className="flex flex-col gap-1">
                    <Link
                      href={href}
                      title={showLabels ? undefined : label}
                      onClick={() => onNavigate?.()}
                      className={`flex items-center rounded-xl px-3 py-3 text-sm font-semibold transition md:py-2.5 ${
                        showLabels ? "gap-3 px-4" : "justify-center md:px-3"
                      } ${
                        isActive
                          ? "bg-gradient-to-r from-emerald-400/25 to-emerald-600/15 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14)] ring-1 ring-emerald-300/40"
                          : "text-emerald-50/85 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="text-lg shrink-0" aria-hidden>
                        {icon}
                      </span>
                      {showLabels && <span className="truncate">{label}</span>}
                    </Link>

                    {/* Cerrar sesión justo debajo de «Trabajadores» */}
                    {href === "/dashboard/users" && (
                      <button
                        type="button"
                        onClick={handleLogout}
                        className={`flex items-center rounded-xl border border-emerald-400/25 bg-emerald-950/20 px-3 py-3 text-sm font-semibold transition md:py-2.5 ${
                          showLabels ? "gap-3 px-4" : "justify-center md:px-3"
                        } text-emerald-50/90 hover:border-emerald-300/45 hover:bg-emerald-400/15 hover:text-white`}
                        aria-label="Cerrar sesión"
                        title={showLabels ? undefined : "Cerrar sesión"}
                      >
                        <span className="text-lg shrink-0" aria-hidden>
                          ⎋
                        </span>
                        {showLabels && <span className="truncate">Cerrar sesión</span>}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onToggle}
          aria-label={mobileDrawer ? "Cerrar menú" : collapsed ? "Expandir menú" : "Colapsar menú"}
          className="mt-auto flex w-full shrink-0 items-center justify-center rounded-xl border border-transparent px-3 py-2.5 text-emerald-50/85 transition hover:border-emerald-400/20 hover:bg-white/10 hover:text-white md:px-3"
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
