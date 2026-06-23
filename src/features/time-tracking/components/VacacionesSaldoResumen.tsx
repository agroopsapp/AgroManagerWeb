"use client";

import type { UserVacationBalanceDto } from "@/services/user-vacations.service";

export type VacacionesSaldoResumenProps = {
  /** Vista «Todos» u otro caso sin usuario concreto: mensaje sin cifras de saldo. */
  showSaldo: boolean;
  /** Saldo del servidor (`GET /api/UserVacations/balance`). */
  balance: UserVacationBalanceDto | null;
  loading?: boolean;
  /** Etiqueta opcional (p. ej. año natural). */
  periodLabel?: string;
};

export function VacacionesSaldoResumen({
  showSaldo,
  balance,
  loading = false,
  periodLabel = "Saldo de vacaciones",
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

  const granted = balance?.daysAllowed ?? null;
  const consumed = Math.max(0, balance?.usedDays ?? 0);
  const available =
    balance?.remainingDays != null ? Math.max(0, balance.remainingDays) : null;
  const over =
    granted != null && consumed > granted ? consumed - granted : 0;

  const pctConsumed =
    granted != null && granted > 0
      ? Math.min(100, (consumed / granted) * 100)
      : consumed > 0
        ? 100
        : 0;
  const pctAvailable =
    granted != null && granted > 0 && available != null
      ? Math.min(100, (available / granted) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/90 px-3 py-3 shadow-sm dark:border-slate-600/80 dark:from-slate-900 dark:to-slate-900/80 dark:shadow-none">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Saldo de vacaciones
        </p>
        <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">{periodLabel}</p>
      </div>

      {loading ? (
        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">Cargando saldo…</p>
      ) : (
        <>
          <div
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/90"
            role="img"
            aria-label={
              granted != null
                ? `Vacaciones: ${consumed} días usados de ${granted} del cupo, ${available ?? 0} disponibles`
                : `Vacaciones: ${consumed} días usados, sin cupo definido`
            }
          >
            <div className="flex h-full w-full">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-sky-600 transition-[width] duration-300 dark:from-sky-400 dark:to-sky-500"
                style={{ width: `${pctConsumed}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-emerald-400/90 to-emerald-600/90 transition-[width] duration-300 dark:from-emerald-500/80 dark:to-emerald-600/80"
                style={{ width: `${pctAvailable}%` }}
              />
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-2 text-[11px]">
            <div className="rounded-lg border border-sky-200/70 bg-sky-50/90 px-2 py-1.5 dark:border-sky-800/60 dark:bg-sky-950/35">
              <dt className="font-medium text-sky-900/80 dark:text-sky-100/90">Usados</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-sky-950 dark:text-sky-50">
                {consumed}
              </dd>
              <dd className="text-[10px] text-sky-800/70 dark:text-sky-200/70">
                fichajes con status Vacation
              </dd>
            </div>
            <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/90 px-2 py-1.5 dark:border-emerald-800/50 dark:bg-emerald-950/30">
              <dt className="font-medium text-emerald-900/85 dark:text-emerald-100/90">Disponibles</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums text-emerald-950 dark:text-emerald-50">
                {available != null ? available : "—"}
              </dd>
              <dd className="text-[10px] text-emerald-800/70 dark:text-emerald-200/70">
                {granted != null ? `de ${granted} días del cupo` : "sin cupo definido"}
              </dd>
            </div>
          </dl>

          {over > 0 ? (
            <p className="mt-2 text-[10px] font-medium text-amber-800 dark:text-amber-200/90">
              Hay {over} día{over === 1 ? "" : "s"} por encima del cupo anual.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
