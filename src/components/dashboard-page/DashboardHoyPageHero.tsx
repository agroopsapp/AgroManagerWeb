import type { ReactNode } from "react";

export type DashboardHoyPageHeroProps = {
  /** Mismo texto que el ítem del menú «Hoy» (coherencia con la navegación). */
  sectionLabel: string;
  /** Título principal de la pantalla. */
  title: string;
  /** Párrafos, enlaces u otro contenido bajo el H1 (estilos a cargo del padre). */
  description?: ReactNode;
  /** Columna derecha en desktop: sesión, botones, etc. */
  trailing?: ReactNode;
  /** Contenido bajo la descripción: estadísticas rápidas, avisos, `<details>`, etc. */
  extraBelow?: ReactNode;
};

/**
 * Cabecera visual de tarjeta con acento (jornada/fichaje y pantallas de administración que deben
 * alinearse con ese mismo ancho y estilo).
 */
export function DashboardHoyPageHero({
  sectionLabel,
  title,
  description,
  trailing,
  extraBelow,
}: DashboardHoyPageHeroProps) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:px-8 sm:py-7 dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-none">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-500 via-emerald-400 to-emerald-600"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-emerald-500/[0.08] blur-3xl dark:bg-emerald-400/12"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 pl-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
            {sectionLabel}
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {title}
          </h1>
          {description ? <div className="mt-2 min-w-0 space-y-2">{description}</div> : null}
          {extraBelow ? <div className="mt-3 min-w-0 space-y-2">{extraBelow}</div> : null}
        </div>
        {trailing ? (
          <div className="flex min-w-0 shrink-0 flex-col gap-2 sm:items-end">{trailing}</div>
        ) : null}
      </div>
    </header>
  );
}
