"use client";

import React from "react";
import { EquipoBarraLaboralesExtra } from "./EquipoBarraLaboralesExtra";
import { EquipoObjetivoMesEncabezado } from "./EquipoObjetivoMesEncabezado";
import { FichajeTipoDonut } from "./charts/FichajeTipoDonut";
import { HorasMensualesDonut } from "./charts/HorasMensualesDonut";
import { PartesEnDiasDonut } from "./charts/PartesEnDiasDonut";
import type { EquipoSortKey, EquipoTablaFila, TimeEntryMock } from "@/features/time-tracking/types";
import {
  buildEquipoTableCsvFilas,
  effectiveWorkMinutesEntry,
  formatLastModifiedByUser,
  formatRazon,
  isAusenciaRazon,
  RAZON_NO_LABORAL,
  RAZON_SIN_IMPUTAR,
} from "@/features/time-tracking/utils/formatters";
import {
  getTasksFromRecord,
  getWorkPartsForWorker,
} from "@/lib/workPartsStorage";
import { MOCK_WORKERS_FICHA, workerNameById } from "@/mocks/time-tracking.mock";
import {
  formatDateES,
  formatFechaModificacionUtc,
  formatMinutesShort,
  formatTiempoAnterior,
  formatTimeLocal,
  workDateIsWeekend,
} from "@/shared/utils/time";

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
} | null;

interface TeamPanelProps {
  // ── Filters ────────────────────────────────────────────────────────────
  periodo: Period;
  dia: string;
  mes: string;
  trimestre: string;
  anio: string;
  persona: number | "todas";
  opcionesMes: FilterOption[];
  opcionesTrimestre: FilterOption[];
  opcionesAnio: FilterOption[];

  // ── Computed stats ─────────────────────────────────────────────────────
  totalMinutos: number;
  totalHorasDecimal: number;
  rowsFiltradas: TimeEntryMock[];
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

  // ── Sort ───────────────────────────────────────────────────────────────
  sort: { key: EquipoSortKey | null; dir: "asc" | "desc" | null };
  tablaScrollRef: React.RefObject<HTMLDivElement>;

  // ── Edit modal ─────────────────────────────────────────────────────────
  editModalState: EquipoEditModalState;
  editModalVista: "menu" | "horario";
  editFormIn: string;
  editFormOut: string;
  editFormBreak: number;
  editFormNota: string;
  editFormError: string | null;

  // ── Filter handlers ────────────────────────────────────────────────────
  onSetPeriodo: (v: Period) => void;
  onSetDia: (v: string) => void;
  onSetMes: (v: string) => void;
  onSetTrimestre: (v: string) => void;
  onSetAnio: (v: string) => void;
  onSetPersona: (v: number | "todas") => void;

  // ── Sort handler ───────────────────────────────────────────────────────
  onSetSortColumn: (key: EquipoSortKey) => void;

  // ── Edit modal handlers ────────────────────────────────────────────────
  onOpenEditModal: (opts: {
    workerId: number;
    workDate: string;
    existing: TimeEntryMock | null;
    isWeekendFila: boolean;
  }) => void;
  onCloseEditModal: () => void;
  onSetModalVista: (v: "menu" | "horario") => void;
  onGuardarVacaciones: (tipo: "vacaciones" | "baja") => void;
  onSetFormError: (e: string | null) => void;
  onGuardarHorario: () => void;
  onSetFormIn: (v: string) => void;
  onSetFormOut: (v: string) => void;
  onSetFormBreak: (v: number) => void;
  onSetFormNota: (v: string) => void;

