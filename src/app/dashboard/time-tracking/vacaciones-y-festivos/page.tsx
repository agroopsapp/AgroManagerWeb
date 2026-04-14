"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarioVacacionesFestivos } from "@/features/time-tracking/components/CalendarioVacacionesFestivos";
import { useCalendarioLaboral } from "@/features/time-tracking/hooks/useCalendarioLaboral";
import { USER_ROLE } from "@/types";

export default function VacacionesYFestivosPage() {
  const { user, isReady } = useAuth();
  const canEdit = user?.role !== USER_ROLE.Worker;

  const { marks, setDayKind, hydrated } = useCalendarioLaboral({
    companyId: user?.companyId ?? null,
  });

  if (!isReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-agro-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:px-8 sm:py-7 dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-none">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-agro-500 via-emerald-500 to-teal-500"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 pl-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-agro-600 dark:text-agro-400">
              Registro de jornada
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Vacaciones y festivos
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Calendario de referencia con festivos y periodos de vacaciones marcados por la empresa. Todos pueden
              consultarlo; solo administradores y managers pueden editarlo.
            </p>
          </div>
          <Link
            href="/dashboard/time-tracking"
            className="shrink-0 rounded-xl border border-slate-200/90 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            ← Volver al fichador
          </Link>
        </div>
      </header>

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/60 dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-none dark:ring-slate-700/80">
        <div className="h-1 w-full bg-gradient-to-r from-agro-500 via-emerald-500 to-teal-500" aria-hidden />
        <div className="p-4 sm:p-6 lg:p-8">
          {!hydrated ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-agro-500 border-t-transparent" />
            </div>
          ) : (
            <CalendarioVacacionesFestivos
              canEdit={canEdit}
              marks={marks}
              onSetDayKind={setDayKind}
            />
          )}
        </div>
      </div>

      {canEdit && hydrated && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Los cambios se guardan en este navegador (por empresa en sesión, si el login la aporta). Cuando haya API de
          calendario laboral, se podrá sincronizar con el servidor para todo el equipo.
        </p>
      )}
    </div>
  );
}
