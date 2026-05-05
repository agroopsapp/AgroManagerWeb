import type { ReactNode } from "react";

type PageCalloutErrorProps = {
  children: ReactNode;
};

/** Mensaje de error a ancho de página, mismo estilo en todas las rutas. */
export function PageCalloutError({ children }: PageCalloutErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500 dark:bg-red-900/30 dark:text-red-200"
    >
      {children}
    </div>
  );
}
