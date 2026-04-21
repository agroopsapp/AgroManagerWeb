"use client";

import React from "react";
import { MODAL_BACKDROP_CENTER, modalScrollablePanel } from "@/components/modalShell";
import { EquipoBarraLaboralesExtra } from "./EquipoBarraLaboralesExtra";
import { EquipoObjetivoMesEncabezado } from "./EquipoObjetivoMesEncabezado";
import { FichajeTipoRadialSummary } from "./charts/FichajeTipoRadialSummary";
import { HorasMensualesDonut } from "./charts/HorasMensualesDonut";
import { PartesEnDiasDonut } from "./charts/PartesEnDiasDonut";
import { EquipoTablaAccionesDuo, EquipoTablaBotonPrimeraJornada } from "./EquipoTablaAccionesIconos";
import { TimeEntryStatusBadge } from "./TimeEntryStatusBadge";
import type {
  EquipoSortKey,
  EquipoTablaFila,
  EquipoTablaFiltroExtra,
  ForgotMode,
  ForgotStep,
  TimeEntryMock,
} from "@/features/time-tracking/types";
import {
  effectiveExtraMinutesEntry,
  effectiveWorkMinutesEntry,
  equipoAbsenceEtiquetaKind,
  equipoRegistroOcultaHorasEnTabla,
  formatLastModifiedByUser,
  formatRazonTablaEquipo,
  isAbsenceCalendarApiStatus,
  RAZON_NO_LABORAL,
  RAZON_SIN_IMPUTAR,
  timeEntryConParteEnServidor,
  workReportParteApiSummary,
} from "@/features/time-tracking/utils/formatters";
import {
  equipoTablaEtiquetaBaseClass,
  equipoTablaEtiquetaAusencia,
  equipoTablaSinImputarBadgeClass,
  equipoTablaZebraRowClass,
  equipoTablaZebraStripeBg,
} from "@/features/time-tracking/utils/equipoTableAppearance";
import { timeEntryApiStatusBadgeClass } from "@/features/time-tracking/utils/timeEntryApiStatus";
import { downloadEquipoTablePdf } from "@/features/time-tracking/utils/equipoTablePdf";
import { workerNameById } from "@/mocks/time-tracking.mock";
import { useWheelScrollChain } from "@/features/time-tracking/hooks/useWheelScrollChain";
import {
  formatDateES,
  formatDateEsWeekdayDdMmYyyy,
  formatFechaModificacionUtc,
  formatMinutesShort,
  formatTiempoAnterior,
  formatTimeLocal,
  localTodayISO,
  workDateIsWeekend,
} from "@/shared/utils/time";
import { ForgotModal } from "./ForgotModal";
import { EquipoRegistrosFiltrosEtiquetas } from "./EquipoRegistrosFiltrosEtiquetas";

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

type Period = "dia" | "semana" | "mes" | "trimestre" | "anio";
type FilterOption = { value: string; label: string };
type CalendarDay = { workDate: string; isWeekend: boolean };

type FichajeTipoStats = {
  horasNormal: number;
  horasManual: number;
  registrosNormal: number;
  registrosManual: number;
};
type PartesEquipoStats = { diasImputados: number; diasConParte: number };

type EquipoEditModalState = {
  workerId: number;
  workDate: string;
  existing: TimeEntryMock | null;
  isWeekendFila: boolean;
  personaLabel?: string | null;
  targetUserId: string | null;
} | null;

interface TeamPanelProps {
  // ── Filters ────────────────────────────────────────────────────────────
  periodo: Period;
  dia: string;
  mes: string;
  trimestre: string;
  anio: string;
  persona: string | "todas";
  /** Usuarios del desplegable «Persona» (GET /api/Users → id = userId GUID). */
  workersOpciones: { id: string; name: string }[];
  /** Nombres en tabla / modal / ordenación. */
  resolvePersonaNombre: (fila: EquipoTablaFila) => string;
  /** Para exportación PDF: mismas claves que en fichajes (`userId` o `legacy:{id}`). */
  equipoNombrePorClave: Map<string, string>;
  /** Estado de GET /api/TimeEntries/rows. */
  rowsApi: {
    loading: boolean;
    error: string | null;
    totalCount: number;
  };
  /** SuperAdmin / Manager / Admin: combo empresas y filtro por `companyId`. */
  equipoCompanyFilter?: {
    companyId: string | null;
    onCompanyIdChange: (id: string | null) => void;
    companies: { id: string; name: string }[];
    loading: boolean;
    error: string | null;
  };
  /** Combo servicios (GET /api/Services) → query `serviceId` en TimeEntries/rows. */
  equipoServiceFilter?: {
    serviceId: string | null;
    onServiceIdChange: (id: string | null) => void;
    services: { id: string; name: string }[];
    loading: boolean;
    error: string | null;
  };
  /** Solo uno activo: sin fichaje / sin parte API / con parte API. */
  tablaFiltroExtra: EquipoTablaFiltroExtra;
  opcionesMes: FilterOption[];
  opcionesTrimestre: FilterOption[];
  opcionesAnio: FilterOption[];
  /** Periodo «Año»: mes del detalle (GET /rows) encima de la tabla; gráficos siguen en año completo. */
  gridMesDetalleEnAnio?: {
    mesPagina: number;
    opcionesMes: { value: number; label: string }[];
    onMesPaginaChange: (mes: number) => void;
  };

  // ── Computed stats ─────────────────────────────────────────────────────
  totalMinutos: number;
  totalHorasDecimal: number;
  rowsFiltradas: TimeEntryMock[];
  /** Si viene del GET /rows/summary, alinea KPI con gráficos; si no, se usa rowsFiltradas.length. */
  kpiRegistrosEnPeriodo?: number;
  diasLaborables: number;
  personasEnObjetivo: number;
  horasObjetivo: number;
  hDonutImputado: number;
  hDonutFalta: number;
  hDonutExtra: number;
  horasImputadasDecimal: number;
  horasFaltaParaObjetivo: number;
  fichajeTipoStats: FichajeTipoStats;
  horasSinImputarTipoFichaje: number;
  diasSinImputarEquipo: number;
  partesEquipoStats: PartesEquipoStats;
  diasCalendario: CalendarDay[];
  filasOrdenadas: EquipoTablaFila[];
  /** Minutos de jornada estándar/día (API summary) para columna «Extra». */
  equipoCapTrabajoDiarioMinutos: number;

