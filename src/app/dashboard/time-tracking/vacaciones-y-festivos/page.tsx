"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarioVacacionesFestivos } from "@/features/time-tracking/components/CalendarioVacacionesFestivos";
import { useCalendarioLaboral } from "@/features/time-tracking/hooks/useCalendarioLaboral";
import { VacacionesSaldoResumen } from "@/features/time-tracking/components/VacacionesSaldoResumen";
import { countVacationDaysInMarks, listIsoDaysInclusive } from "@/features/time-tracking/utils/calendarioLaboral";
import { usersApi } from "@/services";
import { USER_ROLE } from "@/types";
import type { User } from "@/types";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";

/** Valor del `<select>` para ver vacaciones de todos los usuarios (solo admin-like). */
const VACACIONES_USER_TODOS = "todas";

/** Misma base visual que horas del equipo (`team-hours`): panel de filtros lateral + sticky. */
const cardSurfaceClass =
  "rounded-2xl border border-slate-200/65 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-700/75 dark:bg-slate-900/45 dark:shadow-none";

const filterLabelClass =
  "text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500";

const compactSelectClass =
  "rounded-md border border-slate-200/80 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm outline-none transition cursor-pointer focus:border-agro-600/45 focus:ring-1 focus:ring-agro-500/15 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-agro-500/70";

/** Total anual de referencia solo para la UI (sustituir por API: días concedidos por persona/año). */
const VACACIONES_SALDO_MOCK_CONCEDIDOS_ANUAL = 22;

