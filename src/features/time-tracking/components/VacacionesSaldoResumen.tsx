"use client";

/**
 * Vista previa de saldo de vacaciones (consumidas vs disponibles respecto a un total concedido).
 * El total anual vendrá del backend; de momento es un valor fijo solo para diseño.
 */

export type VacacionesSaldoResumenProps = {
  /** Vista «Todos» u otro caso sin usuario concreto: mensaje sin cifras de saldo. */
  showSaldo: boolean;
  /** Días marcados como vacaciones en el calendario local del usuario seleccionado. */
  consumedDays: number;
  /** Días de vacaciones concedidos en el periodo de referencia (mock hasta API). */
  grantedDaysAnnual: number;
  /** Etiqueta opcional (p. ej. año natural). */
  periodLabel?: string;
};

export function VacacionesSaldoResumen({
  showSaldo,
  consumedDays,
  grantedDaysAnnual,
  periodLabel = "Saldo (vista previa)",
}: VacacionesSaldoResumenProps) {
  if (!showSaldo) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/80 px-3 py-3 dark:border-slate-600/80 dark:bg-slate-800/40">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Saldo de vacaciones
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
          Elige una persona en <span className="font-medium text-slate-800 dark:text-slate-100">Usuario</span> para ver
          días consumidos y disponibles. Con <span className="font-medium">Todos</span> solo se unen las marcas en el
          calendario, sin saldo individual.
        </p>
      </div>
    );
  }

  const granted = Math.max(0, Math.round(grantedDaysAnnual));
  const consumed = Math.max(0, Math.round(consumedDays));
  const available = Math.max(0, granted - consumed);
  const over = consumed > granted ? consumed - granted : 0;
  const pctConsumed = granted > 0 ? Math.min(100, (consumed / granted) * 100) : consumed > 0 ? 100 : 0;
  const pctAvailable = granted > 0 ? Math.min(100, (available / granted) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/90 px-3 py-3 shadow-sm dark:border-slate-600/80 dark:from-slate-900 dark:to-slate-900/80 dark:shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Saldo de vacaciones
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">{periodLabel}</p>
        </div>
        <span className="shrink-0 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-400/15 dark:text-sky-200">
          Demo
        </span>
      </div>

      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/90"
        role="img"
        aria-label={`Vacaciones: ${consumed} días consumidos de ${granted} concedidos, ${available} disponibles`}
      >
        <div className="flex h-full w-full">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-sky-600 transition-[width] duration-300 dark:from-sky-400 dark:to-sky-500"
            style={{ width: `${pctConsumed}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-emerald-400/90 to-teal-500/90 transition-[width] duration-300 dark:from-emerald-500/80 dark:to-teal-500/80"
            style={{ width: `${pctAvailable}%` }}
          />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-2 text-[11px]">
        <div className="rounded-lg border border-sky-200/70 bg-sky-50/90 px-2 py-1.5 dark:border-sky-800/60 dark:bg-sky-950/35">
          <dt className="font-medium text-sky-900/80 dark:text-sky-100/90">Consumidas</dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums text-sky-950 dark:text-sky-50">{consumed}</dd>
          <dd className="text-[10px] text-sky-800/70 dark:text-sky-200/70">días en calendario</dd>
        </div>
        <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/90 px-2 py-1.5 dark:border-emerald-800/50 dark:bg-emerald-950/30">
          <dt className="font-medium text-emerald-900/85 dark:text-emerald-100/90">Disponibles</dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums text-emerald-950 dark:text-emerald-50">{available}</dd>
          <dd className="text-[10px] text-emerald-800/70 dark:text-emerald-200/70">respecto al total demo</dd>
        </div>
        <div className="col-span-2 rounded-lg border border-slate-200/80 bg-white/80 px-2 py-1.5 dark:border-slate-600/70 dark:bg-slate-950/40">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Concedidas (referencia)
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{granted}</dd>
          <dd className="text-[10px] text-slate-500 dark:text-slate-400">
            Valor fijo de diseño; luego vendrá del servidor (contrato por persona y año).
          </dd>
        </div>
      </dl>

      {over > 0 ? (
        <p className="mt-2 text-[10px] font-medium text-amber-800 dark:text-amber-200/90">
          En calendario hay {over} día{over === 1 ? "" : "s"} por encima del total demo: revisar cuando exista saldo
          real.
        </p>
      ) : null}
    </div>
  );
}
