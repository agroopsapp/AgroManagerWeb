"use client";

import { MODAL_BACKDROP_CENTER, modalScrollablePanel } from "@/components/modalShell";
import { formatDateES } from "@/shared/utils/time";

type PersonalEditarDiaModalProps = {
  workDate: string;
  personaLabel: string;
  isWeekend: boolean;
  onClose: () => void;
  /** Abre el flujo de imputación manual (ForgotModal / olvidé fichar). */
  onModificarHorario: () => void;
};

/**
 * Paso intermedio antes de imputar horas desde el histórico personal.
 * Ausencias: UI lista; acciones se conectarán al API cuando esté disponible.
 */
export function PersonalEditarDiaModal({
  workDate,
  personaLabel,
  isWeekend,
  onClose,
  onModificarHorario,
}: PersonalEditarDiaModalProps) {
  return (
    <div
      className={`fixed inset-0 z-[100] ${MODAL_BACKDROP_CENTER}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="personal-editar-dia-title"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Escape") onClose();
      }}
    >
      <div
        className={modalScrollablePanel("lg")}
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2
          id="personal-editar-dia-title"
          className="text-lg font-bold text-slate-900 dark:text-slate-50"
        >
          Editar día
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{personaLabel}</span>
          {" · "}
          {formatDateES(workDate)}
          {isWeekend ? (
            <span className="ml-1 text-xs text-slate-500">(fin de semana)</span>
          ) : null}
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Ausencias
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled
                title="Próximamente: conexión con el servidor"
                className="flex-1 cursor-not-allowed rounded-xl border-2 border-sky-400/50 bg-sky-50/80 px-4 py-3 text-sm font-semibold text-sky-900/60 opacity-60 dark:border-sky-600/50 dark:bg-sky-950/30 dark:text-sky-100/70"
              >
                Añadir vacaciones
              </button>
              <button
                type="button"
                disabled
                title="Próximamente: conexión con el servidor"
                className="flex-1 cursor-not-allowed rounded-xl border-2 border-violet-400/50 bg-violet-50/80 px-4 py-3 text-sm font-semibold text-violet-900/60 opacity-60 dark:border-violet-600/50 dark:bg-violet-950/30 dark:text-violet-100/70"
              >
                Añadir baja / ausencia
              </button>
            </div>
            <button
              type="button"
              disabled
              title="Próximamente: conexión con el servidor"
              className="mt-2 w-full cursor-not-allowed rounded-xl border-2 border-stone-400/50 bg-stone-50/80 px-4 py-3 text-sm font-semibold text-stone-900/60 opacity-60 dark:border-stone-500/50 dark:bg-stone-900/30 dark:text-stone-100/70"
            >
              Marcar día no laboral
            </button>
            <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              Las ausencias se activarán aquí cuando el endpoint esté listo. Mientras tanto, usa{" "}
              <strong className="font-semibold text-slate-600 dark:text-slate-300">
                Modificar horario
              </strong>{" "}
              para imputar la jornada.
            </p>
          </div>

          <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Jornada laboral
            </p>
            <button
              type="button"
              onClick={() => {
                onModificarHorario();
              }}
              className="w-full rounded-xl border-2 border-agro-500 bg-agro-50 px-4 py-3 text-sm font-semibold text-agro-900 shadow-sm transition hover:bg-agro-100 dark:border-agro-600 dark:bg-agro-950/40 dark:text-agro-100 dark:hover:bg-agro-900/50"
            >
              Modificar horario (imputación manual)
            </button>
            <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              Nuevas entrada y salida; la razón mostrará{" "}
              <strong>imputación manual (RRHH)</strong>, con fechas anteriores en las columnas
              correspondientes.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
