"use client";



import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";

import { CalendarioVacacionesFestivos } from "@/features/time-tracking/components/CalendarioVacacionesFestivos";

import { useCompanyHolidays } from "@/features/time-tracking/hooks/useCompanyHolidays";

import { useCompanyVacationAllowances } from "@/features/time-tracking/hooks/useCompanyVacationAllowances";

import { useUserVacations } from "@/features/time-tracking/hooks/useUserVacations";

import { CupoVacacionesResumen } from "@/features/time-tracking/components/CupoVacacionesResumen";

import { FestivosEmpresaResumen } from "@/features/time-tracking/components/FestivosEmpresaResumen";

import { VacacionesSaldoResumen } from "@/features/time-tracking/components/VacacionesSaldoResumen";

import { listIsoDaysInclusive } from "@/features/time-tracking/utils/calendarioLaboral";

import { usersApi } from "@/services";

import { USER_ROLE } from "@/types";

import type { User } from "@/types";

import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";

import { DashboardHoyPageHero, DashboardPageShell, FichajeJornadaMainPanel } from "@/components/dashboard-page";



/** Valor del `<select>` para ver vacaciones de todos los usuarios (solo admin-like). */

const VACACIONES_USER_TODOS = "todas";



/** Misma base visual que horas del equipo (`team-hours`): panel de filtros lateral + sticky. */

const cardSurfaceClass =

  "rounded-2xl border border-slate-200/65 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-700/75 dark:bg-slate-900/45 dark:shadow-none";



const filterLabelClass =

  "text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500";



const compactSelectClass =

  "rounded-md border border-slate-200/80 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm outline-none transition cursor-pointer focus:border-emerald-700/45 focus:ring-1 focus:ring-emerald-600/15 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-emerald-600/70";



