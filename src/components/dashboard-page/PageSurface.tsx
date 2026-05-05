import type { ReactNode } from "react";

type PageSurfaceProps = {
  children: ReactNode;
  className?: string;
  /** Si es false, no añade padding (útil para tablas a ancho completo). */
  padded?: boolean;
};

/**
 * Tarjeta / panel estándar del dashboard (bordes, fondo claro/oscuro, sombra suave).
 */
export function PageSurface({ children, className, padded = true }: PageSurfaceProps) {
  const base =
    "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800";
  const pad = padded ? "p-3" : "";
  return <div className={[base, pad, className].filter(Boolean).join(" ")}>{children}</div>;
}