  // ── Sort ───────────────────────────────────────────────────────────────
  sort: { key: EquipoSortKey | null; dir: "asc" | "desc" | null };
  tablaScrollRef: React.RefObject<HTMLDivElement>;

  // ── Edit modal ─────────────────────────────────────────────────────────
  editModalState: EquipoEditModalState;
  editModalVista: "menu" | "wizard";
  editFormError: string | null;
  /** Guardando ausencia vía POST/PUT TimeEntries. */
  editAbsenceSaving: boolean;
  /** Eliminando fichaje del día vía DELETE TimeEntries. */
  editFichajeDeleting: boolean;
  /** Asistente «Corrección de fichaje» (mismo flujo que registro de jornada). */
  horarioWizard: {
    step: ForgotStep;
    setStep: (s: ForgotStep) => void;
    targetDate: string | null;
    setTargetDate: (d: string | null) => void;
    fullStart: string;
    setFullStart: (v: string) => void;
    fullEnd: string;
    setFullEnd: (v: string) => void;
    forgotMode: ForgotMode;
    setForgotMode: (m: ForgotMode) => void;
    fullBreakMins: number;
    setFullBreakMins: (v: number) => void;
    fullBreakCustom: string;
    setFullBreakCustom: (v: string) => void;
    breakOtro: boolean;
    setBreakOtro: (v: boolean) => void;
    wizardError: string | null;
    setWizardError: (e: string | null) => void;
    saving: boolean;
    onEnterWizard: () => void;
    onBackWizardToMenu: () => void;
    onSubmitJornada: (forced?: number) => void;
  };

  // ── Filter handlers ────────────────────────────────────────────────────
  onSetPeriodo: (v: Period) => void;
  onSetDia: (v: string) => void;
  onSetMes: (v: string) => void;
  onSetTrimestre: (v: string) => void;
  onSetAnio: (v: string) => void;
  onSetPersona: (v: string | "todas") => void;
  onSetSoloSinImputar: (v: boolean) => void;
  onSetSoloSinParteServidor: (v: boolean) => void;
  onSetSoloConParteServidor: (v: boolean) => void;
  /** Limpia empresa, persona, servicio y vista rápida (no toca periodo). */
  onBorrarFiltrosAlcance?: () => void;

  // ── Sort handler ───────────────────────────────────────────────────────
  onSetSortColumn: (key: EquipoSortKey) => void;

  // ── Edit modal handlers ────────────────────────────────────────────────
  onOpenEditModal: (opts: {
    workerId: number;
    workDate: string;
    existing: TimeEntryMock | null;
    isWeekendFila: boolean;
    personaLabel?: string | null;
    targetUserId?: string | null;
    irDirectoAlWizard?: boolean;
  }) => void;
  onCloseEditModal: () => void;
  onGuardarVacaciones: (tipo: "vacaciones" | "baja" | "dia_no_laboral") => void | Promise<void>;
  onEliminarFichaje: () => void | Promise<void>;
  onSetFormError: (e: string | null) => void;

