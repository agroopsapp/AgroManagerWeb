import type { ReactNode } from "react";

type DashboardPageShellProps = {
  children: ReactNode;
  /** Clases extra en el contenedor. */
  className?: string;
  /**
   * `default`: ancho máximo legible (listados, formularios).
   * `full`: sin `max-w` (rejillas / tablas que necesitan todo el ancho del `main`).
   */
  width?: "default" | "full";
};

/**
 * Contenedor interior de pantallas del dashboard: ancho máximo y ritmo vertical
 * uniforme entre rutas. El `<main>` ya aporta el padding lateral.
 */
export function DashboardPageShell({ children, className, width = "default" }: DashboardPageShellProps) {
  const w =
    width === "full" ? "w-full min-w-0" : "mx-auto w-full max-w-7xl";
  return <div className={[w, "space-y-6", className].filter(Boolean).join(" ")}>{children}</div>;
}
