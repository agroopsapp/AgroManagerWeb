import type { ReactNode } from "react";

type FichajeJornadaMainPanelProps = {
  children: ReactNode;
  /**
   * `true`: mismo recorte que el fichador (sombras y bordes redondeados coherentes).
   * `false`: sin `overflow-hidden` para que `position: sticky` en descendientes siga el scroll de `main`
   * (vacaciones, partes de obra).
   */
  clipOverflow?: boolean;
};

/**
 * Marco principal compartido por las pantallas del módulo de jornada/fichaje
 * (fichador, vacaciones, partes de obra): borde redondeado, sombra y franja superior de marca.
 */
export function FichajeJornadaMainPanel({ children, clipOverflow = true }: FichajeJornadaMainPanelProps) {
  return (
    <div
      className={[
        "min-w-0 max-w-full rounded-3xl border border-slate-200/80 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/60 dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-none dark:ring-slate-700/80",
        clipOverflow ? "overflow-hidden" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="h-1 w-full bg-gradient-to-r from-agro-500 via-emerald-500 to-teal-500" aria-hidden />
      {children}
    </div>
  );
}
