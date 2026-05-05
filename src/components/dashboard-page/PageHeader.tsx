import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Botones u otras acciones alineadas a la derecha en desktop. */
  actions?: ReactNode;
};

/**
 * Cabecera estándar de pantalla: un solo H1, descripción opcional y zona de acciones.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {title}
        </h1>
        {description ? (
          <div className="mt-1 space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400 [&_strong]:font-semibold">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
