/**
 * Estilos compartidos para modales / diálogos.
 * Sustituye copias de `bg-black/50` + `rounded-2xl` + `shadow-xl` por un aspecto más coherente.
 */

/** Cuerpo del modal: borde suave, sombra amplia, esquinas más redondeadas. */
export const MODAL_SURFACE =
  "rounded-[1.35rem] border border-slate-200/90 bg-white text-slate-900 shadow-[0_22px_55px_-18px_rgba(15,23,42,0.32),0_0_0_1px_rgba(15,23,42,0.04)] dark:border-slate-500/35 dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_28px_60px_-20px_rgba(0,0,0,0.72)]";

export const MODAL_SURFACE_PAD = "p-4 sm:p-5";

const MODAL_MAX: Record<"sm" | "md" | "lg" | "xl" | "2xl", string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

/**
 * Capa oscura detrás del contenido. Prefija con `fixed inset-0 z-…` según el apilamiento.
 * `supports-[backdrop-filter]` evita fondo demasiado plano en navegadores sin blur.
 */
export const MODAL_BACKDROP_CENTER =
  "flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-[4px] supports-[backdrop-filter]:bg-slate-950/40 sm:p-4";

/** Para formularios largos: scroll en el overlay, centrado en `sm+`. */
export const MODAL_BACKDROP_SCROLL =
  "flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 py-4 backdrop-blur-[4px] supports-[backdrop-filter]:bg-slate-950/40 sm:items-center sm:py-6";

/** Panel con scroll interno y anchura máxima típica. */
export function modalScrollablePanel(
  max: keyof typeof MODAL_MAX,
  opts?: { maxHeight?: "90" | "92"; className?: string },
) {
  const mh = opts?.maxHeight === "92" ? "max-h-[min(92vh,900px)]" : "max-h-[min(90vh,880px)]";
  const extra = opts?.className?.trim() ? ` ${opts.className.trim()}` : "";
  return `my-auto w-full ${MODAL_MAX[max]} ${mh} overflow-y-auto ${MODAL_SURFACE} ${MODAL_SURFACE_PAD}${extra}`;
}

/** Marco sin padding (cabecera + cuerpo a mano, p. ej. CreateTaskModal). */
export function modalFramePanel(max: keyof typeof MODAL_MAX, opts?: { className?: string }) {
  const mh = "max-h-[min(90vh,880px)]";
  const extra = opts?.className?.trim() ? ` ${opts.className.trim()}` : "";
  return `w-full ${MODAL_MAX[max]} ${mh} overflow-hidden ${MODAL_SURFACE}${extra}`;
}
