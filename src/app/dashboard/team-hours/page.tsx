"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE } from "@/types";
import { useEquipo } from "@/features/time-tracking/hooks/useEquipo";
import { useEquipoModal } from "@/features/time-tracking/hooks/useEquipoModal";
import { useEquipoPart } from "@/features/time-tracking/hooks/useEquipoPart";
import { workerNameById } from "@/mocks/time-tracking.mock";
import {
  formatDateES,
  formatFechaModificacionUtc,
  formatMinutesShort,
  formatTiempoAnterior,
  formatTimeLocal,
  workDateIsWeekend,
} from "@/shared/utils/time";
import {
  buildEquipoTableCsvFilas,
  effectiveWorkMinutesEntry,
  formatLastModifiedByUser,
  formatRazon,
  isSinJornadaImputableRazon,
  RAZON_NO_LABORAL,
  RAZON_SIN_IMPUTAR,
  workReportParteApiSummary,
} from "@/features/time-tracking/utils/formatters";
import { getWorkPartsForWorker } from "@/lib/workPartsStorage";
import type { EquipoSortKey } from "@/features/time-tracking/types";
import { EquipoObjetivoMesEncabezado } from "@/features/time-tracking/components/EquipoObjetivoMesEncabezado";
import { EquipoBarraLaboralesExtra } from "@/features/time-tracking/components/EquipoBarraLaboralesExtra";
import { HorasMensualesDonut } from "@/features/time-tracking/components/charts/HorasMensualesDonut";
import { FichajeTipoDonut } from "@/features/time-tracking/components/charts/FichajeTipoDonut";