  // ── Part editor handler ────────────────────────────────────────────────
  onOpenPartEditor: (entry: TimeEntryMock) => Promise<void>;
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
  opcionesMes,
  opcionesTrimestre,
  opcionesAnio,
  totalMinutos,
  totalHorasDecimal,
  rowsFiltradas,
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
  sort,
  tablaScrollRef,
  editModalState,
  editModalVista,
  editFormIn,
  editFormOut,
  editFormBreak,
  editFormNota,
  editFormError,
  onSetPeriodo,
  onSetDia,
  onSetMes,
  onSetTrimestre,
  onSetAnio,
  onSetPersona,
  onSetSortColumn,
  onOpenEditModal,
  onCloseEditModal,
  onSetModalVista,
  onGuardarVacaciones,
  onSetFormError,
  onGuardarHorario,
  onSetFormIn,
  onSetFormOut,
  onSetFormBreak,
  onSetFormNota,
  onOpenPartEditor,
}: TeamPanelProps) {
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
          </span>{" "}
          (~10 % demo). Dona izquierda: objetivo vs imputado. Dona derecha: incluye días laborables
          sin imputar (rojo).
        </p>
      </div>

      <div className="mt-6 flex min-w-0 max-w-full flex-col gap-6 lg:flex-row lg:items-stretch">
        {/* Columna izquierda: filtros + total */}
        <div className="mx-auto flex w-full max-w-[400px] shrink-0 flex-col justify-between gap-4 rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-md dark:border-slate-600 dark:bg-slate-900/80 lg:mx-0 lg:max-w-[min(400px,42vw)] lg:min-h-[320px] lg:p-5">
          <div className="min-h-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-600 dark:bg-slate-800/50 sm:p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Filtros
            </p>
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
                    onSetPersona(v === "" ? "todas" : parseInt(v, 10));
                  }}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">Todas las personas</option>
                  {MOCK_WORKERS_FICHA.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
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
              {rowsFiltradas.length}{" "}
              {rowsFiltradas.length === 1 ? "registro" : "registros"} en el periodo
              {persona !== "todas" && (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {workerNameById(persona as number)}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Columna derecha: gráficos */}
        <div
          className="flex min-h-[320px] min-w-0 max-w-full flex-1 flex-col gap-4 overflow-x-hidden rounded-3xl border-2 border-slate-200 bg-gradient-to-br from-white via-slate-50/80 to-emerald-50/30 p-3 shadow-sm sm:p-4 dark:border-slate-600 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-emerald-950/20 lg:min-h-0 lg:overflow-y-auto"
          aria-label="Gráficos objetivo vs imputado"
        >
          <div className="min-w-0 border-b border-slate-200/80 pb-4 dark:border-slate-600">
            <EquipoObjetivoMesEncabezado
              diasLaborables={diasLaborables}
              personasEnObjetivo={personasEnObjetivo}
              horasObjetivo={horasObjetivo}
              filtroTodasPersonas={persona === "todas"}
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
              <HorasMensualesDonut
                horasImputadoHastaTope={hDonutImputado}
                horasFalta={hDonutFalta}
                horasExtra={hDonutExtra}
                horasObjetivo={horasObjetivo}
                horasImputadasTotal={horasImputadasDecimal}
                registrosEnPeriodo={rowsFiltradas.length}
              />
            </div>
            <div className="min-h-0 w-full min-w-0 max-w-full lg:h-full">
              <FichajeTipoDonut
                horasNormal={fichajeTipoStats.horasNormal}
                horasManual={fichajeTipoStats.horasManual}
                horasSinImputar={horasSinImputarTipoFichaje}
                registrosNormal={fichajeTipoStats.registrosNormal}
                registrosManual={fichajeTipoStats.registrosManual}
                diasSinImputar={diasSinImputarEquipo}
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

      <span className="mt-3 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
        Vista administrador · datos de demo
      </span>

      {diasCalendario.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          No hay días que mostrar: el mes es futuro o el filtro no es válido. El mes actual solo
          lista hasta hoy.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
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
                const csv = buildEquipoTableCsvFilas(filasOrdenadas);
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const periodoLabel =
                  periodo === "dia"
                    ? `dia-${dia}`
                    : periodo === "mes"
                      ? `mes-${mes}`
                      : periodo === "trimestre"
                        ? `tri-${trimestre}`
                        : `anio-${anio}`;
                a.download = `horas-equipo-${periodoLabel}-${
                  persona === "todas" ? "todas" : `persona-${persona}`
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
          <div
            ref={tablaScrollRef}
            className="mt-2 max-h-[min(70vh,520px)] w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-700 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y]"
            style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
          >
            <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
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
                  <th className="px-3 py-2.5 whitespace-normal leading-tight">
                    <button
                      type="button"
                      onClick={() => onSetSortColumn("entradaAntes")}
                      className="flex w-full flex-col items-start gap-0 text-left hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      <span className="flex items-center gap-0.5">
                        Entrada
                        <SortArrow sortKey="entradaAntes" activeKey={sort.key} dir={sort.dir} />
                      </span>
                      <span className="font-normal normal-case text-[10px] text-slate-400">
                        (antes)
                      </span>
                    </button>
                  </th>
                  <th className="px-3 py-2.5 whitespace-normal leading-tight">
                    <button
                      type="button"
                      onClick={() => onSetSortColumn("salidaAntes")}
                      className="flex w-full flex-col items-start gap-0 text-left hover:text-agro-700 dark:hover:text-agro-300"
                    >
                      <span className="flex items-center gap-0.5">
                        Salida
                        <SortArrow sortKey="salidaAntes" activeKey={sort.key} dir={sort.dir} />
                      </span>
                      <span className="font-normal normal-case text-[10px] text-slate-400">
                        (antes)
                      </span>
                    </button>
                  </th>
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
                  <th className="sticky right-0 z-[5] bg-slate-50 px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:bg-slate-700 dark:text-slate-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filasOrdenadas.map((fila) => {
                  if (fila.kind === "noLaboral") {
                    return (
                      <tr
                        key={`nl-${fila.workerId}-${fila.workDate}`}
                        className="border-t border-slate-200 bg-slate-100/95 text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300"
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {workerNameById(fila.workerId)}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                          {formatDateES(fila.workDate)}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">—</td>
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
                        <td className="px-3 py-2 text-right text-xs text-slate-500 dark:text-slate-400">
                          —
                        </td>
                        <td className="sticky right-0 z-[1] border-l border-slate-200/80 bg-slate-100 px-1 py-1 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-slate-600 dark:bg-slate-800/55">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenEditModal({
                                workerId: fila.workerId,
                                workDate: fila.workDate,
                                existing: null,
                                isWeekendFila: true,
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

                  if (fila.kind === "sinImputar") {
                    return (
                      <tr
                        key={`si-${fila.workerId}-${fila.workDate}`}
                        className="border-t border-rose-200 bg-rose-50/95 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50"
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-rose-900 dark:text-rose-100">
                          {workerNameById(fila.workerId)}
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-rose-900 dark:text-rose-100">
                          {formatDateES(fila.workDate)}
                        </td>
                        <td className="px-3 py-2 text-xs text-rose-800/90 dark:text-rose-200/90">—</td>
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
                        <td className="px-3 py-2 text-right text-xs font-semibold text-rose-800 dark:text-rose-200">
                          —
                        </td>
                        <td className="sticky right-0 z-[1] border-l border-rose-200/80 bg-rose-50 px-1 py-1 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-rose-800 dark:bg-rose-950/45">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenEditModal({
                                workerId: fila.workerId,
                                workDate: fila.workDate,
                                existing: null,
                                isWeekendFila: false,
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

                  const e = fila.e;
                  const aus = isAusenciaRazon(e.razon);
                  const part =
                    getWorkPartsForWorker(e.workerId).find((p) => p.workDate === e.workDate) ?? null;
                  const partTasksCount = part ? getTasksFromRecord(part).length : 0;
                  const parteCell = aus ? (
                    "—"
                  ) : part ? (
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                      Sí{partTasksCount ? ` (${partTasksCount})` : ""}
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">No</span>
                  );
                  const rowVac =
                    e.razon === "ausencia_vacaciones"
                      ? "border-t border-sky-200 bg-sky-50/95 text-sky-950 dark:border-sky-800 dark:bg-sky-950/45 dark:text-sky-50"
                      : e.razon === "ausencia_baja"
                        ? "border-t border-violet-200 bg-violet-50/95 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-50"
                        : "border-t border-slate-100 bg-white/80 dark:border-slate-700 dark:bg-slate-800/80";
                  const stickyBg =
                    e.razon === "ausencia_vacaciones"
                      ? "bg-sky-50/98 dark:bg-sky-950/50"
                      : e.razon === "ausencia_baja"
                        ? "bg-violet-50/98 dark:bg-violet-950/45"
                        : "bg-white/95 dark:bg-slate-800/95";
                  return (
                    <tr
                      key={`${e.id}-${e.workerId}-${e.workDate}`}
                      className={rowVac}
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {workerNameById(e.workerId)}
                      </td>
                      <td className="px-3 py-2 text-xs">{formatDateES(e.workDate)}</td>
                      <td className="px-3 py-2 text-xs">{aus ? "—" : formatTimeLocal(e.checkInUtc)}</td>
                      <td className="px-3 py-2 text-xs">{aus ? "—" : formatTimeLocal(e.checkOutUtc)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                        {formatTiempoAnterior(e.previousCheckInUtc)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                        {formatTiempoAnterior(e.previousCheckOutUtc)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {aus ? "—" : formatMinutesShort(e.breakMinutes ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-xs">{parteCell}</td>
                      <td className="max-w-[10rem] px-3 py-2 text-xs leading-snug">
                        <span
                          className={
                            e.razon === "imputacion_manual_error"
                              ? "rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
                              : e.razon === "ausencia_vacaciones"
                                ? "rounded-md bg-sky-200/80 px-1.5 py-0.5 font-semibold text-sky-950 dark:bg-sky-800/60 dark:text-sky-100"
                                : e.razon === "ausencia_baja"
                                  ? "rounded-md bg-violet-200/80 px-1.5 py-0.5 font-semibold text-violet-950 dark:bg-violet-300/30 dark:text-violet-100"
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
                        {aus ? "—" : formatMinutesShort(effectiveWorkMinutesEntry(e))}
                      </td>
                      <td
                        className={`sticky right-0 z-[1] px-1 py-1 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] ${stickyBg}`}
                      >
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenEditModal({
                                workerId: e.workerId,
                                workDate: e.workDate,
                                existing: e,
                                isWeekendFila: workDateIsWeekend(e.workDate),
                              })
                            }
                            className="rounded-lg border border-agro-500/60 bg-agro-50 px-2 py-1 text-[10px] font-semibold text-agro-800 hover:bg-agro-100 dark:border-agro-600 dark:bg-agro-950/50 dark:text-agro-100 dark:hover:bg-agro-900/60"
                          >
                            Editar hora
                          </button>
                          <button
                            type="button"
                            disabled={aus || !e.checkOutUtc}
                            onClick={() => onOpenPartEditor(e)}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            {part ? "Editar parte" : "Añadir parte"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Modal: editar día del equipo */}
          {editModalState && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
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
                    {workerNameById(editModalState.workerId)}
                  </span>
                  {" · "}
                  {formatDateES(editModalState.workDate)}
                  {editModalState.isWeekendFila ? (
                    <span className="ml-1 text-xs text-slate-500">(fin de semana)</span>
                  ) : null}
                </p>

                {editModalVista === "menu" ? (
                  <div className="mt-5 space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Ausencias
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => onGuardarVacaciones("vacaciones")}
                          className="flex-1 rounded-xl border-2 border-sky-400 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900 shadow-sm transition hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-900/40"
                        >
                          Añadir vacaciones
                        </button>
                        <button
                          type="button"
                          onClick={() => onGuardarVacaciones("baja")}
                          className="flex-1 rounded-xl border-2 border-violet-400 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-100 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/35"
                        >
                          Añadir baja / ausencia
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                        Si ya había horario imputado, se guardará en <strong>Entrada/Salida (antes)</strong>.
                        La fila quedará marcada y se registrará quién modificó.
                      </p>
                    </div>
                    <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Jornada laboral
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onSetModalVista("horario");
                          onSetFormError(null);
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
                      onClick={onCloseEditModal}
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
                        onSetModalVista("menu");
                        onSetFormError(null);
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
                          value={editFormIn}
                          onChange={(ev) => onSetFormIn(ev.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Salida
                        </label>
                        <input
                          type="time"
                          value={editFormOut}
                          onChange={(ev) => onSetFormOut(ev.target.value)}
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
                        value={editFormBreak}
                        onChange={(ev) => onSetFormBreak(Number(ev.target.value) || 0)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Motivo / nota (opcional)
                      </label>
                      <textarea
                        value={editFormNota}
                        onChange={(ev) => onSetFormNota(ev.target.value)}
                        rows={2}
                        placeholder="Ej. Corrección acordada con el trabajador"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                    {editFormError ? (
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        {editFormError}
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={onGuardarHorario}
                        className="flex-1 rounded-xl bg-agro-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-agro-700"
                      >
                        Guardar horario
                      </button>
                      <button
                        type="button"
                        onClick={onCloseEditModal}
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
        </div>
      )}
    </div>
  );
}
