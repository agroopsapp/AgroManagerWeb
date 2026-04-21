"use client";

/**
 * Campo compartido crear/editar usuario: `excludedFromTimeTracking` en POST/PUT `/api/Users`.
 */
export function UserExcludedFromTimeTrackingControl({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/40">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-agro-600 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-800"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
            Excluir del registro de jornada
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Activo: no aparece en el fichador ni en los listados de jornada de la empresa. Inactivo (por defecto):
            puede fichar con normalidad. Al guardar un usuario ya excluido, deja la casilla marcada si quieres
            conservar la exclusión (si no se envía como excluido, el servidor lo da por no excluido).
          </span>
        </span>
      </label>
    </div>
  );
}