const EquipoPartModal = dynamic(
  () => import("@/features/time-tracking/components/EquipoPartModal").then((m) => m.EquipoPartModal),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Sort arrow indicator
// ---------------------------------------------------------------------------
function SortArrow({
  sortKey,
  activeKey,
  dir,
}: {
  sortKey: EquipoSortKey;
  activeKey: EquipoSortKey | null;
  dir: "asc" | "desc" | null;
}) {
  if (activeKey !== sortKey) return null;
  return (
    <span className="shrink-0 text-agro-600 dark:text-agro-400" aria-hidden>
      {dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function TeamHoursPage() {
  const { user, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace("/login");
    if (user?.role === USER_ROLE.Worker) router.replace("/dashboard/tasks");
  }, [user, isReady, router]);

  const eq = useEquipo({
    enableEquipoCompanyFilter:
      user?.role === USER_ROLE.SuperAdmin ||
      user?.role === USER_ROLE.Manager ||
      user?.role === USER_ROLE.Admin,
  });

  const modal = useEquipoModal({
    user,
    setTeamHistorialEntries: eq.setTeamHistorialEntries,
    equipoTablaScrollRef: eq.equipoTablaScrollRef,
    equipoRestaurarScroll: eq.equipoRestaurarScroll,
    equipoMarcarRestaurarScroll: eq.equipoMarcarRestaurarScroll,
  });

  const part = useEquipoPart({
    setEquipoPartsVersion: eq.setEquipoPartsVersion,
  });

  if (!isReady || !user) return null;

  return (
    <div className="min-w-0 max-w-full space-y-5">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-agro-600 dark:text-agro-400">
          Historial del equipo
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
          Horas imputadas por trabajadores
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <strong>Mes en curso:</strong> solo días del 1 al <strong>hoy</strong>. Meses anteriores:
          mes completo. Todos los días (lun–dom): fin de semana = no laboral.{" "}
          <span className="font-semibold text-red-700 dark:text-red-400">
            Laborable sin fichaje = rojo
          </span>
          . Dona izquierda: objetivo vs imputado. Dona derecha: incluye días laborables sin imputar
          (rojo). Sin datos de demo locales: histórico y lista de personas vendrán del API.
        </p>
      </div>

      {/* ── Contenido principal: filtros + estadísticas + gráficos ── */}
      <div className="flex min-w-0 max-w-full flex-col gap-6 lg:flex-row lg:items-stretch">
        {/* Columna izquierda: filtros + total */}
        <div className="mx-auto flex w-full max-w-[320px] shrink-0 flex-col justify-between gap-4 lg:mx-0 lg:max-w-[280px]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-600 dark:bg-slate-800/50">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Filtros
            </p>
            <div className="flex flex-col gap-3">
              {/* Periodo */}
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor="periodo-team-hours"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Periodo
                </label>
                <select
                  id="periodo-team-hours"
                  value={eq.equipoPeriodo}
                  onChange={(e) =>
                    eq.setEquipoPeriodo(
                      e.target.value as "dia" | "semana" | "mes" | "trimestre" | "anio",
                    )
                  }
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="dia">Día</option>
                  <option value="semana">Semana</option>
                  <option value="mes">Mes</option>
                  <option value="trimestre">Trimestre</option>
                  <option value="anio">Año</option>
                </select>
              </div>

              {/* Sub-filtro según periodo */}
              {eq.equipoPeriodo === "dia" && (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    htmlFor="dia-team-hours"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Día
                  </label>
                  <input
                    id="dia-team-hours"
                    type="date"
                    value={eq.equipoDia}
                    onChange={(e) => eq.setEquipoDia(e.target.value)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              {eq.equipoPeriodo === "semana" && (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    htmlFor="semana-team-hours"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Semana que contiene el día
                  </label>
                  <input
                    id="semana-team-hours"
                    type="date"
                    value={eq.equipoSemana}
                    onChange={(e) => eq.setEquipoSemana(e.target.value)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              {eq.equipoPeriodo === "mes" && (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    htmlFor="mes-team-hours"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Mes
                  </label>
                  <select
                    id="mes-team-hours"
                    value={eq.mesEquipo}
                    onChange={(e) => eq.setMesEquipo(e.target.value)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {eq.opcionesMesEquipo.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {eq.equipoPeriodo === "trimestre" && (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    htmlFor="trimestre-team-hours"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Trimestre
                  </label>
                  <select
                    id="trimestre-team-hours"
                    value={eq.trimestreEquipo}
                    onChange={(e) => eq.setTrimestreEquipo(e.target.value)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {eq.opcionesTrimestre.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {eq.equipoPeriodo === "anio" && (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    htmlFor="anio-team-hours"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Año
                  </label>
                  <select
                    id="anio-team-hours"
                    value={eq.anioEquipo}
                    onChange={(e) => eq.setAnioEquipo(e.target.value)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {eq.opcionesAnio.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div
                className={`grid grid-cols-1 gap-3 sm:items-end ${
                  user.role === USER_ROLE.SuperAdmin ||
                  user.role === USER_ROLE.Manager ||
                  user.role === USER_ROLE.Admin
                    ? "sm:grid-cols-2 xl:grid-cols-3"
                    : "sm:grid-cols-2"
                }`}
              >
                {user.role === USER_ROLE.SuperAdmin ||
                user.role === USER_ROLE.Manager ||
                user.role === USER_ROLE.Admin ? (
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <label
                      htmlFor="empresa-team-hours-filtro"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Empresas
                    </label>
                    <select
                      id="empresa-team-hours-filtro"
                      value={eq.equipoSuperAdminCompanyId ?? ""}
                      onChange={(e) =>
                        eq.setEquipoSuperAdminCompanyId(
                          e.target.value.trim() ? e.target.value : null,
                        )
                      }
                      disabled={eq.equipoCompaniesLoading}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="">Todas las empresas</option>
                      {eq.equipoCompaniesCatalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {eq.equipoCompaniesError ? (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">
                        {eq.equipoCompaniesError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    htmlFor="persona-team-hours"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Persona
                  </label>
                  <select
                    id="persona-team-hours"
                    value={eq.filtroPersonaEquipo === "todas" ? "" : String(eq.filtroPersonaEquipo)}
                    onChange={(e) => {
                      const v = e.target.value;
                      eq.setFiltroPersonaEquipo(v === "" ? "todas" : v);
                    }}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">Todas las personas</option>
                    {eq.equipoWorkersOpciones.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                {user.role === USER_ROLE.SuperAdmin ||
                user.role === USER_ROLE.Manager ||
                user.role === USER_ROLE.Admin ? (
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <label
                      htmlFor="servicio-team-hours-filtro"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Servicio
                    </label>
                    <select
                      id="servicio-team-hours-filtro"
                      value={eq.equipoServiceId ?? ""}
                      onChange={(e) =>
                        eq.setEquipoServiceId(e.target.value.trim() ? e.target.value : null)
                      }
                      disabled={eq.equipoServicesLoading}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="">Todos los servicios</option>
                      {eq.equipoServicesCatalog.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {eq.equipoServicesError ? (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">
                        {eq.equipoServicesError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/40">
                  <input
                    id="filtro-solo-sin-imputar-team-hours"
                    type="checkbox"
                    checked={eq.equipoTablaFiltroExtra === "soloSinImputar"}
                    onChange={(e) => eq.setEquipoSoloSinImputar(e.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-agro-600 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-800"
                  />
                  <label
                    htmlFor="filtro-solo-sin-imputar-team-hours"
                    className="cursor-pointer text-xs font-medium leading-snug text-slate-700 dark:text-slate-300"
                  >
                    Mostrar solo días laborables sin fichaje
                  </label>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/40">
                  <input
                    id="filtro-solo-sin-parte-servidor-team-hours"
                    type="checkbox"
                    checked={eq.equipoTablaFiltroExtra === "soloSinParteServidor"}
                    onChange={(e) => eq.setEquipoSoloSinParteServidor(e.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-agro-600 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-800"
                  />
                  <label
                    htmlFor="filtro-solo-sin-parte-servidor-team-hours"
                    className="cursor-pointer text-xs font-medium leading-snug text-slate-700 dark:text-slate-300"
                  >
                    Mostrar solo fichados y sin parte
                  </label>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/40">
                  <input
                    id="filtro-solo-con-parte-servidor-team-hours"
                    type="checkbox"
                    checked={eq.equipoTablaFiltroExtra === "soloConParteServidor"}
                    onChange={(e) => eq.setEquipoSoloConParteServidor(e.target.checked)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-agro-600 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-800"
                  />
                  <label
                    htmlFor="filtro-solo-con-parte-servidor-team-hours"
                    className="cursor-pointer text-xs font-medium leading-snug text-slate-700 dark:text-slate-300"
                  >
                    Mostrar solo fichados y con parte
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-agro-300/80 bg-gradient-to-br from-agro-50 via-white to-emerald-50 p-4 shadow-sm dark:border-agro-800 dark:from-agro-950/40 dark:via-slate-900 dark:to-emerald-950/30">
            <p className="text-[11px] font-bold uppercase tracking-wider text-agro-700 dark:text-agro-400">
              Total horas imputadas
            </p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-agro-800 dark:text-agro-200 sm:text-3xl">
              {formatMinutesShort(eq.totalMinutosImputadosMes)}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {eq.totalHorasDecimalMes.toLocaleString("es-ES", {
                  minimumFractionDigits: eq.totalHorasDecimalMes % 1 ? 1 : 0,
                  maximumFractionDigits: 1,
                })}{" "}
                h
              </span>
              <span className="text-slate-500 dark:text-slate-500"> en decimal</span>
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {eq.equipoRowsFiltradas.length}{" "}
              {eq.equipoRowsFiltradas.length === 1 ? "registro" : "registros"} en el mes
              {eq.filtroPersonaEquipo !== "todas" && (
                <>
                  {" · "}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {eq.equipoWorkersOpciones.find((w) => w.id === eq.filtroPersonaEquipo)?.name ??
                      eq.filtroPersonaEquipo}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Columna derecha: objetivo + barra + gráficos */}
        <div className="flex min-w-0 max-w-full flex-1 flex-col gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/80 to-emerald-50/30 p-4 shadow-sm dark:border-slate-600 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-emerald-950/20 sm:p-5">
          <div className="min-w-0 border-b border-slate-200/80 pb-4 dark:border-slate-600">
            <EquipoObjetivoMesEncabezado
              diasLaborables={eq.diasLaborablesMesEquipo}
              personasEnObjetivo={eq.personasEnObjetivo}
              horasObjetivo={eq.horasObjetivoMesTeorico}
              filtroTodasPersonas={eq.filtroPersonaEquipo === "todas"}
            />
            <EquipoBarraLaboralesExtra
              horasObjetivo={eq.horasObjetivoMesTeorico}
              horasImputadasLabor={eq.hDonutImputado}
              horasFalta={eq.horasFaltaParaObjetivo}
              horasExtra={eq.hDonutExtra}
              horasImputadasTotal={eq.horasImputadasDecimal}
            />
          </div>

          <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
            <div className="min-h-0 w-full min-w-0 max-w-full md:h-full">
              <HorasMensualesDonut
                horasImputadoHastaTope={eq.hDonutImputado}
                horasFalta={eq.hDonutFalta}
                horasExtra={eq.hDonutExtra}
                horasObjetivo={eq.horasObjetivoMesTeorico}
                horasImputadasTotal={eq.horasImputadasDecimal}
                registrosEnPeriodo={eq.equipoRowsFiltradas.length}
              />
            </div>
            <div className="min-h-0 w-full min-w-0 max-w-full md:h-full">
              <FichajeTipoDonut
                horasNormal={eq.fichajeTipoStats.horasNormal}
                horasManual={eq.fichajeTipoStats.horasManual}
                horasSinImputar={eq.horasSinImputarTipoFichaje}
                registrosNormal={eq.fichajeTipoStats.registrosNormal}
                registrosManual={eq.fichajeTipoStats.registrosManual}
                diasSinImputar={eq.diasSinImputarEquipo}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabla de registros ─────────────────────────────────── */}
      {eq.diasCalendarioMesEquipo.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No hay días que mostrar: el mes es futuro o el filtro no es válido. El mes actual solo
          lista hasta hoy.
        </p>
      ) : (
        <div className="space-y-3">
          {eq.equipoRowsLoading ? (
            <p className="text-xs font-medium text-agro-700 dark:text-agro-300">
              Cargando fichajes del periodo…
            </p>
          ) : null}
          {eq.equipoRowsError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              {eq.equipoRowsError}
            </p>
          ) : null}
          {!eq.equipoRowsLoading && !eq.equipoRowsError ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {eq.equipoRowsTotalCount}{" "}
              {eq.equipoRowsTotalCount === 1
                ? "fichaje devuelto por el API"
                : "fichajes devueltos por el API"}{" "}
              en el periodo (el grid completa días sin registro en cliente).
            </p>
          ) : null}
          {/* Controles: info de orden + CSV */}
          <div className="flex flex-col items-end gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            <p className="order-2 max-w-md text-right text-[10px] leading-snug text-slate-500 dark:text-slate-400 sm:order-1 sm:mr-auto sm:text-left">
              Ordenar columna:{" "}
              <strong className="font-semibold text-slate-600 dark:text-slate-300">1.º</strong>{" "}
              descendente ·{" "}
              <strong className="font-semibold text-slate-600 dark:text-slate-300">2.º</strong>{" "}
              ascendente ·{" "}
              <strong className="font-semibold text-slate-600 dark:text-slate-300">3.º</strong> orden
              por defecto (fecha ↓)
            </p>
            <button
              type="button"
              onClick={() => {
                const csv = buildEquipoTableCsvFilas(
                  eq.equipoFilasVista,
                  eq.equipoNombrePorClave
                );
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const periodoLabel =
                  eq.equipoPeriodo === "dia"
                    ? `dia-${eq.equipoDia}`
                    : eq.equipoPeriodo === "semana"
                      ? `semana-${eq.equipoSemana}`
                      : eq.equipoPeriodo === "mes"
                        ? `mes-${eq.mesEquipo}`
                        : eq.equipoPeriodo === "trimestre"
                          ? `tri-${eq.trimestreEquipo}`
                          : `anio-${eq.anioEquipo}`;
                a.download = `horas-equipo-${periodoLabel}-${
                  eq.filtroPersonaEquipo === "todas" ? "todas" : `persona-${eq.filtroPersonaEquipo}`
                }${
                  eq.equipoTablaFiltroExtra === "soloSinImputar"
                    ? "-solo-sin-fichar"
                    : eq.equipoTablaFiltroExtra === "soloSinParteServidor"
                      ? "-sin-parte-servidor"
                      : eq.equipoTablaFiltroExtra === "soloConParteServidor"
                        ? "-con-parte-servidor"
                        : ""
                }.csv`;
                a.rel = "noopener";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="order-1 inline-flex items-center gap-1.5 rounded-xl border border-agro-600 bg-agro-50 px-3 py-2 text-xs font-semibold text-agro-800 shadow-sm transition hover:bg-agro-100 dark:border-agro-500 dark:bg-agro-950/40 dark:text-agro-100 dark:hover:bg-agro-900/50 sm:order-2 sm:text-sm"
            >
              <span aria-hidden>⬇</span>
              Exportar CSV (vista actual)
            </button>
          </div>

          {/* Tabla scroll */}
          <div
            ref={eq.equipoTablaScrollRef}
            className="isolate max-h-[min(70vh,520px)] w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-700 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y]"
            style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
          >
            <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-[5] bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm dark:bg-slate-700 dark:text-slate-300">
                <tr>
                  {(
                    [
                      { key: "persona", label: "Persona" },
                      { key: "fecha", label: "Fecha" },
                      { key: "entrada", label: "Entrada" },
                      { key: "salida", label: "Salida" },
                    ] as const
                  ).map(({ key, label }) => (
                    <th key={key} className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => eq.setEquipoSortColumn(key)}
                        className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        {label}
                        <SortArrow sortKey={key} activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 whitespace-normal leading-tight">
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("entradaAntes")}
                      className="flex w-full flex-col items-start gap-0 text-left hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      <span className="flex items-center gap-0.5">
                        Entrada
                        <SortArrow sortKey="entradaAntes" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                      </span>
                      <span className="font-normal normal-case text-[10px] text-slate-400">(antes)</span>
                    </button>
                  </th>
                  <th className="px-3 py-2.5 whitespace-normal leading-tight">
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("salidaAntes")}
                      className="flex w-full flex-col items-start gap-0 text-left hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      <span className="flex items-center gap-0.5">
                        Salida
                        <SortArrow sortKey="salidaAntes" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                      </span>
                      <span className="font-normal normal-case text-[10px] text-slate-400">(antes)</span>
                    </button>
                  </th>
                  <th className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("descanso")}
                      className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      Descanso
                      <SortArrow sortKey="descanso" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                    </button>
                  </th>
                  <th className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("razon")}
                      className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      Razón
                      <SortArrow sortKey="razon" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                    </button>
                  </th>
                  <th className="min-w-[9rem] max-w-[14rem] px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("modificado")}
                      className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      Modificado por
                      <SortArrow sortKey="modificado" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                    </button>
                  </th>
                  <th className="min-w-[7.5rem] whitespace-normal px-3 py-2.5 leading-tight">
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("fechaMod")}
                      className="flex w-full flex-col items-start gap-0 text-left hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      <span className="flex items-center gap-0.5">
                        Fecha
                        <SortArrow sortKey="fechaMod" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                      </span>
                      <span className="font-normal normal-case text-[10px] text-slate-400">modificación</span>
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("duracion")}
                      className="ml-auto flex w-full items-center justify-end gap-0.5 hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      Duración
                      <SortArrow sortKey="duracion" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                    </button>
                  </th>
                  <th
                    className="px-3 py-2.5"
                    title="Según el API (workReportId, workReportStatus, workReportLineCount)"
                  >
                    Parte en servidor
                  </th>
                  <th className="sticky right-0 z-[5] bg-slate-50 px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:bg-slate-700 dark:text-slate-300">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {eq.equipoFilasVista.length === 0 ? (
                  <tr>
                    <td
                      colSpan={13}
                      className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      {eq.equipoTablaFiltroExtra === "soloSinImputar"
                        ? "No hay días laborables sin fichaje en el periodo y filtros actuales."
                        : eq.equipoTablaFiltroExtra === "soloSinParteServidor"
                          ? "No hay fichados sin parte en el periodo y filtros actuales."
                          : eq.equipoTablaFiltroExtra === "soloConParteServidor"
                            ? "No hay fichados con parte en el periodo y filtros actuales."
                            : "No hay filas que mostrar."}
                    </td>
                  </tr>
                ) : (
                  eq.equipoFilasVista.map((fila) => {
                  /* ── Fin de semana (no laboral) ── */
                  if (fila.kind === "noLaboral") {
                    return (
                      <tr
                        key={`nl-${fila.userId}-${fila.workDate}`}
                        className="border-t border-slate-200 bg-slate-100/95 text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300"
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {eq.resolveEquipoPersonaNombre(fila)}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                          {formatDateES(fila.workDate)}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="max-w-[11rem] px-3 py-2 text-xs italic text-sky-700 dark:text-sky-400">
                          {RAZON_NO_LABORAL}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="sticky right-0 z-[1] border-l border-slate-200/80 bg-slate-100 px-1 py-1 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-slate-600 dark:bg-slate-800/55">
                          <button
                            type="button"
                            onClick={() =>
                              modal.openEquipoEditModal({
                                workerId: fila.workerId,
                                workDate: fila.workDate,
                                existing: null,
                                isWeekendFila: true,
                                personaLabel: eq.resolveEquipoPersonaNombre(fila),
                              })
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  /* ── Día laboral sin imputar ── */
                  if (fila.kind === "sinImputar") {
                    return (
                      <tr
                        key={`si-${fila.userId}-${fila.workDate}`}
                        className="border-t border-rose-200 bg-rose-50/95 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50"
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-rose-900 dark:text-rose-100">
                          {eq.resolveEquipoPersonaNombre(fila)}
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-rose-900 dark:text-rose-100">
                          {formatDateES(fila.workDate)}
                        </td>
                        <td className="px-3 py-2 text-xs text-rose-800/90 dark:text-rose-200/90">—</td>
                        <td className="px-3 py-2 text-xs text-rose-800/90 dark:text-rose-200/90">—</td>
                        <td className="px-3 py-2 text-xs text-rose-800/90 dark:text-rose-200/90">—</td>
                        <td className="px-3 py-2 text-xs text-rose-800/90 dark:text-rose-200/90">—</td>
                        <td className="px-3 py-2 text-xs text-rose-800/90 dark:text-rose-200/90">—</td>
                        <td className="max-w-[11rem] px-3 py-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
                          {RAZON_SIN_IMPUTAR}
                        </td>
                        <td className="px-3 py-2 text-xs text-rose-800/90 dark:text-rose-200/90">—</td>
                        <td className="px-3 py-2 text-xs text-rose-800/90 dark:text-rose-200/90">—</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-rose-800 dark:text-rose-200">—</td>
                        <td className="px-3 py-2 text-xs text-rose-800/90 dark:text-rose-200/90">—</td>
                        <td className="sticky right-0 z-[1] border-l border-rose-200/80 bg-rose-50 px-1 py-1 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-rose-800 dark:bg-rose-950/45">
                          <button
                            type="button"
                            onClick={() =>
                              modal.openEquipoEditModal({
                                workerId: fila.workerId,
                                workDate: fila.workDate,
                                existing: null,
                                isWeekendFila: false,
                                personaLabel: eq.resolveEquipoPersonaNombre(fila),
                              })
                            }
                            className="rounded-lg border border-rose-400 bg-white px-2 py-1 text-[10px] font-semibold text-rose-900 hover:bg-rose-100 dark:border-rose-600 dark:bg-rose-900/50 dark:text-rose-100 dark:hover:bg-rose-900/80"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  /* ── Registro normal ── */
                  const e = fila.e;
                  const sinJornada = isSinJornadaImputableRazon(e.razon);
                  const apiParte = workReportParteApiSummary(e);
                  const hasPart =
                    !sinJornada &&
                    getWorkPartsForWorker(e.workerId).some((p) => p.workDate === e.workDate);
                  const rowVac =
                    e.razon === "ausencia_vacaciones"
                      ? "border-t border-sky-200 bg-sky-50/95 text-sky-950 dark:border-sky-800 dark:bg-sky-950/45 dark:text-sky-50"
                      : e.razon === "ausencia_baja"
                        ? "border-t border-violet-200 bg-violet-50/95 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-50"
                        : e.razon === "dia_no_laboral"
                          ? "border-t border-stone-200 bg-stone-50/95 text-stone-950 dark:border-stone-600 dark:bg-stone-900/35 dark:text-stone-100"
                          : "border-t border-slate-100 bg-white/80 dark:border-slate-700 dark:bg-slate-800/80";
                  const stickyBg =
                    e.razon === "ausencia_vacaciones"
                      ? "bg-sky-50/98 dark:bg-sky-950/50"
                      : e.razon === "ausencia_baja"
                        ? "bg-violet-50/98 dark:bg-violet-950/45"
                        : e.razon === "dia_no_laboral"
                          ? "bg-stone-50/98 dark:bg-stone-900/45"
                          : "bg-white/95 dark:bg-slate-800/95";

                  return (
                    <tr key={`${e.id}-${e.workerId}-${e.workDate}`} className={rowVac}>
                      <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {eq.resolveEquipoPersonaNombre(fila)}
                      </td>
                      <td className="px-3 py-2 text-xs">{formatDateES(e.workDate)}</td>
                      <td className="px-3 py-2 text-xs">
                        {sinJornada ? "—" : formatTimeLocal(e.checkInUtc)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {sinJornada ? "—" : formatTimeLocal(e.checkOutUtc)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                        {formatTiempoAnterior(e.previousCheckInUtc)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                        {formatTiempoAnterior(e.previousCheckOutUtc)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {sinJornada ? "—" : formatMinutesShort(e.breakMinutes ?? 0)}
                      </td>
                      <td className="max-w-[10rem] px-3 py-2 text-xs leading-snug">
                        <span
                          className={
                            e.razon === "imputacion_manual_error"
                              ? "rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
                              : e.razon === "ausencia_vacaciones"
                                ? "rounded-md bg-sky-200/80 px-1.5 py-0.5 font-semibold text-sky-950 dark:bg-sky-800/60 dark:text-sky-100"
                                : e.razon === "ausencia_baja"
                                  ? "rounded-md bg-violet-200/80 px-1.5 py-0.5 font-semibold text-violet-950 dark:bg-violet-300/30 dark:text-violet-100"
                                  : e.razon === "dia_no_laboral"
                                    ? "rounded-md bg-stone-200/80 px-1.5 py-0.5 font-semibold text-stone-900 dark:bg-stone-600/50 dark:text-stone-100"
                                    : "text-slate-700 dark:text-slate-200"
                          }
                        >
                          {formatRazon(e.razon)}
                          {e.edicionNotaAdmin ? (
                            <span className="mt-0.5 block font-normal text-[10px] opacity-90">
                              {e.edicionNotaAdmin}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td
                        className="max-w-[14rem] px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
                        title={formatLastModifiedByUser(e)}
                      >
                        <span className="line-clamp-2 break-all">
                          {formatLastModifiedByUser(e)}
                        </span>
                      </td>
                      <td
                        className="whitespace-nowrap px-3 py-2 text-xs text-slate-600 dark:text-slate-300"
                        title={e.updatedAtUtc ?? ""}
                      >
                        {formatFechaModificacionUtc(e.updatedAtUtc)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-semibold">
                        {sinJornada ? "—" : formatMinutesShort(effectiveWorkMinutesEntry(e))}
                      </td>
                      <td className="max-w-[9rem] px-3 py-2 text-xs leading-tight">
                        {sinJornada ? (
                          "—"
                        ) : (
                          <div className="leading-tight">
                            <span
                              className={
                                apiParte.tieneParte
                                  ? "font-semibold text-teal-800 dark:text-teal-200"
                                  : "text-slate-400 dark:text-slate-500"
                              }
                            >
                              {apiParte.tieneParte ? "Sí" : "No"}
                            </span>
                            {apiParte.tieneParte && apiParte.detalle ? (
                              <span className="mt-0.5 block text-[10px] font-normal text-slate-500 dark:text-slate-400">
                                {apiParte.detalle}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td
                        className={`sticky right-0 z-[1] px-1 py-1 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] ${stickyBg}`}
                      >
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              modal.openEquipoEditModal({
                                workerId: e.workerId,
                                workDate: e.workDate,
                                existing: e,
                                isWeekendFila: workDateIsWeekend(e.workDate),
                                personaLabel: eq.resolveEquipoPersonaNombre(fila),
                              })
                            }
                            className="rounded-lg border border-agro-500/60 bg-agro-50 px-2 py-1 text-[10px] font-semibold text-agro-800 hover:bg-agro-100 dark:border-agro-600 dark:bg-agro-950/50 dark:text-agro-100 dark:hover:bg-agro-900/60"
                          >
                            Editar hora
                          </button>
                          <button
                            type="button"
                            disabled={sinJornada || !e.checkOutUtc}
                            onClick={() => part.openEquipoPartEditor(e)}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            {hasPart ? "Editar parte" : "Añadir parte"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: editar día del equipo ───────────────────────── */}
      {modal.equipoModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="equipo-edit-title"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) modal.cerrarEquipoModal();
          }}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") modal.cerrarEquipoModal();
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2
              id="equipo-edit-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-50"
            >
              Editar día
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {modal.equipoModal.personaLabel?.trim() ||
                  workerNameById(modal.equipoModal.workerId)}
              </span>
              {" · "}
              {formatDateES(modal.equipoModal.workDate)}
              {modal.equipoModal.isWeekendFila ? (
                <span className="ml-1 text-xs text-slate-500">(fin de semana)</span>
              ) : null}
            </p>

            {modal.equipoModalVista === "menu" ? (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Ausencias
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => modal.guardarEquipoVacacionesOBaja("vacaciones")}
                      className="flex-1 rounded-xl border-2 border-sky-400 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900 shadow-sm transition hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-900/40"
                    >
                      Añadir vacaciones
                    </button>
                    <button
                      type="button"
                      onClick={() => modal.guardarEquipoVacacionesOBaja("baja")}
                      className="flex-1 rounded-xl border-2 border-violet-400 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-100 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/35"
                    >
                      Añadir baja / ausencia
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => modal.guardarEquipoVacacionesOBaja("dia_no_laboral")}
                    className="mt-2 w-full rounded-xl border-2 border-stone-400 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 shadow-sm transition hover:bg-stone-100 dark:border-stone-500 dark:bg-stone-900/40 dark:text-stone-100 dark:hover:bg-stone-800/50"
                  >
                    Marcar día no laboral
                  </button>
                  <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                    Vacaciones, baja o día no laboral: si ya había horario imputado, se guardará en{" "}
                    <strong>Entrada/Salida (antes)</strong>. La fila quedará marcada y se registrará quién
                    modificó.
                  </p>
                </div>
                <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Jornada laboral
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      modal.setEquipoModalVista("horario");
                      modal.setEquipoFormError(null);
                    }}
                    className="w-full rounded-xl border-2 border-agro-500 bg-agro-50 px-4 py-3 text-sm font-semibold text-agro-900 shadow-sm transition hover:bg-agro-100 dark:border-agro-600 dark:bg-agro-950/40 dark:text-agro-100 dark:hover:bg-agro-900/50"
                  >
                    Modificar horario (imputación manual)
                  </button>
                  <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                    Nuevas entrada y salida; la razón mostrará <strong>imputación manual (RRHH)</strong>,
                    con fechas anteriores en las columnas correspondientes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={modal.cerrarEquipoModal}
                  className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    modal.setEquipoModalVista("menu");
                    modal.setEquipoFormError(null);
                  }}
                  className="text-sm font-medium text-agro-600 hover:underline dark:text-agro-400"
                >
                  ← Volver
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Entrada
                    </label>
                    <input
                      type="time"
                      value={modal.equipoFormIn}
                      onChange={(ev) => modal.setEquipoFormIn(ev.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Salida
                    </label>
                    <input
                      type="time"
                      value={modal.equipoFormOut}
                      onChange={(ev) => modal.setEquipoFormOut(ev.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Descanso (minutos)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={600}
                    value={modal.equipoFormBreak}
                    onChange={(ev) => modal.setEquipoFormBreak(Number(ev.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Motivo / nota (opcional)
                  </label>
                  <textarea
                    value={modal.equipoFormNota}
                    onChange={(ev) => modal.setEquipoFormNota(ev.target.value)}
                    rows={2}
                    placeholder="Ej. Corrección acordada con el trabajador"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                {modal.equipoFormError ? (
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {modal.equipoFormError}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={modal.guardarEquipoHorarioManual}
                    className="flex-1 rounded-xl bg-agro-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-agro-700"
                  >
                    Guardar horario
                  </button>
                  <button
                    type="button"
                    onClick={modal.cerrarEquipoModal}
                    className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: editar parte de trabajo ─────────────────────── */}
      {part.equipoPartModal && (
        <EquipoPartModal
          modal={part.equipoPartModal}
          companies={part.equipoPartCompanies}
          services={part.equipoPartServices}
          lines={part.equipoPartLines}
          loading={part.equipoPartLoading}
          saving={part.equipoPartSaving}
          error={part.equipoPartError}
          signatureDialogOpen={part.equipoPartSignatureDialogOpen}
          signatureTemp={part.equipoPartSignatureTemp}
          pdfLoading={part.equipoPartPdfLoading}
          onClose={part.closeEquipoPartEditor}
          onAddLine={part.addEquipoPartLine}
          onPatchLine={part.patchEquipoPartLine}
          onRemoveLine={part.removeEquipoPartLine}
          onSave={part.saveEquipoPart}
          onSetSignatureDialogOpen={part.setEquipoPartSignatureDialogOpen}
          onSetSignatureTemp={part.setEquipoPartSignatureTemp}
          onSetError={part.setEquipoPartError}
          onGeneratePdf={part.handleGenerateEquipoPartPdf}
        />
      )}
    </div>
  );
}