export default function VacacionesYFestivosPage() {
  const { user, isReady } = useAuth();
  const role = user?.role;
  const isAdminLike = role === USER_ROLE.Admin || role === USER_ROLE.SuperAdmin || role === USER_ROLE.Manager;

  const { holidaysByDate, vacationsByUserId, setHolidayMark, setVacationMark, hydrated } =
    useCalendarioLaboral({
    companyId: user?.companyId ?? null,
  });

  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");

  useEffect(() => {
    if (!isReady || !user) return;
    if (isAdminLike) setSelectedUserId(VACACIONES_USER_TODOS);
    else setSelectedUserId(user.id);
  }, [isReady, user, isAdminLike]);

  useEffect(() => {
    if (!isReady || !user) return;
    const ac = new AbortController();

    const nombreDesdeEmail = (email: string) => {
      const t = email.trim();
      if (!t) return "Usuario";
      const at = t.indexOf("@");
      const local = (at > 0 ? t.slice(0, at) : t).replace(/[._-]+/g, " ").trim();
      if (!local) return t;
      return local.replace(/\b\w/g, (ch) => ch.toUpperCase());
    };

    const load = async () => {
      setUsersLoading(true);
      setUsersError(null);
      try {
        if (role === USER_ROLE.Worker) {
          try {
            const me = await usersApi.getById(user.id);
            if (ac.signal.aborted) return;
            const name = (me.name ?? "").trim() || nombreDesdeEmail(me.email || user.email);
            setUsers([{ ...me, name }]);
          } catch {
            if (ac.signal.aborted) return;
            setUsers([
              {
                id: user.id,
                name: nombreDesdeEmail(user.email),
                email: user.email,
                phone: "",
                roleId: "",
                companyId: user.companyId,
              },
            ]);
          }
          return;
        }

        const data = await usersApi.getAll({ signal: ac.signal });
        if (ac.signal.aborted) return;
        const filtered =
          user.companyId && isAdminLike
            ? data.filter((u) => (u.companyId ?? "").trim() === user.companyId)
            : data;
        setUsers(filtered);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setUsers([]);
        setUsersError(userVisibleMessageFromUnknown(err, "No se pudieron cargar los usuarios."));
      } finally {
        if (!ac.signal.aborted) setUsersLoading(false);
      }
    };
    void load();
    return () => ac.abort();
  }, [isReady, user, role, isAdminLike]);

  useEffect(() => {
    if (!isReady || !user) return;
    if (role === USER_ROLE.Worker) return;
    if (!selectedUserId) return;
    if (selectedUserId === VACACIONES_USER_TODOS) return;
    if (users.length === 0) return;
    if (users.some((u) => u.id === selectedUserId)) return;
    setSelectedUserId(users[0].id);
  }, [isReady, user, role, selectedUserId, users]);

  const vacationDaysConsumed = useMemo(() => {
    if (!selectedUserId || selectedUserId === VACACIONES_USER_TODOS) return 0;
    return countVacationDaysInMarks(vacationsByUserId[selectedUserId] ?? {});
  }, [selectedUserId, vacationsByUserId]);

  const showVacacionesSaldo = Boolean(
    selectedUserId && selectedUserId !== VACACIONES_USER_TODOS,
  );

  const saldoPeriodLabel = `Año natural ${new Date().getFullYear()} · cifras de demostración`;

  const vacationsByDate = useMemo(() => {
    const uid = selectedUserId ?? user?.id ?? null;
    if (!uid) return {};
    if (uid === VACACIONES_USER_TODOS) {
      const out: Record<string, import("@/features/time-tracking/types").CalendarioLaboralDayMark> = {};
      for (const map of Object.values(vacationsByUserId)) {
        for (const [dateISO, mark] of Object.entries(map)) {
          if (!out[dateISO]) {
            out[dateISO] = mark;
            continue;
          }
          const prev = out[dateISO];
          const sameKind = prev.kind === mark.kind;
          const prevNote = prev.note?.trim();
          const nextNote = mark.note?.trim();
          if (!sameKind) {
            out[dateISO] = { kind: "vacaciones", note: "Varios usuarios" };
            continue;
          }
          if (prevNote && nextNote && prevNote !== nextNote) {
            out[dateISO] = { ...prev, note: "Varios usuarios" };
          } else if (!prevNote && nextNote) {
            out[dateISO] = { ...prev, note: nextNote };
          }
        }
      }
      return out;
    }
    return vacationsByUserId[uid] ?? {};
  }, [selectedUserId, user, vacationsByUserId]);

  const canEditFestivos = isAdminLike;
  const canEditVacaciones =
    (isAdminLike && selectedUserId != null && selectedUserId !== VACACIONES_USER_TODOS) ||
    (role === USER_ROLE.Worker && selectedUserId != null && selectedUserId === user?.id);

  const canEdit = canEditFestivos || canEditVacaciones;
  const rangeError =
    rangeFrom && rangeTo && rangeFrom > rangeTo ? "El rango no es válido: «desde» es mayor que «hasta»." : null;
  const visibleRange =
    rangeError || (!rangeFrom && !rangeTo)
      ? null
      : {
          from: rangeFrom || rangeTo,
          to: rangeTo || rangeFrom,
        };

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
              Consulta festivos de empresa y vacaciones por trabajador. Los festivos los gestiona administración; cada
              trabajador puede ver (y editar solo sus vacaciones, si procede).
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

      {/* Sin `overflow-hidden` en el ancestro: si no, `sticky` del panel de filtros no funciona (mismo criterio que team-hours). */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/60 dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-none dark:ring-slate-700/80">
        <div className="h-1 w-full bg-gradient-to-r from-agro-500 via-emerald-500 to-teal-500" aria-hidden />
        <div className="p-4 sm:p-6 lg:p-8">
          {!hydrated ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-agro-500 border-t-transparent" />
            </div>
          ) : (
            <div className="flex min-h-0 flex-col gap-4 lg:grid lg:grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)] lg:items-stretch">
              {/* En `lg`, la columna del aside se estira con el calendario para que `sticky` tenga recorrido al scroll de `main`. */}
              <div className="min-h-0 min-w-0">
                <aside
                  aria-label="Filtros de la vista"
                  className={`${cardSurfaceClass} space-y-3 p-3 sticky top-3 z-[2]`}
                >
                  <div>
                    <h2 className="text-xs font-semibold text-slate-900 dark:text-white">Filtros</h2>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      Usuario y rango visible en el calendario.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="vacaciones-filtro-usuario" className={filterLabelClass}>
                      Usuario
                    </label>
                    <select
                      id="vacaciones-filtro-usuario"
                      value={selectedUserId ?? ""}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      disabled={role === USER_ROLE.Worker || usersLoading || users.length === 0}
                      className={`w-full ${compactSelectClass} disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {isAdminLike ? (
                        <option value={VACACIONES_USER_TODOS}>Todos</option>
                      ) : null}
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name?.trim() ? u.name : u.email}
                        </option>
                      ))}
                    </select>
                    {usersError ? (
                      <p className="text-[11px] text-rose-700 dark:text-rose-300">{usersError}</p>
                    ) : null}
                  </div>

                  <div className="border-t border-slate-200/80 pt-3 dark:border-slate-700/80">
                    <p className={filterLabelClass}>Rango de fechas (opcional)</p>
                    <div className="mt-2 space-y-2">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Desde</span>
                        <input
                          type="date"
                          value={rangeFrom}
                          onChange={(e) => setRangeFrom(e.target.value)}
                          className={`w-full ${compactSelectClass}`}
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Hasta</span>
                        <input
                          type="date"
                          value={rangeTo}
                          onChange={(e) => setRangeTo(e.target.value)}
                          className={`w-full ${compactSelectClass}`}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setRangeFrom("");
                          setRangeTo("");
                        }}
                        className={`w-full ${compactSelectClass} border-slate-200/90 bg-slate-50 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`}
                      >
                        Limpiar
                      </button>
                    </div>
                    {rangeError ? (
                      <p className="mt-2 text-[11px] font-semibold text-rose-700 dark:text-rose-300">{rangeError}</p>
                    ) : null}
                    {visibleRange ? (
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        Mostrando: <span className="font-semibold tabular-nums">{visibleRange.from}</span> →{" "}
                        <span className="font-semibold tabular-nums">{visibleRange.to}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="border-t border-slate-200/80 pt-3 dark:border-slate-700/80">
                    <VacacionesSaldoResumen
                      showSaldo={showVacacionesSaldo}
                      consumedDays={vacationDaysConsumed}
                      grantedDaysAnnual={VACACIONES_SALDO_MOCK_CONCEDIDOS_ANUAL}
                      periodLabel={saldoPeriodLabel}
                    />
                  </div>

                  {visibleRange ? (
                    <div className="border-t border-slate-200/80 pt-3 dark:border-slate-700/80">
                      <p className={filterLabelClass}>Rango seleccionado</p>
                      <div className="mt-2 flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={!canEditFestivos}
                          onClick={() => {
                            if (!canEditFestivos) return;
                            for (const day of listIsoDaysInclusive(visibleRange.from, visibleRange.to)) {
                              setHolidayMark(day, { kind: "festivo" });
                            }
                          }}
                          className="w-full rounded-md border border-amber-400/70 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:bg-amber-900/35"
                        >
                          Marcar rango como festivo
                        </button>
                        <button
                          type="button"
                          disabled={!canEditVacaciones}
                          onClick={() => {
                            if (!canEditVacaciones) return;
                            const uid = selectedUserId ?? user?.id ?? null;
                            if (!uid || uid === VACACIONES_USER_TODOS) return;
                            for (const day of listIsoDaysInclusive(visibleRange.from, visibleRange.to)) {
                              setVacationMark(uid, day, { kind: "vacaciones" });
                            }
                          }}
                          className="w-full rounded-md border border-sky-400/70 bg-sky-50 px-2 py-1.5 text-[11px] font-semibold text-sky-950 shadow-sm transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-50 dark:hover:bg-sky-900/35"
                        >
                          Marcar rango como vacaciones
                        </button>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => {
                            if (!canEdit) return;
                            const uid = selectedUserId ?? user?.id ?? null;
                            for (const day of listIsoDaysInclusive(visibleRange.from, visibleRange.to)) {
                              if (canEditFestivos) setHolidayMark(day, null);
                              if (canEditVacaciones && uid && uid !== VACACIONES_USER_TODOS) {
                                setVacationMark(uid, day, null);
                              }
                            }
                          }}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Quitar marcas del rango
                        </button>
                      </div>
                    </div>
                  ) : null}
                </aside>
              </div>

              <div className="min-w-0">
                <CalendarioVacacionesFestivos
                  canEditHolidays={canEditFestivos}
                  canEditVacations={canEditVacaciones}
                  holidaysByDate={holidaysByDate}
                  vacationsByDate={vacationsByDate}
                  visibleRange={visibleRange}
                  onSetHoliday={(dateISO, mark) => setHolidayMark(dateISO, mark)}
                  onSetVacation={(dateISO, mark) => {
                    const uid = selectedUserId ?? user?.id ?? null;
                    if (!uid || uid === VACACIONES_USER_TODOS) return;
                    setVacationMark(uid, dateISO, mark);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {hydrated && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Los cambios se guardan en este navegador (por empresa). Más adelante se puede conectar a una API para
          sincronizarlo con el servidor.
        </p>
      )}
    </div>
  );
}