  // ── Part editor handler ────────────────────────────────────────────────
  onOpenPartEditor: (entry: TimeEntryMock) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helper: select con alcance restringido (empresa / persona / servicio)
// ---------------------------------------------------------------------------
function equipoScopedSelectClass(scoped: boolean): string {
  const shared =
    "cursor-pointer rounded-xl px-3 py-2.5 text-sm shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:border-agro-500";
  if (scoped) {
    return `${shared} border border-agro-500 bg-emerald-50/95 font-semibold text-slate-900 ring-1 ring-agro-500/25 dark:border-agro-500 dark:bg-agro-950/50 dark:text-emerald-50 dark:ring-agro-400/25`;
  }
  return `${shared} border border-slate-200 bg-white font-medium text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100`;
}

// ---------------------------------------------------------------------------
// Helper: sort indicator
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
// Component
// ---------------------------------------------------------------------------
export function TeamPanel({
  periodo,
  dia,
  mes,
  trimestre,
  anio,
  persona,
  workersOpciones,
  resolvePersonaNombre,
  equipoNombrePorClave,
  rowsApi,
  equipoCompanyFilter,
  equipoServiceFilter,
  tablaFiltroExtra,
  opcionesMes,
  opcionesTrimestre,
  opcionesAnio,
  gridMesDetalleEnAnio,
  totalMinutos,
  totalHorasDecimal,
  rowsFiltradas,
  kpiRegistrosEnPeriodo,
  diasLaborables,
  personasEnObjetivo,
  horasObjetivo,
  hDonutImputado,
  hDonutFalta,
  hDonutExtra,
  horasImputadasDecimal,
  horasFaltaParaObjetivo,
  fichajeTipoStats,
  horasSinImputarTipoFichaje,
  diasSinImputarEquipo,
  partesEquipoStats,
  diasCalendario,
  filasOrdenadas,
  equipoCapTrabajoDiarioMinutos,
  sort,
  tablaScrollRef,
  editModalState,
  editModalVista,
  editFormError,
  editAbsenceSaving,
  editFichajeDeleting,
  horarioWizard,
  onSetPeriodo,
  onSetDia,
  onSetMes,
  onSetTrimestre,
  onSetAnio,
  onSetPersona,
  onSetSoloSinImputar,
  onSetSoloSinParteServidor,
  onSetSoloConParteServidor,
  onBorrarFiltrosAlcance,
  onSetSortColumn,
  onOpenEditModal,
  onCloseEditModal,
  onGuardarVacaciones,
  onEliminarFichaje,
  onSetFormError,
  onOpenPartEditor,
}: TeamPanelProps) {
  useWheelScrollChain(tablaScrollRef, diasCalendario.length > 0);

  const editMenuBusy = editAbsenceSaving || editFichajeDeleting;

  const mesDetalleTablaNombre =
    periodo === "anio" && gridMesDetalleEnAnio
      ? gridMesDetalleEnAnio.opcionesMes.find((o) => o.value === gridMesDetalleEnAnio.mesPagina)
          ?.label ?? `Mes ${gridMesDetalleEnAnio.mesPagina}`
      : "";

  const periodoRangoTextoParaEtiquetas = React.useMemo(() => {
    switch (periodo) {
      case "dia":
        return formatDateES(dia);
      case "semana":
        return `Semana que incluye ${formatDateES(dia)}`;
      case "mes":
        return opcionesMes.find((o) => o.value === mes)?.label ?? mes;
      case "trimestre":
        return opcionesTrimestre.find((o) => o.value === trimestre)?.label ?? trimestre;
      case "anio":
        return opcionesAnio.find((o) => o.value === anio)?.label ?? anio;
      default:
        return "";
    }
  }, [periodo, dia, mes, trimestre, anio, opcionesMes, opcionesTrimestre, opcionesAnio]);

  const hayFiltrosAlcanceActivos = React.useMemo(
    () =>
      persona !== "todas" ||
      Boolean(equipoCompanyFilter?.companyId?.trim()) ||
      Boolean(equipoServiceFilter?.serviceId?.trim()) ||
      tablaFiltroExtra !== "ninguno",
    [persona, equipoCompanyFilter?.companyId, equipoServiceFilter?.serviceId, tablaFiltroExtra],
  );

  return (
    <div className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/95 sm:p-5">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Historial del equipo
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
          Horas imputadas por trabajadores
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          <strong>Mes en curso:</strong> solo días del 1 al <strong>hoy</strong>. Meses anteriores:
          mes completo. Todos los días (lun–dom): fin de semana = no laboral.{" "}
          <span className="font-semibold text-red-700 dark:text-red-400">
            Laborable sin fichaje = rojo
          </span>
          . Dona izquierda: objetivo vs imputado. Dona derecha: días laborables sin imputar (rojo).
        </p>
      </div>

      <div className="mt-6 flex min-w-0 max-w-full flex-col gap-6 lg:flex-row lg:items-stretch">
        {/* Columna izquierda: filtros + total */}
        <div className="mx-auto flex w-full max-w-[400px] shrink-0 flex-col justify-between gap-4 rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-md dark:border-slate-600 dark:bg-slate-900/80 lg:mx-0 lg:max-w-[min(400px,42vw)] lg:min-h-[320px] lg:p-5">
          <div className="min-h-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-600 dark:bg-slate-800/50 sm:p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Filtros
              </p>
              {onBorrarFiltrosAlcance ? (
                <button
                  type="button"
                  onClick={() => onBorrarFiltrosAlcance()}
                  disabled={!hayFiltrosAlcanceActivos}
                  className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white"
                  title="Quitar empresa, persona, servicio y vista rápida (el periodo no cambia)"
                >
                  Borrar filtros
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor="periodo-equipo"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Periodo
                </label>
                <select
                  id="periodo-equipo"
                  value={periodo}
                  onChange={(e) => onSetPeriodo(e.target.value as Period)}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="dia">Día</option>
                  <option value="mes">Mes</option>
                  <option value="trimestre">Trimestre</option>
                  <option value="anio">Año</option>
                </select>
              </div>

              {periodo === "dia" && (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    htmlFor="dia-equipo"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Día
                  </label>
                  <input
                    id="dia-equipo"
                    type="date"
                    value={dia}
                    onChange={(e) => onSetDia(e.target.value)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              {periodo === "mes" && (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    htmlFor="mes-equipo"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Mes
                  </label>
                  <select
                    id="mes-equipo"
                    value={mes}
                    onChange={(e) => onSetMes(e.target.value)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {opcionesMes.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {periodo === "trimestre" && (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    htmlFor="trimestre-equipo"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Trimestre
                  </label>
                  <select
                    id="trimestre-equipo"
                    value={trimestre}
                    onChange={(e) => onSetTrimestre(e.target.value)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {opcionesTrimestre.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {periodo === "anio" && (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    htmlFor="anio-equipo"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Año
                  </label>
                  <select
                    id="anio-equipo"
                    value={anio}
                    onChange={(e) => onSetAnio(e.target.value)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {opcionesAnio.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div
              className={`mt-3 grid grid-cols-1 gap-3 sm:items-end ${
                equipoCompanyFilter && equipoServiceFilter
                  ? "sm:grid-cols-2 xl:grid-cols-3"
                  : "sm:grid-cols-2"
              }`}
            >
              {equipoCompanyFilter ? (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    htmlFor="empresa-equipo-filtro"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Empresas
                  </label>
                  <select
                    id="empresa-equipo-filtro"
                    value={equipoCompanyFilter.companyId ?? ""}
                    onChange={(e) =>
                      equipoCompanyFilter.onCompanyIdChange(
                        e.target.value.trim() ? e.target.value : null,
                      )
                    }
                    disabled={equipoCompanyFilter.loading}
                    className={equipoScopedSelectClass(Boolean(equipoCompanyFilter.companyId?.trim()))}
                  >
                    <option value="">Todas las empresas</option>
                    {equipoCompanyFilter.companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {equipoCompanyFilter.error ? (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">
                      {equipoCompanyFilter.error}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex min-w-0 flex-col gap-1.5">
                <label
                  htmlFor="filtro-persona-equipo"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Persona
                </label>
                <select
                  id="filtro-persona-equipo"
                  value={persona === "todas" ? "" : String(persona)}
                  onChange={(e) => {
                    const v = e.target.value;
                    onSetPersona(v === "" ? "todas" : v);
                  }}
                  className={equipoScopedSelectClass(persona !== "todas")}
                >
                  <option value="">Todas las personas</option>
                  {workersOpciones.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              {equipoServiceFilter ? (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label
                    htmlFor="servicio-equipo-filtro"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Servicio
                  </label>
                  <select
                    id="servicio-equipo-filtro"
                    value={equipoServiceFilter.serviceId ?? ""}
                    onChange={(e) =>
                      equipoServiceFilter.onServiceIdChange(
                        e.target.value.trim() ? e.target.value : null,
                      )
                    }
                    disabled={equipoServiceFilter.loading}
                    className={equipoScopedSelectClass(Boolean(equipoServiceFilter.serviceId?.trim()))}
                  >
                    <option value="">Todos los servicios</option>
                    {equipoServiceFilter.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {equipoServiceFilter.error ? (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">
                      {equipoServiceFilter.error}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/40">
                <input
                  id="filtro-solo-sin-imputar-equipo"
                  type="checkbox"
                  checked={tablaFiltroExtra === "soloSinImputar"}
                  onChange={(e) => onSetSoloSinImputar(e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-agro-600 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-800"
                />
                <label
                  htmlFor="filtro-solo-sin-imputar-equipo"
                  className="cursor-pointer text-xs font-medium leading-snug text-slate-700 dark:text-slate-300"
                >
                  Mostrar solo días laborables sin fichaje
                </label>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/40">
                <input
                  id="filtro-solo-sin-parte-servidor-equipo"
                  type="checkbox"
                  checked={tablaFiltroExtra === "soloSinParteServidor"}
                  onChange={(e) => onSetSoloSinParteServidor(e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-agro-600 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-800"
                />
                <label
                  htmlFor="filtro-solo-sin-parte-servidor-equipo"
                  className="cursor-pointer text-xs font-medium leading-snug text-slate-700 dark:text-slate-300"
                >
                  Mostrar solo fichados y sin parte
                </label>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/40">
                <input
                  id="filtro-solo-con-parte-servidor-equipo"
                  type="checkbox"
                  checked={tablaFiltroExtra === "soloConParteServidor"}
                  onChange={(e) => onSetSoloConParteServidor(e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-agro-600 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-800"
                />
                <label
                  htmlFor="filtro-solo-con-parte-servidor-equipo"
                  className="cursor-pointer text-xs font-medium leading-snug text-slate-700 dark:text-slate-300"
                >
                  Mostrar solo fichados y con parte
                </label>
              </div>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border-2 border-agro-300/80 bg-gradient-to-br from-agro-50 via-white to-emerald-50 p-3 shadow-sm dark:border-agro-800 dark:from-agro-950/40 dark:via-slate-900 dark:to-emerald-950/30 sm:p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-agro-700 dark:text-agro-400">
              Total horas imputadas
            </p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-agro-800 dark:text-agro-200 sm:text-3xl">
              {formatMinutesShort(totalMinutos)}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {totalHorasDecimal.toLocaleString("es-ES", {
                  minimumFractionDigits: totalHorasDecimal % 1 ? 1 : 0,
                  maximumFractionDigits: 1,
                })}{" "}
                h
              </span>
              <span className="text-slate-500 dark:text-slate-500"> en decimal</span>
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {(kpiRegistrosEnPeriodo ?? rowsFiltradas.length).toLocaleString("es-ES")}{" "}
              {(kpiRegistrosEnPeriodo ?? rowsFiltradas.length) === 1
                ? "registro"
                : "registros"}{" "}
              en el periodo
              {persona !== "todas" && (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {workersOpciones.find((w) => w.id === persona)?.name ?? persona}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Columna derecha: gráficos */}
        <div
          className="flex min-h-[320px] min-w-0 max-w-full flex-1 flex-col gap-4 overflow-x-hidden rounded-3xl border-2 border-slate-200 bg-gradient-to-br from-white via-slate-50/80 to-emerald-50/30 p-3 shadow-sm sm:p-4 dark:border-slate-600 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-emerald-950/20 lg:min-h-0 lg:overflow-y-auto"
          aria-label="Gráficos tipo de fichaje y objetivo vs imputado"
        >
          <div className="min-w-0 border-b border-slate-200/80 pb-4 dark:border-slate-600">
            <EquipoObjetivoMesEncabezado
              diasLaborables={diasLaborables}
              personasEnObjetivo={personasEnObjetivo}
              horasObjetivo={horasObjetivo}
              filtroTodasPersonas={persona === "todas"}
              periodo={periodo}
            />
            <EquipoBarraLaboralesExtra
              horasObjetivo={horasObjetivo}
              horasImputadasLabor={hDonutImputado}
              horasFalta={horasFaltaParaObjetivo}
              horasExtra={hDonutExtra}
              horasImputadasTotal={horasImputadasDecimal}
            />
          </div>

          <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-4 lg:grid-cols-3 lg:items-stretch lg:gap-4">
            <div className="min-h-0 w-full min-w-0 max-w-full lg:h-full">
              <FichajeTipoRadialSummary
                horasNormal={fichajeTipoStats.horasNormal}
                horasManual={fichajeTipoStats.horasManual}
                horasSinImputar={horasSinImputarTipoFichaje}
                registrosNormal={fichajeTipoStats.registrosNormal}
                registrosManual={fichajeTipoStats.registrosManual}
                diasSinImputar={diasSinImputarEquipo}
              />
            </div>
            <div className="min-h-0 w-full min-w-0 max-w-full lg:h-full">
              <HorasMensualesDonut
                horasImputadoHastaTope={hDonutImputado}
                horasFalta={hDonutFalta}
                horasExtra={hDonutExtra}
                horasObjetivo={horasObjetivo}
                horasImputadasTotal={horasImputadasDecimal}
                registrosEnPeriodo={kpiRegistrosEnPeriodo ?? rowsFiltradas.length}
                periodo={periodo}
              />
            </div>
            <div className="min-h-0 w-full min-w-0 max-w-full lg:h-full">
              <PartesEnDiasDonut
                diasImputados={partesEquipoStats.diasImputados}
                diasConParte={partesEquipoStats.diasConParte}
              />
            </div>
          </div>
        </div>
      </div>

      {periodo === "anio" && gridMesDetalleEnAnio ? (
        <div
          className="mt-4 rounded-2xl border-2 border-agro-400/70 bg-gradient-to-br from-emerald-50 via-white to-agro-50/40 px-4 py-4 shadow-sm dark:border-agro-600/55 dark:from-agro-950/45 dark:via-slate-900/95 dark:to-emerald-950/25 sm:px-5"
          role="region"
          aria-label={`Tabla: ${mesDetalleTablaNombre} de ${anio}`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-agro-800 dark:text-agro-400">
                Estás viendo en la tabla
              </p>
              <p className="text-[1.35rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                {mesDetalleTablaNombre}
                <span className="ml-2 inline-block text-[1.1rem] font-semibold tabular-nums text-agro-700 sm:text-xl dark:text-agro-400">
                  {anio}
                </span>
              </p>
              <p className="max-w-xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Los gráficos de esta pantalla usan el{" "}
                <strong className="font-semibold text-slate-800 dark:text-slate-200">
                  año {anio} completo
                </strong>
                . La tabla y el CSV son solo de{" "}
                <strong className="font-semibold text-agro-800 dark:text-agro-300">
                  {mesDetalleTablaNombre}
                </strong>
                .
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-auto sm:items-end">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Cambiar mes
              </span>
              <label htmlFor="grid-mes-detalle-anio" className="sr-only">
                Elegir otro mes para la tabla
              </label>
              <select
                id="grid-mes-detalle-anio"
                value={gridMesDetalleEnAnio.mesPagina}
                onChange={(e) =>
                  gridMesDetalleEnAnio.onMesPaginaChange(Number(e.target.value))
                }
                className={`w-full min-w-[12rem] sm:w-auto ${equipoScopedSelectClass(true)}`}
              >
                {gridMesDetalleEnAnio.opcionesMes.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {diasCalendario.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          No hay días que mostrar: el mes es futuro o el filtro no es válido. El mes actual solo
          lista hasta hoy.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {rowsApi.loading ? (
            <p className="text-xs font-medium text-agro-700 dark:text-agro-300">
              {periodo === "anio"
                ? "Cargando fichajes del mes seleccionado…"
                : "Cargando fichajes del periodo…"}
            </p>
          ) : null}
          {rowsApi.error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              {rowsApi.error}
            </p>
          ) : null}
          {!rowsApi.loading && !rowsApi.error ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {rowsApi.totalCount}{" "}
              {rowsApi.totalCount === 1
                ? "fichaje devuelto por el API"
                : "fichajes devueltos por el API"}{" "}
              {periodo === "anio"
                ? "en el mes mostrado (el grid completa días sin registro en cliente)."
                : "en el periodo (el grid completa días sin registro en cliente)."}
            </p>
          ) : null}
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
                const periodoEtiqueta = (() => {
                  switch (periodo) {
                    case "dia":
                      return formatDateES(dia);
                    case "semana":
                      return `Semana que incluye ${formatDateES(dia)}`;
                    case "mes":
                      return opcionesMes.find((o) => o.value === mes)?.label ?? mes;
                    case "trimestre":
                      return (
                        opcionesTrimestre.find((o) => o.value === trimestre)?.label ??
                        trimestre
                      );
                    case "anio": {
                      const y = opcionesAnio.find((o) => o.value === anio)?.label ?? anio;
                      if (gridMesDetalleEnAnio) {
                        const m = gridMesDetalleEnAnio.opcionesMes.find(
                          (o) => o.value === gridMesDetalleEnAnio.mesPagina,
                        )?.label;
                        return m ? `${y} · ${m}` : y;
                      }
                      return y;
                    }
                    default:
                      return "";
                  }
                })();
                const periodoLabel =
                  periodo === "dia"
                    ? `dia-${dia}`
                    : periodo === "semana"
                      ? `semana-${dia}`
                      : periodo === "mes"
                        ? `mes-${mes}`
                        : periodo === "trimestre"
                          ? `tri-${trimestre}`
                          : periodo === "anio" && gridMesDetalleEnAnio
                            ? `anio-${anio}-mes-${String(gridMesDetalleEnAnio.mesPagina).padStart(2, "0")}`
                            : `anio-${anio}`;
                const fileBaseName = `horas-equipo-${periodoLabel}-${
                  persona === "todas" ? "todas" : `persona-${persona}`
                }${
                  tablaFiltroExtra === "soloSinImputar"
                    ? "-solo-sin-fichar"
                    : tablaFiltroExtra === "soloSinParteServidor"
                      ? "-sin-parte-servidor"
                      : tablaFiltroExtra === "soloConParteServidor"
                        ? "-con-parte-servidor"
                        : ""
                }`;
                downloadEquipoTablePdf({
                  filas: filasOrdenadas,
                  nameByPersonKey: equipoNombrePorClave,
                  capWorkMinutesPerDay: equipoCapTrabajoDiarioMinutos,
                  title: `Horas del equipo — ${periodoEtiqueta}`,
                  fileBaseName,
                });
              }}
              className="order-1 inline-flex items-center gap-1.5 rounded-xl border border-agro-600 bg-agro-50 px-3 py-2 text-xs font-semibold text-agro-800 shadow-sm transition hover:bg-agro-100 dark:border-agro-500 dark:bg-agro-950/40 dark:text-agro-100 dark:hover:bg-agro-900/50 sm:order-2 sm:text-sm"
            >
              <span aria-hidden>⬇</span>
              Exportar PDF (vista actual)
            </button>
          </div>
          <EquipoRegistrosFiltrosEtiquetas
            periodo={periodo}
            periodoRangoTexto={periodoRangoTextoParaEtiquetas}
            vistaTablaMesNombre={
              periodo === "anio" && mesDetalleTablaNombre.trim() ? mesDetalleTablaNombre : null
            }
            vistaTablaAnioTexto={
              periodo === "anio" ? (opcionesAnio.find((o) => o.value === anio)?.label ?? anio) : null
            }
            empresaNombre={
              equipoCompanyFilter?.companyId
                ? equipoCompanyFilter.companies.find((c) => c.id === equipoCompanyFilter.companyId)
                    ?.name ?? null
                : null
            }
            personaNombre={
              persona !== "todas"
                ? workersOpciones.find((w) => w.id === persona)?.name ?? null
                : null
            }
            servicioNombre={
              equipoServiceFilter?.serviceId
                ? equipoServiceFilter.services.find((s) => s.id === equipoServiceFilter.serviceId)
                    ?.name ?? null
                : null
            }
            filtroExtra={tablaFiltroExtra}
            className="mt-2 rounded-xl border border-slate-100 dark:border-slate-700"
          />
          <div
            ref={tablaScrollRef}
            className="mt-2 max-h-[min(70vh,520px)] w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-700 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y]"
            style={{
              overscrollBehaviorY: "auto",
              overscrollBehaviorX: "contain",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
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
                        onClick={() => onSetSortColumn(key)}
                        className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        {label}
                        <SortArrow sortKey={key} activeKey={sort.key} dir={sort.dir} />
                      </button>
                    </th>
                  ))}
                  {(
                    [
                      { key: "descanso", label: "Descanso" },
                    ] as const
                  ).map(({ key, label }) => (
                    <th key={key} className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => onSetSortColumn(key)}
                        className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                      >
                        {label}
                        <SortArrow sortKey={key} activeKey={sort.key} dir={sort.dir} />
                      </button>
                    </th>
                  ))}
                  <th className="max-w-[6.5rem] px-3 py-2.5" title="Campo JSON status del API">
                    <button
                      type="button"
                      onClick={() => onSetSortColumn("estado")}
                      className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      Estado
                      <SortArrow sortKey="estado" activeKey={sort.key} dir={sort.dir} />
                    </button>
                  </th>
                  <th className="px-3 py-2.5">Parte</th>
                  <th className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => onSetSortColumn("razon")}
                      className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      Razón
                      <SortArrow sortKey="razon" activeKey={sort.key} dir={sort.dir} />
                    </button>
                  </th>
                  <th className="min-w-[9rem] max-w-[14rem] px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => onSetSortColumn("modificado")}
                      className="flex w-full items-center gap-0.5 text-left hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      Modificado por
                      <SortArrow sortKey="modificado" activeKey={sort.key} dir={sort.dir} />
                    </button>
                  </th>
                  <th className="min-w-[7.5rem] whitespace-normal px-3 py-2.5 leading-tight">
                    <button
                      type="button"
                      onClick={() => onSetSortColumn("fechaMod")}
                      className="flex w-full flex-col items-start gap-0 text-left hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      <span className="flex items-center gap-0.5">
                        Fecha
                        <SortArrow sortKey="fechaMod" activeKey={sort.key} dir={sort.dir} />
                      </span>
                      <span className="font-normal normal-case text-[10px] text-slate-400">
                        modificación
                      </span>
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onSetSortColumn("duracion")}
                      className="ml-auto flex w-full items-center justify-end gap-0.5 hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      Duración
                      <SortArrow sortKey="duracion" activeKey={sort.key} dir={sort.dir} />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onSetSortColumn("extra")}
                      className="ml-auto flex w-full items-center justify-end gap-0.5 hover:text-agro-700 dark:hover:text-agro-300"
                      title="Por encima de la jornada estándar del resumen (hoursPerWorkingDay)"
                    >
                      Extra
                      <SortArrow sortKey="extra" activeKey={sort.key} dir={sort.dir} />
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
                {filasOrdenadas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={14}
                      className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      {tablaFiltroExtra === "soloSinImputar"
                        ? "No hay días laborables sin fichaje en el periodo y filtros actuales."
                        : tablaFiltroExtra === "soloSinParteServidor"
                          ? "No hay fichados sin parte en el periodo y filtros actuales."
                          : tablaFiltroExtra === "soloConParteServidor"
                            ? "No hay fichados con parte en el periodo y filtros actuales."
                            : "No hay filas que mostrar."}
                    </td>
                  </tr>
                ) : (
                  filasOrdenadas.map((fila, rowIndex) => {
                  if (fila.kind === "noLaboral") {
                    const zebra = equipoTablaZebraRowClass(rowIndex);
                    const stripe = equipoTablaZebraStripeBg(rowIndex);
                    return (
                      <tr key={`nl-${fila.userId}-${fila.workDate}`} className={zebra}>
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {resolvePersonaNombre(fila)}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
                          {formatDateEsWeekdayDdMmYyyy(fila.workDate)}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs align-middle">
                          <span
                            className={`${equipoTablaEtiquetaBaseClass} ${timeEntryApiStatusBadgeClass("NonWorkingDay")}`}
                          >
                            No laboral
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="max-w-[11rem] px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                          {RAZON_NO_LABORAL}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500 dark:text-slate-400">
                          —
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500 dark:text-slate-400">
                          —
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td
                          className={`sticky right-0 z-[1] align-middle border-l border-slate-200/80 px-1 py-1.5 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-slate-700 ${stripe}`}
                        >
                          <EquipoTablaBotonPrimeraJornada
                            onCrearJornada={() =>
                              onOpenEditModal({
                                workerId: fila.workerId,
                                workDate: fila.workDate,
                                existing: null,
                                isWeekendFila: true,
                                personaLabel: resolvePersonaNombre(fila),
                                targetUserId: fila.userId,
                                irDirectoAlWizard: true,
                              })
                            }
                          />
                        </td>
                      </tr>
                    );
                  }

                  if (fila.kind === "sinImputar") {
                    const zebra = equipoTablaZebraRowClass(rowIndex);
                    const stripe = equipoTablaZebraStripeBg(rowIndex);
                    return (
                      <tr key={`si-${fila.userId}-${fila.workDate}`} className={zebra}>
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {resolvePersonaNombre(fila)}
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100">
                          {formatDateEsWeekdayDdMmYyyy(fila.workDate)}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs align-middle">
                          <span
                            className={`${equipoTablaEtiquetaBaseClass} ${equipoTablaSinImputarBadgeClass}`}
                          >
                            Sin imputar
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="max-w-[11rem] px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
                          {RAZON_SIN_IMPUTAR}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500 dark:text-slate-400">
                          —
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500 dark:text-slate-400">
                          —
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
                        <td
                          className={`sticky right-0 z-[1] align-middle border-l border-slate-200/80 px-1 py-1.5 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-slate-700 ${stripe}`}
                        >
                          <EquipoTablaBotonPrimeraJornada
                            onCrearJornada={() =>
                              onOpenEditModal({
                                workerId: fila.workerId,
                                workDate: fila.workDate,
                                existing: null,
                                isWeekendFila: false,
                                personaLabel: resolvePersonaNombre(fila),
                                targetUserId: fila.userId,
                                irDirectoAlWizard: true,
                              })
                            }
                          />
                        </td>
                      </tr>
                    );
                  }

                  const e = fila.e;
                  const ausenciaPorApiStatus = isAbsenceCalendarApiStatus(e);
                  const ausenciaEtiqueta = equipoAbsenceEtiquetaKind(e);
                  const ausenciaEtiquetaVisual = ausenciaEtiqueta
                    ? equipoTablaEtiquetaAusencia(ausenciaEtiqueta)
                    : null;
                  const ocultaHoras = equipoRegistroOcultaHorasEnTabla(e);
                  const apiParte = workReportParteApiSummary(e);
                  const lineCount =
                    typeof e.workReportLineCount === "number" &&
                    Number.isFinite(e.workReportLineCount) &&
                    e.workReportLineCount > 0
                      ? e.workReportLineCount
                      : null;
                  const parteCell = ocultaHoras ? (
                    "—"
                  ) : apiParte.tieneParte ? (
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                      Sí{lineCount != null ? ` (${lineCount})` : ""}
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">No</span>
                  );
                  const zebra = equipoTablaZebraRowClass(rowIndex);
                  const stripe = equipoTablaZebraStripeBg(rowIndex);
                  const razonClass =
                    e.razon === "imputacion_manual_error"
                      ? "rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
                      : "text-slate-700 dark:text-slate-200";
                  return (
                    <tr key={`${e.id}-${e.workerId}-${e.workDate}`} className={zebra}>
                      <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {resolvePersonaNombre(fila)}
                      </td>
                      <td className="px-3 py-2 text-xs">{formatDateEsWeekdayDdMmYyyy(e.workDate)}</td>
                      <td className="px-3 py-2 text-xs">
                        {ocultaHoras ? "—" : formatTimeLocal(e.checkInUtc)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {ocultaHoras ? "—" : formatTimeLocal(e.checkOutUtc)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {ocultaHoras ? "—" : formatMinutesShort(e.breakMinutes ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-xs align-middle">
                        {ausenciaEtiquetaVisual ? (
                          <span
                            className={`${equipoTablaEtiquetaBaseClass} ${ausenciaEtiquetaVisual.badgeClass}`}
                          >
                            {ausenciaEtiquetaVisual.label}
                          </span>
                        ) : (
                          <TimeEntryStatusBadge status={e.timeEntryStatus} />
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{parteCell}</td>
                      <td className="max-w-[10rem] px-3 py-2 text-xs leading-snug">
                        <span className={razonClass}>
                          {formatRazonTablaEquipo(e)}
                          {!ausenciaPorApiStatus && e.edicionNotaAdmin ? (
                            <span className="mt-0.5 block font-normal text-[10px] opacity-90">
                              {e.edicionNotaAdmin}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td
                        className="max-w-[14rem] px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
                        title={ausenciaPorApiStatus ? undefined : formatLastModifiedByUser(e)}
                      >
                        <span className="line-clamp-2 break-all">
                          {ausenciaPorApiStatus ? "—" : formatLastModifiedByUser(e)}
                        </span>
                      </td>
                      <td
                        className="whitespace-nowrap px-3 py-2 text-xs text-slate-600 dark:text-slate-300"
                        title={ausenciaPorApiStatus ? undefined : e.updatedAtUtc ?? ""}
                      >
                        {ausenciaPorApiStatus ? "—" : formatFechaModificacionUtc(e.updatedAtUtc)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-semibold">
                        {ocultaHoras ? "—" : formatMinutesShort(effectiveWorkMinutesEntry(e))}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-semibold">
                        {ocultaHoras
                          ? "—"
                          : (() => {
                              const xm = effectiveExtraMinutesEntry(e, equipoCapTrabajoDiarioMinutos);
                              return xm > 0 ? formatMinutesShort(xm) : "—";
                            })()}
                      </td>
                      <td className="max-w-[9rem] px-3 py-2 text-xs leading-tight">
                        {ocultaHoras ? (
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
                        className={`sticky right-0 z-[1] align-middle border-l border-slate-200/80 px-1 py-1.5 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-slate-700 ${stripe}`}
                      >
                        <EquipoTablaAccionesDuo
                          onEditarHora={() =>
                            onOpenEditModal({
                              workerId: e.workerId,
                              workDate: e.workDate,
                              existing: e,
                              isWeekendFila: workDateIsWeekend(e.workDate),
                              personaLabel: resolvePersonaNombre(fila),
                              targetUserId: e.userId ?? null,
                            })
                          }
                          onEditarParte={() => onOpenPartEditor(e)}
                          parteDisabled={ocultaHoras || !e.checkOutUtc}
                          tieneParte={timeEntryConParteEnServidor(e)}
                        />
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>

          {/* Modal: editar día del equipo */}
          {editModalState && (
            <div
              className={`fixed inset-0 z-[100] ${MODAL_BACKDROP_CENTER}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="equipo-edit-title"
              onClick={(ev) => {
                if (ev.target === ev.currentTarget) onCloseEditModal();
              }}
              onKeyDown={(ev) => {
                if (ev.key === "Escape") onCloseEditModal();
              }}
            >
              <div
                className={modalScrollablePanel("lg")}
                onClick={(ev) => ev.stopPropagation()}
              >
                {editModalVista !== "wizard" ? (
                  <>
                    <h2
                      id="equipo-edit-title"
                      className="text-lg font-bold text-slate-900 dark:text-slate-50"
                    >
                      Editar día
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {editModalState.personaLabel?.trim() ||
                          workerNameById(editModalState.workerId)}
                      </span>
                      {" · "}
                      {formatDateES(editModalState.workDate)}
                      {editModalState.isWeekendFila ? (
                        <span className="ml-1 text-xs text-slate-500">(fin de semana)</span>
                      ) : null}
                    </p>
                  </>
                ) : null}

                {editModalVista === "menu" ? (
                  <div className="mt-5 space-y-4">
                    {editFormError ? (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                        {editFormError}
                      </p>
                    ) : null}
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Ausencias
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          disabled={editMenuBusy}
                          onClick={() => void onGuardarVacaciones("vacaciones")}
                          className="flex-1 rounded-xl border-2 border-sky-400 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900 shadow-sm transition hover:bg-sky-100 disabled:opacity-60 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-900/40"
                        >
                          {editAbsenceSaving ? "Guardando…" : "Añadir vacaciones"}
                        </button>
                        <button
                          type="button"
                          disabled={editMenuBusy}
                          onClick={() => void onGuardarVacaciones("baja")}
                          className="flex-1 rounded-xl border-2 border-violet-400 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-100 disabled:opacity-60 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/35"
                        >
                          {editAbsenceSaving ? "Guardando…" : "Añadir baja / ausencia"}
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={editMenuBusy}
                        onClick={() => void onGuardarVacaciones("dia_no_laboral")}
                        className="mt-2 w-full rounded-xl border-2 border-stone-400 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 shadow-sm transition hover:bg-stone-100 disabled:opacity-60 dark:border-stone-500 dark:bg-stone-900/40 dark:text-stone-100 dark:hover:bg-stone-800/50"
                      >
                        {editAbsenceSaving ? "Guardando…" : "Marcar día no laboral"}
                      </button>
                      <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                        Vacaciones, baja o día no laboral: si ya había horario imputado, se guardará en{" "}
                        <strong>Entrada/Salida (antes)</strong>. La fila quedará marcada y se registrará
                        quién modificó.
                      </p>
                    </div>
                    <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Jornada laboral
                      </p>
                      <button
                        type="button"
                        disabled={editMenuBusy}
                        onClick={() => {
                          horarioWizard.onEnterWizard();
                          onSetFormError(null);
                        }}
                        className="w-full rounded-xl border-2 border-agro-500 bg-agro-50 px-4 py-3 text-sm font-semibold text-agro-900 shadow-sm transition hover:bg-agro-100 disabled:opacity-60 dark:border-agro-600 dark:bg-agro-950/40 dark:text-agro-100 dark:hover:bg-agro-900/50"
                      >
                        Modificar horario (imputación manual)
                      </button>
                      <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                        Mismo asistente que en <strong>Registro de jornada</strong>. Se guarda en el
                        servidor como jornada cerrada.
                      </p>
                      <button
                        type="button"
                        disabled={
                          editMenuBusy ||
                          !(
                            typeof editModalState.existing?.timeEntryId === "string" &&
                            editModalState.existing.timeEntryId.trim().length > 0
                          )
                        }
                        title={
                          typeof editModalState.existing?.timeEntryId === "string" &&
                          editModalState.existing.timeEntryId.trim().length > 0
                            ? undefined
                            : "No hay fila de fichaje en el servidor para este día"
                        }
                        onClick={() => void onEliminarFichaje()}
                        className="mt-2 w-full rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900 shadow-sm transition hover:bg-red-100 disabled:opacity-60 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-900/45"
                      >
                        {editFichajeDeleting ? "Eliminando…" : "Eliminar fichaje"}
                      </button>
                      <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                        Borra la fila de fichaje del día en el servidor (por ejemplo, si se imputó por
                        error). Si el backend exige condiciones adicionales, verás el mensaje de error
                        arriba.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={editMenuBusy}
                      onClick={onCloseEditModal}
                      className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    {horarioWizard.saving ? (
                      <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">Guardando…</p>
                    ) : null}
                    <ForgotModal
                      variant="embedded"
                      step={horarioWizard.step}
                      targetDate={editModalState.workDate}
                      today={localTodayISO()}
                      soloTime="09:00"
                      fullStart={horarioWizard.fullStart}
                      fullEnd={horarioWizard.fullEnd}
                      forgotMode={horarioWizard.forgotMode}
                      fullBreakMins={horarioWizard.fullBreakMins}
                      fullBreakCustom={horarioWizard.fullBreakCustom}
                      breakOtro={horarioWizard.breakOtro}
                      error={horarioWizard.wizardError}
                      onClose={onCloseEditModal}
                      onSetStep={horarioWizard.setStep}
                      onSetError={horarioWizard.setWizardError}
                      onSetTargetDate={horarioWizard.setTargetDate}
                      onSetSoloTime={() => {}}
                      onSetFullStart={horarioWizard.setFullStart}
                      onSetFullEnd={horarioWizard.setFullEnd}
                      onSetForgotMode={horarioWizard.setForgotMode}
                      onSetFullBreakMins={horarioWizard.setFullBreakMins}
                      onSetFullBreakCustom={horarioWizard.setFullBreakCustom}
                      onSetBreakOtro={horarioWizard.setBreakOtro}
                      onSubmitSoloEntrada={() => {}}
                      onSubmitJornadaCompleta={(forced) =>
                        horarioWizard.onSubmitJornada(forced)
                      }
                      onBackFromFullStartOverride={horarioWizard.onBackWizardToMenu}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