export default function VacacionesYFestivosPage() {

  const { user, isReady } = useAuth();

  const role = user?.role;

  const isAdminLike = role === USER_ROLE.Admin || role === USER_ROLE.SuperAdmin || role === USER_ROLE.Manager;

  const isWorker = role === USER_ROLE.Worker;



  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());



  const {

    holidaysByDate,

    holidayList,

    loading: holidaysLoading,

    error: holidaysError,

    saving: holidaysSaving,

    setHolidayMark,

    setHolidayMarksBulk,

    clearHolidayMarksBulk,

  } = useCompanyHolidays({

    companyId: user?.companyId ?? null,

    year: calendarYear,

    canMutate: isAdminLike,

  });



  const {

    allowanceList,

    loading: allowancesLoading,

    error: allowancesError,

    saving: allowancesSaving,

    create: createAllowance,

    update: updateAllowance,

    remove: deleteAllowance,

    clearError: clearAllowancesError,

  } = useCompanyVacationAllowances({

    companyId: user?.companyId ?? null,

    canMutate: isAdminLike,

  });



  const [users, setUsers] = useState<User[]>([]);

  const [usersLoading, setUsersLoading] = useState(false);

  const [usersError, setUsersError] = useState<string | null>(null);



  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [rangeFrom, setRangeFrom] = useState<string>("");

  const [rangeTo, setRangeTo] = useState<string>("");



  const viewAllUsers = !isWorker && selectedUserId === VACACIONES_USER_TODOS;



  /** Solo Admin, Manager y SuperAdmin pueden crear o quitar marcas (festivos y vacaciones). */

  const canEditFestivos = isAdminLike;

  const canEditVacaciones =

    isAdminLike &&

    selectedUserId != null &&

    selectedUserId !== VACACIONES_USER_TODOS;



  const {

    vacationsByUserId,

    balance,

    loading: vacationsLoading,

    balanceLoading,

    error: vacationsError,

    saving: vacationsSaving,

    holidayOverlapConfirm,

    clearHolidayOverlapConfirm,

    setVacationMark,

    setVacationMarksBulk,

    clearVacationMarksBulk,

  } = useUserVacations({

    companyId: user?.companyId ?? null,

    year: calendarYear,

    authUserId: user?.id ?? null,

    selectedUserId,

    viewAllUsers,

    isWorker,

    canMutate: isAdminLike,

  });



  useEffect(() => {

    if (!isReady || !user) return;

    if (isAdminLike) setSelectedUserId(VACACIONES_USER_TODOS);

    else setSelectedUserId(user.id);

  }, [isReady, user, isAdminLike]);



  useEffect(() => {

    if (!isReady || !user || !isWorker) return;

    if (selectedUserId !== user.id) setSelectedUserId(user.id);

  }, [isReady, user, isWorker, selectedUserId]);



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



  const calendarUserId = isWorker

    ? user?.id ?? null

    : selectedUserId ?? user?.id ?? null;



  const showVacacionesSaldo = Boolean(

    calendarUserId && calendarUserId !== VACACIONES_USER_TODOS,

  );



  const currentYearAllowance = useMemo(

    () => allowanceList.find((a) => a.year === calendarYear) ?? null,

    [allowanceList, calendarYear],

  );



  const saldoPeriodLabel = currentYearAllowance

    ? `Año natural ${calendarYear} · cupo del servidor`

    : `Año natural ${calendarYear} · sin cupo definido`;



  const vacationsByDate = useMemo(() => {

    const uid = calendarUserId;

    if (!uid) return {};

    if (!isWorker && uid === VACACIONES_USER_TODOS) {

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

  }, [calendarUserId, isWorker, vacationsByUserId]);



  const workerDisplayName = useMemo(() => {

    if (!isWorker || !user?.id) return null;

    const me = users.find((u) => u.id === user.id);

    const name = me?.name?.trim();

    if (name) return name;

    const email = (me?.email ?? user.email ?? "").trim();

    if (!email) return "Tu calendario";

    const at = email.indexOf("@");

    const local = (at > 0 ? email.slice(0, at) : email).replace(/[._-]+/g, " ").trim();

    return local ? local.replace(/\b\w/g, (ch) => ch.toUpperCase()) : email;

  }, [isWorker, user, users]);



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



  const festivosEmpresaCount = useMemo(

    () => Object.keys(holidaysByDate).length,

    [holidaysByDate],

  );



  const festivosEmpresaCountEnRango = useMemo(() => {

    if (!visibleRange) return null;

    return Object.keys(holidaysByDate).filter(

      (d) => d >= visibleRange.from && d <= visibleRange.to,

    ).length;

  }, [holidaysByDate, visibleRange]);



  if (!isReady) {

    return (

      <div className="flex min-h-[40vh] items-center justify-center">

        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />

      </div>

    );

  }



  return (

    <DashboardPageShell width="full" className="min-w-0">

      <DashboardHoyPageHero

        sectionLabel="Vacaciones y festivos"

        title="Calendario laboral"

        description={

          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">

            {isWorker ? (

              <>

                Consulta los <strong className="font-semibold text-slate-700 dark:text-slate-200">festivos de tu

                empresa</strong> y <strong className="font-semibold text-slate-700 dark:text-slate-200">tus

                vacaciones</strong> en el calendario. No puedes ver ni editar el calendario de otros compañeros.

              </>

            ) : (

              <>

                Consulta festivos de empresa y vacaciones por trabajador. Solo administración (Admin, Manager o

                SuperAdmin) puede añadir o quitar marcas.

              </>

            )}

          </p>

        }

        trailing={

          <Link

            href="/dashboard/time-tracking"

            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"

          >

            ← Volver al fichador

          </Link>

        }

      />



      {/* Sin `overflow-hidden` en el panel: si no, `sticky` del aside de filtros no funciona con el scroll de `main`. */}

      <FichajeJornadaMainPanel clipOverflow={false}>

        <div className="p-4 sm:p-6 lg:p-8">

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

                      {isWorker

                        ? "Tu calendario y rango visible (opcional)."

                        : "Usuario y rango visible en el calendario."}

                    </p>

                  </div>



                  <div className="flex flex-col gap-1">

                    {isWorker ? (

                      <>

                        <span className={filterLabelClass}>Tu calendario</span>

                        <p className="rounded-md border border-slate-200/80 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100">

                          {workerDisplayName ?? "Cargando…"}

                        </p>

                        <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">

                          Festivos de la empresa y tus vacaciones.

                        </p>

                      </>

                    ) : (

                      <>

                        <label htmlFor="vacaciones-filtro-usuario" className={filterLabelClass}>

                          Usuario

                        </label>

                        <select

                          id="vacaciones-filtro-usuario"

                          value={selectedUserId ?? ""}

                          onChange={(e) => setSelectedUserId(e.target.value)}

                          disabled={usersLoading || users.length === 0}

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

                      </>

                    )}

                    {usersError ? (

                      <p className="text-[11px] text-rose-700 dark:text-rose-300">{usersError}</p>

                    ) : null}

                    {holidaysError ? (

                      <p className="text-[11px] text-rose-700 dark:text-rose-300">{holidaysError}</p>

                    ) : null}

                    {vacationsError ? (

                      <p className="text-[11px] text-rose-700 dark:text-rose-300">{vacationsError}</p>

                    ) : null}

                    {holidaysSaving ? (

                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Guardando festivos…</p>

                    ) : null}

                    {vacationsSaving ? (

                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Guardando vacaciones…</p>

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

                    <FestivosEmpresaResumen

                      count={festivosEmpresaCount}

                      year={calendarYear}

                      loading={holidaysLoading}

                      countInVisibleRange={festivosEmpresaCountEnRango}

                      holidays={holidayList}

                      visibleRange={visibleRange}

                    />

                  </div>



                  <div className="border-t border-slate-200/80 pt-3 dark:border-slate-700/80">

                    <CupoVacacionesResumen

                      year={calendarYear}

                      allowances={allowanceList}

                      loading={allowancesLoading}

                      saving={allowancesSaving}

                      canMutate={isAdminLike}

                      error={allowancesError}

                      onCreate={createAllowance}

                      onUpdate={updateAllowance}

                      onDelete={deleteAllowance}

                      onClearError={clearAllowancesError}

                    />

                  </div>



                  <div className="border-t border-slate-200/80 pt-3 dark:border-slate-700/80">

                    <VacacionesSaldoResumen

                      showSaldo={showVacacionesSaldo}

                      balance={balance}

                      loading={balanceLoading || vacationsLoading}

                      periodLabel={saldoPeriodLabel}

                    />

                  </div>



                  {visibleRange && canEdit ? (

                    <div className="border-t border-slate-200/80 pt-3 dark:border-slate-700/80">

                      <p className={filterLabelClass}>Rango seleccionado</p>

                      <div className="mt-2 flex flex-col gap-2">

                        <button

                          type="button"

                          disabled={!canEditFestivos || holidaysSaving}

                          onClick={() => {

                            if (!canEditFestivos) return;

                            const days = listIsoDaysInclusive(visibleRange.from, visibleRange.to);

                            void setHolidayMarksBulk(days, { kind: "festivo" }).catch(() => {});

                          }}

                          className="w-full rounded-md border border-amber-400/70 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:bg-amber-900/35"

                        >

                          Marcar rango como festivo

                        </button>

                        <button

                          type="button"

                          disabled={!canEditVacaciones || vacationsSaving}

                          onClick={() => {

                            if (!canEditVacaciones) return;

                            const uid = selectedUserId ?? user?.id ?? null;

                            if (!uid || uid === VACACIONES_USER_TODOS) return;

                            const days = listIsoDaysInclusive(visibleRange.from, visibleRange.to);

                            void setVacationMarksBulk(uid, days, { kind: "vacaciones" }).catch(() => {});

                          }}

                          className="w-full rounded-md border border-sky-400/70 bg-sky-50 px-2 py-1.5 text-[11px] font-semibold text-sky-950 shadow-sm transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-50 dark:hover:bg-sky-900/35"

                        >

                          Marcar rango como vacaciones

                        </button>

                        <button

                          type="button"

                          disabled={!canEdit || holidaysSaving || vacationsSaving}

                          onClick={() => {

                            if (!canEdit) return;

                            const uid = selectedUserId ?? user?.id ?? null;

                            const days = listIsoDaysInclusive(visibleRange.from, visibleRange.to);

                            if (canEditFestivos) void clearHolidayMarksBulk(days).catch(() => {});

                            if (canEditVacaciones && uid && uid !== VACACIONES_USER_TODOS) {

                              void clearVacationMarksBulk(uid, days).catch(() => {});

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

                  canEditHolidays={canEditFestivos && !holidaysSaving}

                  canEditVacations={canEditVacaciones && !vacationsSaving}

                  holidaysByDate={holidaysByDate}

                  vacationsByDate={vacationsByDate}

                  visibleRange={visibleRange}

                  calendarYear={calendarYear}

                  onCalendarYearChange={setCalendarYear}

                  onSetHoliday={(dateISO, mark) => {

                    void setHolidayMark(dateISO, mark).catch(() => {});

                  }}

                  onSetVacation={(dateISO, mark) => {

                    const uid = calendarUserId;

                    if (!uid || uid === VACACIONES_USER_TODOS) return;

                    void setVacationMark(uid, dateISO, mark).catch(() => {});

                  }}

                />

                {holidaysLoading ? (

                  <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">

                    Cargando festivos de empresa…

                  </p>

                ) : null}

                {vacationsLoading ? (

                  <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">

                    Cargando vacaciones…

                  </p>

                ) : null}

              </div>

            </div>

        </div>

      </FichajeJornadaMainPanel>



      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Los <strong className="font-semibold">festivos de empresa</strong> y las{" "}
          <strong className="font-semibold">vacaciones</strong> se guardan en el servidor (vacaciones como
          fichajes con estado Vacation). El trabajador solo consulta sus días; RRHH asigna desde Admin,
          Manager o SuperAdmin.
        </p>

      {holidayOverlapConfirm ? (
        <div

          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"

          role="dialog"

          aria-modal="true"

          aria-labelledby="vacation-holiday-overlap-title"

        >

          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900">

            <h2

              id="vacation-holiday-overlap-title"

              className="text-sm font-semibold text-slate-900 dark:text-white"

            >

              Vacación en día festivo

            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">

              {holidayOverlapConfirm.message}

            </p>

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">

              ¿Quieres asignar la vacación de todos modos?

            </p>

            <div className="mt-4 flex flex-wrap justify-end gap-2">

              <button

                type="button"

                onClick={clearHolidayOverlapConfirm}

                disabled={vacationsSaving}

                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"

              >

                Cancelar

              </button>

              <button

                type="button"

                disabled={vacationsSaving}

                onClick={() => void holidayOverlapConfirm.onConfirm().catch(() => {})}

                className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"

              >

                {vacationsSaving ? "Guardando…" : "Sí, asignar"}

              </button>

            </div>

          </div>

        </div>

      ) : null}

    </DashboardPageShell>

  );

}

