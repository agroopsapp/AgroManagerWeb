"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { companiesApi, getClientCompanyWithAreas, workServicesApi } from "@/services";
import { MODAL_BACKDROP_CENTER, modalScrollablePanel } from "@/components/modalShell";
import { USER_ROLE } from "@/types";
import { useEquipo } from "@/features/time-tracking/hooks/useEquipo";
import { useWheelScrollChain } from "@/features/time-tracking/hooks/useWheelScrollChain";
import { useEquipoModal } from "@/features/time-tracking/hooks/useEquipoModal";
import { useEquipoPart } from "@/features/time-tracking/hooks/useEquipoPart";
import { workerNameById } from "@/mocks/time-tracking.mock";
import {
  formatDateES,
  formatDateEsWeekdayDdMmYyyy,
  formatFechaModificacionUtc,
  formatMinutesShort,
  formatTiempoAnterior,
  formatTimeLocal,
  localTodayISO,
  workDateIsWeekend,
  workDateWithinLastNDays,
} from "@/shared/utils/time";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";
import { ForgotModal } from "@/features/time-tracking/components/ForgotModal";
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
import { downloadEquipoPersonaPartesBundlePdf } from "@/features/time-tracking/utils/equipoPersonaPartesPdf";
import type { EquipoSortKey } from "@/features/time-tracking/types";
import { EquipoObjetivoMesEncabezado } from "@/features/time-tracking/components/EquipoObjetivoMesEncabezado";
import { EquipoBarraLaboralesExtra } from "@/features/time-tracking/components/EquipoBarraLaboralesExtra";
import {
  EquipoKpiFraccionFichaje,
  EquipoKpiFraccionParte,
  EquipoKpiStatCard,
} from "@/features/time-tracking/components/EquipoKpiStatCard";
import { EquipoPersonaCalendario } from "@/features/time-tracking/components/EquipoPersonaCalendario";
import {
  EquipoTablaAccionesDuo,
  EquipoTablaBotonPrimeraJornada,
} from "@/features/time-tracking/components/EquipoTablaAccionesIconos";
import { TimeEntryStatusBadge } from "@/features/time-tracking/components/TimeEntryStatusBadge";
import { HorasMensualesDonut } from "@/features/time-tracking/components/charts/HorasMensualesDonut";
import { FichajeTipoRadialSummary } from "@/features/time-tracking/components/charts/FichajeTipoRadialSummary";
import { EquipoKpiResumenBarras } from "@/features/time-tracking/components/charts/EquipoKpiResumenBarras";
import { EquipoRegistrosFiltrosEtiquetas } from "@/features/time-tracking/components/EquipoRegistrosFiltrosEtiquetas";

const EquipoPartModal = dynamic(
  () => import("@/features/time-tracking/components/EquipoPartModal").then((m) => m.EquipoPartModal),
  { ssr: false },
);

/** Campos de filtro: borde suave, foco discreto (patrón SaaS). */
/** Tarjeta base: una sola “capa” visual, sin competir con contenido interno. */
const cardSurfaceClass =
  "rounded-2xl border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-600 dark:bg-slate-900/45 dark:shadow-none";

const FILTER_ANIM_EASE_OUT = [0.16, 1, 0.3, 1] as const;
const FILTER_ANIM_EASE_IN = [0.4, 0, 0.2, 1] as const;

/** Worker: edición en «Horas del equipo» solo en los últimos N días naturales (incluye sábados y domingos). */
const WORKER_TEAM_HOURS_EDIT_WINDOW_DAYS = 10;

/** Etiqueta de campo en la barra de filtros horizontal. */
const filterLabelClass =
  "text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500";

/** Select/input compacto para la barra de filtros horizontal. */
const compactSelectClass =
  "rounded-md border border-slate-200/80 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm outline-none transition cursor-pointer focus:border-agro-600/45 focus:ring-1 focus:ring-agro-500/15 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-agro-500/70";

/** Empresa / persona / servicio: resalta el desplegable cuando no está en «todas». */
function teamHoursScopedSelectClass(scoped: boolean): string {
  const shared =
    "w-full rounded-md border px-2 py-1 text-xs shadow-sm outline-none transition cursor-pointer focus:ring-1 dark:text-slate-100";
  if (scoped) {
    /* Dark: fondo opaco (evita texto claro sobre verde «lavado» por transparencia) */
    return `${shared} border-agro-500/90 bg-emerald-50/95 font-semibold text-slate-900 ring-1 ring-agro-500/25 focus:border-agro-600 focus:ring-agro-500/30 dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-800/60 dark:focus:border-emerald-500`;
  }
  return `${shared} border-slate-200/80 bg-white text-slate-900 focus:border-agro-600/45 focus:ring-agro-500/15 dark:border-slate-600 dark:bg-slate-950 dark:focus:border-agro-500/70`;
}

/**
 * Genera las clases CSS para los chips toggle de "Vista rápida".
 * @param active       Si el filtro está activo.
 * @param activeColors Clases de color cuando está activo (borde, fondo, texto light y dark).
 */
function chipClass(active: boolean, activeColors: string, extra = ""): string {
  const base =
    "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium whitespace-nowrap transition";
  const inactive =
    "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800/60";
  return [base, active ? activeColors : inactive, extra].filter(Boolean).join(" ");
}

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
    <span className="shrink-0 text-agro-700/90 dark:text-agro-400" aria-hidden>
      {dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function TeamHoursPage() {
  const [parteEquipoValidationError, setParteEquipoValidationError] = useState<string | null>(null);
  const [exportPartesBundleLoading, setExportPartesBundleLoading] = useState(false);
  const [exportPartesBundleError, setExportPartesBundleError] = useState<string | null>(null);
  /** Resumen KPI superior: tarjetas (1) o barras (2). */
  const [equipoKpiPagina, setEquipoKpiPagina] = useState<0 | 1>(0);
  // Marcado = comportamiento habitual: ocultar excluidos del fichaje.
  const [ocultarExcluidosFichaje, setOcultarExcluidosFichaje] = useState(true);
  const { user, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace("/login");
  }, [user, isReady, router]);

  const eq = useEquipo({
    enableEquipoCompanyFilter:
      user?.role === USER_ROLE.SuperAdmin ||
      user?.role === USER_ROLE.Manager ||
      user?.role === USER_ROLE.Admin,
    includeExcludedFromTimeTracking: !ocultarExcluidosFichaje,
  });

  useEffect(() => {
    // Evita quedarse con una persona que ya no existe en el combo al cambiar el modo.
    eq.setFiltroPersonaEquipo("todas");
  }, [ocultarExcluidosFichaje]);

  useWheelScrollChain(eq.equipoTablaScrollRef, eq.diasCalendarioMesEquipo.length > 0);

  const modal = useEquipoModal({
    user,
    equipoTablaScrollRef: eq.equipoTablaScrollRef,
    equipoRestaurarScroll: eq.equipoRestaurarScroll,
    equipoMarcarRestaurarScroll: eq.equipoMarcarRestaurarScroll,
    refetchEquipoRows: eq.refetchEquipoRows,
    equipoWorkersCatalog: eq.equipoWorkersOpciones,
    equipoSuperAdminCompanyId: eq.equipoSuperAdminCompanyId,
  });

  const part = useEquipoPart({
    setEquipoPartsVersion: eq.setEquipoPartsVersion,
    refetchEquipoRows: eq.refetchEquipoRows,
    onValidationError: setParteEquipoValidationError,
  });

  useEffect(() => {
    if (part.equipoPartModal) setParteEquipoValidationError(null);
  }, [part.equipoPartModal]);

  /** PDF agrupado: solo con persona concreta y periodo acotado (≤ un mes: día / semana / mes). */
  const puedeExportarPdfPartesPersona = useMemo(() => {
    if (eq.filtroPersonaEquipo === "todas") return false;
    return (
      eq.equipoPeriodo === "dia" ||
      eq.equipoPeriodo === "semana" ||
      eq.equipoPeriodo === "mes"
    );
  }, [eq.filtroPersonaEquipo, eq.equipoPeriodo]);

  const equipoVistaTieneRegistrosJornada = useMemo(
    () => eq.equipoFilasVista.some((f) => f.kind === "registro"),
    [eq.equipoFilasVista],
  );

  useEffect(() => {
    if (!puedeExportarPdfPartesPersona) setExportPartesBundleError(null);
  }, [puedeExportarPdfPartesPersona]);

  const periodoEtiqueta = useMemo(() => {
    switch (eq.equipoPeriodo) {
      case "dia":
        return formatDateES(eq.equipoDia);
      case "semana":
        return `Semana que incluye ${formatDateES(eq.equipoSemana)}`;
      case "mes":
        return (
          eq.opcionesMesEquipo.find((o) => o.value === eq.mesEquipo)?.label ?? eq.mesEquipo
        );
      case "trimestre":
        return (
          eq.opcionesTrimestre.find((o) => o.value === eq.trimestreEquipo)?.label ??
          eq.trimestreEquipo
        );
      case "anio":
        return eq.opcionesAnio.find((o) => o.value === eq.anioEquipo)?.label ?? eq.anioEquipo;
      default:
        return "";
    }
  }, [
    eq.anioEquipo,
    eq.equipoDia,
    eq.equipoPeriodo,
    eq.equipoSemana,
    eq.mesEquipo,
    eq.opcionesAnio,
    eq.opcionesMesEquipo,
    eq.opcionesTrimestre,
    eq.trimestreEquipo,
  ]);

  const handleExportPartesYFichajesPdf = async () => {
    if (!puedeExportarPdfPartesPersona) return;
    setExportPartesBundleError(null);
    setExportPartesBundleLoading(true);
    try {
      const personaNombre =
        eq.equipoWorkersOpciones.find((w) => w.id === eq.filtroPersonaEquipo)?.name ??
        String(eq.filtroPersonaEquipo);
      const [companiesList, svcList] = await Promise.all([
        companiesApi.getAll(),
        workServicesApi.getAll(),
      ]);
      const companiesWithAreas = await Promise.all(
        companiesList.map((c) => getClientCompanyWithAreas(c.id).catch(() => c)),
      );
      const periodSlug =
        eq.equipoPeriodo === "dia"
          ? `dia-${eq.equipoDia}`
          : eq.equipoPeriodo === "semana"
            ? `sem-${eq.equipoSemana}`
            : `mes-${eq.mesEquipo}`;
      const personaSlug =
        personaNombre
          .replace(/[/\\?%*:|"<>]+/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 48) || "persona";
      await downloadEquipoPersonaPartesBundlePdf({
        filas: eq.equipoFilasVista,
        workerDisplayName: personaNombre,
        periodLabel: periodoEtiqueta,
        companies: companiesWithAreas,
        services: svcList,
        fileBaseName: `partes-fichajes-${personaSlug}-${periodSlug}`,
      });
    } catch (e) {
      setExportPartesBundleError(
        userVisibleMessageFromUnknown(e, "No se pudo generar el PDF."),
      );
    } finally {
      setExportPartesBundleLoading(false);
    }
  };

  /** Firma estable al cambiar filtros / vista: animación suave del bloque de datos (sin remontar la tabla). */
  const equipoVistaSignature = useMemo(
    () =>
      [
        eq.equipoPeriodo,
        eq.equipoDia,
        eq.equipoSemana,
        eq.mesEquipo,
        eq.trimestreEquipo,
        eq.anioEquipo,
        String(eq.equipoAnioMesPagina),
        eq.equipoSuperAdminCompanyId ?? "",
        eq.filtroPersonaEquipo,
        eq.equipoServiceId ?? "",
        eq.equipoTablaFiltroExtra,
      ].join("|"),
    [
      eq.equipoPeriodo,
      eq.equipoDia,
      eq.equipoSemana,
      eq.mesEquipo,
      eq.trimestreEquipo,
      eq.anioEquipo,
      eq.equipoAnioMesPagina,
      eq.equipoSuperAdminCompanyId,
      eq.filtroPersonaEquipo,
      eq.equipoServiceId,
      eq.equipoTablaFiltroExtra,
    ],
  );

  const kpiBlockAnim = useAnimationControls();
  const objetivoBlockAnim = useAnimationControls();
  const registrosBlockAnim = useAnimationControls();
  const resumenAsideAnim = useAnimationControls();
  const filterAnimPrimeraCarga = useRef(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (filterAnimPrimeraCarga.current) {
      filterAnimPrimeraCarga.current = false;
      return;
    }

    const transCorto = { duration: 0.35, ease: FILTER_ANIM_EASE_OUT };

    const stopAll = () => {
      kpiBlockAnim.stop();
      objetivoBlockAnim.stop();
      registrosBlockAnim.stop();
      resumenAsideAnim.stop();
    };

    if (reduceMotion) {
      stopAll();
      void kpiBlockAnim.start({ opacity: 1, y: 0, transition: transCorto });
      void objetivoBlockAnim.start({ opacity: 1, y: 0, transition: transCorto });
      void registrosBlockAnim.start({
        opacity: 1,
        y: 0,
        scaleY: 1,
        transition: transCorto,
      });
      void resumenAsideAnim.start({ opacity: 1, y: 0, transition: transCorto });
      return;
    }

    let alive = true;

    const run = async () => {
      stopAll();

      await Promise.all([
        kpiBlockAnim.start({
          opacity: 0.86,
          y: 8,
          transition: { duration: 0.26, ease: FILTER_ANIM_EASE_IN },
        }),
        objetivoBlockAnim.start({
          opacity: 0.86,
          y: 8,
          transition: { duration: 0.26, ease: FILTER_ANIM_EASE_IN },
        }),
        registrosBlockAnim.start({
          opacity: 0.72,
          y: 16,
          scaleY: 0.975,
          transition: { duration: 0.28, ease: FILTER_ANIM_EASE_IN },
        }),
        resumenAsideAnim.start({
          opacity: 0.86,
          y: 8,
          transition: { duration: 0.26, ease: FILTER_ANIM_EASE_IN },
        }),
      ]);
      if (!alive) return;

      /* Aperturas en paralelo con delay escalonado: no encadenar con await entre bloques
         (así no “congela” la sensación de uso; sigue habiendo movimiento en cascada). */
      await Promise.all([
        kpiBlockAnim.start({
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.62,
            ease: FILTER_ANIM_EASE_OUT,
            delay: 0,
          },
        }),
        objetivoBlockAnim.start({
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.58,
            ease: FILTER_ANIM_EASE_OUT,
            delay: 0.09,
          },
        }),
        registrosBlockAnim.start({
          opacity: 1,
          y: 0,
          scaleY: 1,
          transition: {
            duration: 0.72,
            ease: FILTER_ANIM_EASE_OUT,
            delay: 0.2,
          },
        }),
        resumenAsideAnim.start({
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.58,
            ease: FILTER_ANIM_EASE_OUT,
            delay: 0.32,
          },
        }),
      ]);
    };

    void run();

    return () => {
      alive = false;
      stopAll();
    };
  }, [
    equipoVistaSignature,
    kpiBlockAnim,
    objetivoBlockAnim,
    registrosBlockAnim,
    resumenAsideAnim,
    reduceMotion,
  ]);

  if (!isReady || !user) return null;

  const isWorker = user.role === USER_ROLE.Worker;
  const workerTeamHoursCanEditDate = (workDate: string) =>
    workDateWithinLastNDays(workDate, WORKER_TEAM_HOURS_EDIT_WINDOW_DAYS);

  const mesTablaDetalleNombre =
    eq.equipoPeriodo === "anio"
      ? eq.opcionesMesDentroAnioEquipo.find((o) => o.value === eq.equipoAnioMesPagina)?.label ??
        `Mes ${eq.equipoAnioMesPagina}`
      : "";

  return (
    <div className="min-w-0 max-w-full pb-4">
      <header className="space-y-2 pb-3">
        <div className="space-y-1">
          {parteEquipoValidationError ? (
            <div
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-100"
            >
              <span>{parteEquipoValidationError}</span>{" "}
              <button
                type="button"
                className="ml-2 font-semibold underline"
                onClick={() => setParteEquipoValidationError(null)}
              >
                Cerrar
              </button>
            </div>
          ) : null}
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
            Historial del equipo
          </p>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl sm:leading-snug">
            Horas imputadas por trabajadores
          </h1>
          <p className="max-w-2xl text-xs leading-snug text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">{periodoEtiqueta}</span>
            {" · "}Resumen operativo del periodo seleccionado.
          </p>
          {isWorker ? (
            <p className="mt-2 max-w-2xl rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
              Como trabajador/a puedes filtrar y revisar el equipo. Los botones{" "}
              <strong className="font-semibold">Editar hora</strong> y{" "}
              <strong className="font-semibold">Añadir / Editar parte</strong> solo aparecen en filas de los{" "}
              <strong className="font-semibold">últimos {WORKER_TEAM_HOURS_EDIT_WINDOW_DAYS} días naturales</strong>{" "}
              (incluye fines de semana). Fuera de esa ventana la API puede rechazar la edición.
            </p>
          ) : null}
        </div>

        <details className="group max-w-2xl rounded-lg border border-slate-200/65 bg-slate-50/40 px-3 py-2 dark:border-slate-700/80 dark:bg-slate-800/25">
          <summary className="cursor-pointer select-none text-xs font-medium text-slate-700 outline-none marker:text-slate-400 dark:text-slate-200">
            Interpretación del periodo y los gráficos
          </summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-snug text-slate-600 marker:text-slate-400 dark:text-slate-400">
            <li>
              Mes en curso: del 1 al día de hoy. Meses anteriores: mes completo (lun–dom en rejilla).
            </li>
            <li>Fin de semana: tratado como no laboral salvo correcciones manuales.</li>
            <li>
              <span className="font-medium text-rose-700 dark:text-rose-400">
                Laborable sin fichaje
              </span>{" "}
              se resalta en la tabla para revisión rápida.
            </li>
            <li>
              En pantallas anchas, el resumen con donas queda a la <strong>derecha</strong> de la tabla y del
              bloque de objetivo (misma anchura que la rejilla de registros).
            </li>
            <li>
              Si el periodo es <span className="font-medium text-slate-800 dark:text-slate-200">Año</span>
              , los gráficos usan el año completo y la tabla solo el mes que elijas encima de
              «Registros».
            </li>
          </ul>
        </details>
      </header>

      {/* ── Rejilla: panel de filtros + contenido ────────────────── */}
      {/* `items-stretch` + wrapper alto completo: sin esto `items-start` deja la celda del aside
          tan baja como el propio panel y `sticky` no tiene recorrido dentro del scroll de `main`. */}
      <div className="grid grid-cols-1 gap-4 pt-3 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-stretch">

        {/* ── Panel de filtros lateral (sticky en desktop) ───────── */}
        <div className="min-h-0 min-w-0">
          <aside
            aria-label="Filtros de la vista"
            className={`${cardSurfaceClass} p-3 lg:sticky lg:top-3`}
          >
          <div className="space-y-2.5">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xs font-semibold text-slate-900 dark:text-white">Filtros</h2>
                <button
                  type="button"
                  onClick={() => eq.equipoBorrarFiltrosAlcance()}
                  disabled={
                    eq.filtroPersonaEquipo === "todas" &&
                    !eq.equipoSuperAdminCompanyId?.trim() &&
                    !eq.equipoServiceId?.trim() &&
                    eq.equipoTablaFiltroExtra === "ninguno"
                  }
                  className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white"
                  title="Quitar empresa, persona, servicio y vista rápida (el periodo no cambia)"
                >
                  Borrar filtros
                </button>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                Periodo, alcance y vistas rápidas.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="periodo-team-hours"
                className={filterLabelClass}
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
              className={`w-full ${compactSelectClass}`}
            >
              <option value="dia">Día</option>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
              <option value="trimestre">Trimestre</option>
              <option value="anio">Año</option>
            </select>
          </div>

          {eq.equipoPeriodo === "dia" && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="dia-team-hours"
                className={filterLabelClass}
              >
                Día
              </label>
              <input
                id="dia-team-hours"
                type="date"
                value={eq.equipoDia}
                onChange={(e) => eq.setEquipoDia(e.target.value)}
                className={`w-full ${compactSelectClass}`}
              />
            </div>
          )}

          {eq.equipoPeriodo === "semana" && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="semana-team-hours"
                className={filterLabelClass}
              >
                Semana
              </label>
              <input
                id="semana-team-hours"
                type="date"
                value={eq.equipoSemana}
                onChange={(e) => eq.setEquipoSemana(e.target.value)}
                className={`w-full ${compactSelectClass}`}
              />
            </div>
          )}

          {eq.equipoPeriodo === "mes" && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="mes-team-hours"
                className={filterLabelClass}
              >
                Mes
              </label>
              <select
                id="mes-team-hours"
                value={eq.mesEquipo}
                onChange={(e) => eq.setMesEquipo(e.target.value)}
                className={`w-full ${compactSelectClass}`}
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
            <div className="flex flex-col gap-1">
              <label
                htmlFor="trimestre-team-hours"
                className={filterLabelClass}
              >
                Trimestre
              </label>
              <select
                id="trimestre-team-hours"
                value={eq.trimestreEquipo}
                onChange={(e) => eq.setTrimestreEquipo(e.target.value)}
                className={`w-full ${compactSelectClass}`}
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
            <div className="flex flex-col gap-1">
              <label
                htmlFor="anio-team-hours"
                className={filterLabelClass}
              >
                Año
              </label>
              <select
                id="anio-team-hours"
                value={eq.anioEquipo}
                onChange={(e) => eq.setAnioEquipo(e.target.value)}
                className={`w-full ${compactSelectClass}`}
              >
                {eq.opcionesAnio.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {user.role === USER_ROLE.SuperAdmin ||
          user.role === USER_ROLE.Manager ||
          user.role === USER_ROLE.Admin ? (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="empresa-team-hours-filtro"
                className={filterLabelClass}
              >
                Empresa
              </label>
              <select
                id="empresa-team-hours-filtro"
                value={eq.equipoSuperAdminCompanyId ?? ""}
                onChange={(e) =>
                  eq.setEquipoSuperAdminCompanyId(e.target.value.trim() ? e.target.value : null)
                }
                disabled={eq.equipoCompaniesLoading}
                className={`${teamHoursScopedSelectClass(Boolean(eq.equipoSuperAdminCompanyId?.trim()))} disabled:cursor-not-allowed disabled:opacity-55`}
              >
                <option value="">Todas las empresas</option>
                {eq.equipoCompaniesCatalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <label
              htmlFor="persona-team-hours"
              className={filterLabelClass}
            >
              Persona
            </label>
            <div className="flex flex-col gap-1.5">
              <select
                id="persona-team-hours"
                value={eq.filtroPersonaEquipo === "todas" ? "" : String(eq.filtroPersonaEquipo)}
                onChange={(e) => {
                  const v = e.target.value;
                  eq.setFiltroPersonaEquipo(v === "" ? "todas" : v);
                }}
                className={teamHoursScopedSelectClass(eq.filtroPersonaEquipo !== "todas")}
              >
                <option value="">Todos</option>
                {eq.equipoWorkersOpciones.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <label
                className="inline-flex items-center gap-2 text-[10px] font-semibold text-slate-600 dark:text-slate-300 select-none"
                title="Oculta a los empleados con «Excluir del registro de jornada» activado."
              >
                <input
                  type="checkbox"
                  checked={ocultarExcluidosFichaje}
                  onChange={(e) => setOcultarExcluidosFichaje(e.target.checked)}
                />
                Ocultar excl.
              </label>
            </div>
          </div>

          {user.role === USER_ROLE.SuperAdmin ||
          user.role === USER_ROLE.Manager ||
          user.role === USER_ROLE.Admin ? (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="servicio-team-hours-filtro"
                className={filterLabelClass}
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
                className={`${teamHoursScopedSelectClass(Boolean(eq.equipoServiceId?.trim()))} disabled:cursor-not-allowed disabled:opacity-55`}
              >
                <option value="">Todos los servicios</option>
                {eq.equipoServicesCatalog.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

            {/* Vista rápida */}
            <div className="space-y-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <span className={filterLabelClass}>Vista rápida</span>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    eq.setEquipoSoloSinImputar(eq.equipoTablaFiltroExtra !== "soloSinImputar")
                  }
                  aria-pressed={eq.equipoTablaFiltroExtra === "soloSinImputar"}
                  className={chipClass(
                    eq.equipoTablaFiltroExtra === "soloSinImputar",
                    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
                    "w-full justify-start",
                  )}
                >
                  Sin fichar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    eq.setEquipoSoloSinParteServidor(
                      eq.equipoTablaFiltroExtra !== "soloSinParteServidor",
                    )
                  }
                  aria-pressed={eq.equipoTablaFiltroExtra === "soloSinParteServidor"}
                  className={chipClass(
                    eq.equipoTablaFiltroExtra === "soloSinParteServidor",
                    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
                    "w-full justify-start",
                  )}
                >
                  Sin parte
                </button>
                <button
                  type="button"
                  onClick={() =>
                    eq.setEquipoSoloConParteServidor(
                      eq.equipoTablaFiltroExtra !== "soloConParteServidor",
                    )
                  }
                  aria-pressed={eq.equipoTablaFiltroExtra === "soloConParteServidor"}
                  className={chipClass(
                    eq.equipoTablaFiltroExtra === "soloConParteServidor",
                    "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
                    "w-full justify-start",
                  )}
                >
                  Con parte
                </button>
              </div>
            </div>

            {puedeExportarPdfPartesPersona && !isWorker ? (
              <div className="space-y-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                <span className={filterLabelClass}>Exportar partes</span>
                <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                  Un solo PDF: cada día con el fichaje y el parte en servidor (si existe). Solo con{" "}
                  <strong className="font-medium text-slate-600 dark:text-slate-300">persona</strong>{" "}
                  elegida y periodo <strong className="font-medium text-slate-600 dark:text-slate-300">día</strong>,{" "}
                  <strong className="font-medium text-slate-600 dark:text-slate-300">semana</strong> o{" "}
                  <strong className="font-medium text-slate-600 dark:text-slate-300">mes</strong>.
                </p>
                <button
                  type="button"
                  disabled={
                    exportPartesBundleLoading ||
                    eq.equipoRowsLoading ||
                    !equipoVistaTieneRegistrosJornada
                  }
                  onClick={() => void handleExportPartesYFichajesPdf()}
                  className="w-full rounded-md border border-agro-600/80 bg-agro-50 px-2 py-2 text-xs font-semibold text-agro-900 shadow-sm transition hover:bg-agro-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-50 dark:hover:bg-emerald-900"
                >
                  {exportPartesBundleLoading ? "Generando PDF…" : "PDF partes + fichajes"}
                </button>
                {exportPartesBundleError ? (
                  <p className="text-[10px] font-medium leading-snug text-rose-600 dark:text-rose-400">
                    {exportPartesBundleError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>
        </div>

        {/* ── Contenido principal: KPI a ancho útil; objetivo+tabla comparten ancho con donas a la derecha (xl+) ── */}
        <div className="min-h-0 min-w-0 space-y-3">
      {/* KPI: todo el ancho de la columna principal */}
      <motion.section
        className="space-y-2"
        initial={{ opacity: 1, y: 0 }}
        animate={kpiBlockAnim}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Mismos datos del periodo: elige vista.
          </p>
          <nav
            className="flex items-center gap-2 self-end sm:self-auto"
            aria-label="Paginación vista resumen KPI"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Vista
            </span>
            <div className="flex items-center gap-1 rounded-full border border-slate-200/90 bg-slate-50/90 p-0.5 dark:border-slate-600 dark:bg-slate-800/80">
              <button
                type="button"
                role="tab"
                aria-selected={equipoKpiPagina === 0}
                aria-controls="equipo-kpi-panel"
                id="equipo-kpi-tab-tarjetas"
                onClick={() => setEquipoKpiPagina(0)}
                className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-2 text-xs font-bold transition ${
                  equipoKpiPagina === 0
                    ? "bg-agro-600 text-white shadow-sm dark:bg-emerald-600"
                    : "text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-slate-700/80"
                }`}
                title="Tarjetas"
              >
                1
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={equipoKpiPagina === 1}
                aria-controls="equipo-kpi-panel"
                id="equipo-kpi-tab-grafico"
                onClick={() => setEquipoKpiPagina(1)}
                className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-2 text-xs font-bold transition ${
                  equipoKpiPagina === 1
                    ? "bg-agro-600 text-white shadow-sm dark:bg-emerald-600"
                    : "text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-slate-700/80"
                }`}
                title="Gráfico (barras)"
              >
                2
              </button>
            </div>
            <span className="hidden text-[10px] text-slate-400 dark:text-slate-500 sm:inline" aria-hidden>
              {equipoKpiPagina === 0 ? "· tarjetas" : "· barras"}
            </span>
          </nav>
        </div>

        <div id="equipo-kpi-panel" role="tabpanel" aria-labelledby={equipoKpiPagina === 0 ? "equipo-kpi-tab-tarjetas" : "equipo-kpi-tab-grafico"}>
          {equipoKpiPagina === 0 ? (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2 xl:grid-cols-5 xl:items-stretch">
          <EquipoKpiStatCard
            accent="emerald"
            titulo="Horas imputadas"
            valorPrincipal={
              <span className="text-xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-white sm:text-2xl">
                {formatMinutesShort(eq.totalMinutosImputadosMes)}
              </span>
            }
            detalle={
              <span className="tabular-nums text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {eq.totalHorasDecimalMes.toLocaleString("es-ES", {
                    minimumFractionDigits: eq.totalHorasDecimalMes % 1 ? 1 : 0,
                    maximumFractionDigits: 1,
                  })}{" "}
                  h dec.
                </span>
              </span>
            }
            pie={
              <>
                {eq.equipoRegistrosPeriodoKpi.toLocaleString("es-ES")}{" "}
                {eq.equipoRegistrosPeriodoKpi === 1 ? "registro" : "registros"}
                {eq.filtroPersonaEquipo !== "todas" ? (
                  <>
                    {" · "}
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {eq.equipoWorkersOpciones.find((w) => w.id === eq.filtroPersonaEquipo)
                        ?.name ?? eq.filtroPersonaEquipo}
                    </span>
                  </>
                ) : null}
              </>
            }
          />
          <EquipoKpiStatCard
            accent="violet"
            titulo="Fichaje en jornadas"
            valorPrincipal={
              <EquipoKpiFraccionFichaje
                conFichaje={eq.equipoJornadasFichajeStats.conFichaje}
                jornadasLaborables={eq.equipoJornadasFichajeStats.jornadasLaborables}
              />
            }
          />
          <EquipoKpiStatCard
            accent="sky"
            titulo="Parte vs jornadas registradas"
            valorPrincipal={
              <EquipoKpiFraccionParte
                conParte={eq.equipoRejillaParteStats.conFichajeYParte}
                jornadasRegistradas={eq.equipoRejillaParteStats.conFichajeCerrado}
              />
            }
          />
          <EquipoKpiStatCard
            accent="amber"
            titulo="Registradas pero sin parte"
            valorPrincipal={
              <span className="text-xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-white sm:text-2xl">
                {eq.equipoRejillaParteStats.conFichajeSinParte.toLocaleString("es-ES")}
              </span>
            }
            pie="Jornada cerrada sin parte en servidor."
          />
          <EquipoKpiStatCard
            accent="rose"
            titulo="Días sin imputar"
            valorPrincipal={
              <span className="text-xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-white sm:text-2xl">
                {eq.diasSinImputarEquipo.toLocaleString("es-ES")}
              </span>
            }
            pie="Celdas laborables sin fichaje (coherente con la tabla)."
          />
        </div>
          ) : (
            <EquipoKpiResumenBarras
              totalMinutosImputados={eq.totalMinutosImputadosMes}
              totalHorasDecimal={eq.totalHorasDecimalMes}
              registros={eq.equipoRegistrosPeriodoKpi}
              horasObjetivoTeorico={eq.horasObjetivoMesTeorico}
              fichajeCon={eq.equipoJornadasFichajeStats.conFichaje}
              fichajeJornadasLaborables={eq.equipoJornadasFichajeStats.jornadasLaborables}
              parteCon={eq.equipoRejillaParteStats.conFichajeYParte}
              parteJornadasRegistradas={eq.equipoRejillaParteStats.conFichajeCerrado}
              registradasSinParte={eq.equipoRejillaParteStats.conFichajeSinParte}
              diasSinImputar={eq.diasSinImputarEquipo}
            />
          )}
        </div>
      </motion.section>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:gap-3">
            <div className="min-h-0 min-w-0 flex-1 space-y-3">
        <motion.div
          className={`${cardSurfaceClass} p-3 sm:p-3.5`}
          initial={{ opacity: 1, y: 0 }}
          animate={objetivoBlockAnim}
        >
          <EquipoObjetivoMesEncabezado
            diasLaborables={eq.diasLaborablesMesEquipo}
            personasEnObjetivo={eq.personasEnObjetivo}
            horasObjetivo={eq.horasObjetivoMesTeorico}
            filtroTodasPersonas={eq.filtroPersonaEquipo === "todas"}
            periodo={eq.equipoPeriodo}
          />
          <div className="mt-2">
            <EquipoBarraLaboralesExtra
              horasObjetivo={eq.horasObjetivoMesTeorico}
              horasImputadasLabor={eq.hDonutImputado}
              horasFalta={eq.horasFaltaParaObjetivo}
              horasExtra={eq.hDonutExtra}
              horasImputadasTotal={eq.horasImputadasDecimal}
            />
          </div>
        </motion.div>

      {/* Tabla / vacío (principal): animación tipo desplegable desde arriba */}
      {eq.diasCalendarioMesEquipo.length === 0 ? (
        <motion.div
          className={`${cardSurfaceClass} px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-400`}
          style={{ transformOrigin: "top center" }}
          initial={{ opacity: 1, y: 0, scaleY: 1 }}
          animate={registrosBlockAnim}
        >
          No hay días que mostrar en este contexto (periodo futuro o filtro no aplicable). El mes en
          curso solo incluye hasta hoy.
        </motion.div>
      ) : (
        <motion.section
          className={`${cardSurfaceClass} overflow-hidden`}
          style={{ transformOrigin: "top center" }}
          initial={{ opacity: 1, y: 0, scaleY: 1 }}
          animate={registrosBlockAnim}
        >
          {eq.equipoPeriodo === "anio" ? (
            <div
              className="border-b border-agro-400/50 bg-gradient-to-br from-emerald-50/90 via-white to-agro-50/30 px-3 py-2.5 dark:border-agro-600/40 dark:from-agro-950/35 dark:via-slate-900/95 dark:to-emerald-950/15"
              role="region"
              aria-label={`Tabla: ${mesTablaDetalleNombre} de ${eq.anioEquipo}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-agro-800 dark:text-agro-400">
                    Estás viendo en la tabla
                  </p>
                  <p className="text-base font-bold leading-tight tracking-tight text-slate-900 sm:text-lg dark:text-white">
                    {mesTablaDetalleNombre}
                    <span className="ml-1.5 inline-block text-sm font-semibold tabular-nums text-agro-700 dark:text-agro-400">
                      {eq.anioEquipo}
                    </span>
                  </p>
                  <p className="max-w-xl text-xs leading-snug text-slate-600 dark:text-slate-400">
                    Los gráficos de esta página usan el{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-200">
                      año {eq.anioEquipo} completo
                    </strong>
                    . La tabla y el CSV son solo de{" "}
                    <strong className="font-semibold text-agro-800 dark:text-agro-300">
                      {mesTablaDetalleNombre}
                    </strong>
                    .
                  </p>
                </div>
                <div className="flex w-full shrink-0 flex-col gap-1 sm:w-auto sm:items-end">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Cambiar mes
                  </span>
                  <label htmlFor="team-hours-grid-mes-anio" className="sr-only">
                    Elegir otro mes para la tabla
                  </label>
                  <select
                    id="team-hours-grid-mes-anio"
                    value={eq.equipoAnioMesPagina}
                    onChange={(e) => eq.setEquipoAnioMesPagina(Number(e.target.value))}
                    className={teamHoursScopedSelectClass(true)}
                  >
                    {eq.opcionesMesDentroAnioEquipo.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Registros</h2>
            <div className="flex flex-col flex-wrap items-stretch gap-1.5 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
              {eq.equipoRowsLoading ? (
                <p className="text-xs font-medium text-agro-700 dark:text-agro-300">
                  {eq.equipoPeriodo === "anio"
                    ? "Cargando fichajes del mes seleccionado…"
                    : "Cargando fichajes…"}
                </p>
              ) : null}
              {eq.equipoRowsError ? (
                <p className="max-w-md rounded-lg border border-rose-200/90 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-100">
                  {eq.equipoRowsError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const periodoLabel =
                    eq.equipoPeriodo === "dia"
                      ? `dia-${eq.equipoDia}`
                      : eq.equipoPeriodo === "semana"
                        ? `semana-${eq.equipoSemana}`
                        : eq.equipoPeriodo === "mes"
                          ? `mes-${eq.mesEquipo}`
                          : eq.equipoPeriodo === "trimestre"
                            ? `tri-${eq.trimestreEquipo}`
                            : `anio-${eq.anioEquipo}-mes-${String(eq.equipoAnioMesPagina).padStart(2, "0")}`;
                  const fileBaseName = `horas-equipo-${periodoLabel}-${
                    eq.filtroPersonaEquipo === "todas" ? "todas" : `persona-${eq.filtroPersonaEquipo}`
                  }${
                    eq.equipoTablaFiltroExtra === "soloSinImputar"
                      ? "-solo-sin-fichar"
                      : eq.equipoTablaFiltroExtra === "soloSinParteServidor"
                        ? "-sin-parte-servidor"
                        : eq.equipoTablaFiltroExtra === "soloConParteServidor"
                          ? "-con-parte-servidor"
                          : ""
                  }`;
                  downloadEquipoTablePdf({
                    filas: eq.equipoFilasVista,
                    nameByPersonKey: eq.equipoNombrePorClave,
                    capWorkMinutesPerDay: eq.equipoCapTrabajoDiarioMinutos,
                    title: `Horas del equipo — ${periodoEtiqueta}`,
                    fileBaseName,
                  });
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
              >
                <span aria-hidden className="opacity-80">
                  ⬇
                </span>
                Exportar PDF
              </button>
            </div>
          </div>

          <EquipoRegistrosFiltrosEtiquetas
            periodo={eq.equipoPeriodo}
            periodoRangoTexto={periodoEtiqueta}
            vistaTablaMesNombre={
              eq.equipoPeriodo === "anio" && mesTablaDetalleNombre.trim()
                ? mesTablaDetalleNombre
                : null
            }
            vistaTablaAnioTexto={
              eq.equipoPeriodo === "anio"
                ? (eq.opcionesAnio.find((o) => o.value === eq.anioEquipo)?.label ?? eq.anioEquipo)
                : null
            }
            empresaNombre={
              eq.equipoSuperAdminCompanyId
                ? eq.equipoCompaniesCatalog.find((c) => c.id === eq.equipoSuperAdminCompanyId)?.name ??
                  null
                : null
            }
            personaNombre={
              eq.filtroPersonaEquipo !== "todas"
                ? eq.equipoWorkersOpciones.find((w) => w.id === eq.filtroPersonaEquipo)?.name ?? null
                : null
            }
            servicioNombre={
              eq.equipoServiceId
                ? eq.equipoServicesCatalog.find((s) => s.id === eq.equipoServiceId)?.name ?? null
                : null
            }
            filtroExtra={eq.equipoTablaFiltroExtra}
          />

          {/* Tabla scroll */}
          <div
            ref={eq.equipoTablaScrollRef}
            className="team-hours-table-scroll isolate max-h-[min(80vh,calc(100dvh-11.5rem))] w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto border-t border-slate-100 bg-slate-50/20 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] dark:border-slate-800 dark:bg-slate-950/15 lg:max-h-[min(82vh,calc(100dvh-12.5rem))]"
            style={{
              overscrollBehaviorY: "auto",
              overscrollBehaviorX: "contain",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-[5] border-b border-slate-200/90 bg-white/90 text-xs font-semibold text-slate-600 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
                <tr>
                  {(
                    [
                      { key: "persona", label: "Persona" },
                      { key: "fecha", label: "Fecha" },
                      { key: "entrada", label: "Entrada" },
                      { key: "salida", label: "Salida" },
                    ] as const
                  ).map(({ key, label }) => (
                    <th key={key} className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => eq.setEquipoSortColumn(key)}
                        className="flex w-full items-center gap-0.5 text-left hover:text-slate-900 dark:hover:text-white"
                      >
                        {label}
                        <SortArrow sortKey={key} activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                      </button>
                    </th>
                  ))}
                  <th className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("descanso")}
                      className="flex w-full items-center gap-0.5 text-left hover:text-slate-900 dark:hover:text-white"
                    >
                      Descanso
                      <SortArrow sortKey="descanso" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                    </button>
                  </th>
                  <th
                    className="max-w-[6.5rem] px-2 py-1.5"
                    title="Campo JSON status del API"
                  >
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("estado")}
                      className="flex w-full items-center gap-0.5 text-left hover:text-slate-900 dark:hover:text-white"
                    >
                      Estado
                      <SortArrow sortKey="estado" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                    </button>
                  </th>
                  <th className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("razon")}
                      className="flex w-full items-center gap-0.5 text-left hover:text-slate-900 dark:hover:text-white"
                    >
                      Razón
                      <SortArrow sortKey="razon" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                    </button>
                  </th>
                  <th className="min-w-[8rem] max-w-[12rem] px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("modificado")}
                      className="flex w-full items-center gap-0.5 text-left hover:text-slate-900 dark:hover:text-white"
                    >
                      Modificado por
                      <SortArrow sortKey="modificado" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                    </button>
                  </th>
                  <th className="min-w-[6.5rem] whitespace-normal px-2 py-1.5 leading-tight">
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("fechaMod")}
                      className="flex w-full flex-col items-start gap-0 text-left hover:text-slate-900 dark:hover:text-white"
                    >
                      <span className="flex items-center gap-0.5">
                        Fecha
                        <SortArrow sortKey="fechaMod" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                      </span>
                      <span className="font-normal normal-case text-[10px] text-slate-400">modificación</span>
                    </button>
                  </th>
                  <th className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("duracion")}
                      className="ml-auto flex w-full items-center justify-end gap-0.5 hover:text-slate-900 dark:hover:text-white"
                    >
                      Duración
                      <SortArrow sortKey="duracion" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                    </button>
                  </th>
                  <th className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => eq.setEquipoSortColumn("extra")}
                      className="ml-auto flex w-full items-center justify-end gap-0.5 hover:text-slate-900 dark:hover:text-white"
                      title="Por encima de la jornada estándar del resumen (hoursPerWorkingDay)"
                    >
                      Extra
                      <SortArrow sortKey="extra" activeKey={eq.equipoSort.key} dir={eq.equipoSort.dir} />
                    </button>
                  </th>
                  <th
                    className="px-2 py-1.5"
                    title="Según el API (workReportId, workReportStatus, workReportLineCount)"
                  >
                    Parte en servidor
                  </th>
                  <th className="sticky right-0 z-[5] bg-white/95 px-1.5 py-1.5 text-center text-[11px] font-medium text-slate-500 shadow-[-8px_0_20px_-12px_rgba(15,23,42,0.18)] backdrop-blur-md dark:bg-slate-900/95 dark:text-slate-400">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {eq.equipoFilasVista.length === 0 ? (
                  <tr>
                    <td
                      colSpan={13}
                      className="px-3 py-5 text-center text-sm text-slate-500 dark:text-slate-400"
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
                  eq.equipoFilasVista.map((fila, rowIndex) => {
                  /* ── Fin de semana (no laboral) ── */
                  if (fila.kind === "noLaboral") {
                    const zebra = equipoTablaZebraRowClass(rowIndex);
                    const stripe = equipoTablaZebraStripeBg(rowIndex);
                    return (
                      <tr key={`nl-${fila.userId}-${fila.workDate}`} className={zebra}>
                        <td className="whitespace-nowrap px-2 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {eq.resolveEquipoPersonaNombre(fila)}
                        </td>
                        <td className="px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200">
                          {formatDateEsWeekdayDdMmYyyy(fila.workDate)}
                        </td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm align-middle">
                          <span
                            className={`${equipoTablaEtiquetaBaseClass} ${timeEntryApiStatusBadgeClass("NonWorkingDay")}`}
                          >
                            No laboral
                          </span>
                        </td>
                        <td className="max-w-[11rem] px-2 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                          {RAZON_NO_LABORAL}
                        </td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-right text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-right text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td
                          className={`sticky right-0 z-[1] align-middle border-l border-slate-200/80 px-1 py-1.5 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-slate-700 ${stripe}`}
                        >
                          {!isWorker || workerTeamHoursCanEditDate(fila.workDate) ? (
                            <EquipoTablaBotonPrimeraJornada
                              onCrearJornada={() =>
                                modal.openEquipoEditModal({
                                  workerId: fila.workerId,
                                  workDate: fila.workDate,
                                  existing: null,
                                  isWeekendFila: true,
                                  personaLabel: eq.resolveEquipoPersonaNombre(fila),
                                  targetUserId: fila.userId,
                                  irDirectoAlWizard: true,
                                })
                              }
                            />
                          ) : (
                            <span
                              className="text-xs text-slate-400 dark:text-slate-500"
                              title={`Solo editable en los últimos ${WORKER_TEAM_HOURS_EDIT_WINDOW_DAYS} días naturales.`}
                            >
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  /* ── Día laboral sin imputar ── */
                  if (fila.kind === "sinImputar") {
                    const zebra = equipoTablaZebraRowClass(rowIndex);
                    const stripe = equipoTablaZebraStripeBg(rowIndex);
                    return (
                      <tr key={`si-${fila.userId}-${fila.workDate}`} className={zebra}>
                        <td className="whitespace-nowrap px-2 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {eq.resolveEquipoPersonaNombre(fila)}
                        </td>
                        <td className="px-2 py-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                          {formatDateEsWeekdayDdMmYyyy(fila.workDate)}
                        </td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm align-middle">
                          <span
                            className={`${equipoTablaEtiquetaBaseClass} ${equipoTablaSinImputarBadgeClass}`}
                          >
                            Sin imputar
                          </span>
                        </td>
                        <td className="max-w-[11rem] px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200">
                          {RAZON_SIN_IMPUTAR}
                        </td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-right text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-right text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td
                          className={`sticky right-0 z-[1] align-middle border-l border-slate-200/80 px-1 py-1.5 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-slate-700 ${stripe}`}
                        >
                          {!isWorker || workerTeamHoursCanEditDate(fila.workDate) ? (
                            <EquipoTablaBotonPrimeraJornada
                              onCrearJornada={() =>
                                modal.openEquipoEditModal({
                                  workerId: fila.workerId,
                                  workDate: fila.workDate,
                                  existing: null,
                                  isWeekendFila: false,
                                  personaLabel: eq.resolveEquipoPersonaNombre(fila),
                                  targetUserId: fila.userId,
                                  irDirectoAlWizard: true,
                                })
                              }
                            />
                          ) : (
                            <span
                              className="text-xs text-slate-400 dark:text-slate-500"
                              title={`Solo editable en los últimos ${WORKER_TEAM_HOURS_EDIT_WINDOW_DAYS} días naturales.`}
                            >
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  /* ── Registro normal ── */
                  const e = fila.e;
                  const ausenciaPorApiStatus = isAbsenceCalendarApiStatus(e);
                  const ausenciaEtiqueta = equipoAbsenceEtiquetaKind(e);
                  const ausenciaEtiquetaVisual = ausenciaEtiqueta
                    ? equipoTablaEtiquetaAusencia(ausenciaEtiqueta)
                    : null;
                  const ocultaHoras = equipoRegistroOcultaHorasEnTabla(e);
                  const apiParte = workReportParteApiSummary(e);
                  const hasPart = !ocultaHoras && timeEntryConParteEnServidor(e);
                  const zebra = equipoTablaZebraRowClass(rowIndex);
                  const stripe = equipoTablaZebraStripeBg(rowIndex);
                  const razonClass =
                    e.razon === "imputacion_manual_error"
                      ? "rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-100"
                      : "text-slate-700 dark:text-slate-200";

                  return (
                    <tr key={`${e.id}-${e.workerId}-${e.workDate}`} className={zebra}>
                      <td className="whitespace-nowrap px-2 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {eq.resolveEquipoPersonaNombre(fila)}
                      </td>
                      <td className="min-w-[9rem] px-2 py-1.5 text-sm">
                        {formatDateEsWeekdayDdMmYyyy(e.workDate)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-sm">
                        {ocultaHoras ? "—" : formatTimeLocal(e.checkInUtc)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-sm">
                        {ocultaHoras ? "—" : formatTimeLocal(e.checkOutUtc)}
                      </td>
                      <td className="px-2 py-1.5 text-sm">
                        {ocultaHoras ? "—" : formatMinutesShort(e.breakMinutes ?? 0)}
                      </td>
                      <td className="px-2 py-1.5 text-sm align-middle">
                        {ausenciaEtiquetaVisual ? (
                          <span
                            className={`${equipoTablaEtiquetaBaseClass} ${ausenciaEtiquetaVisual.badgeClass}`}
                          >
                            {ausenciaEtiquetaVisual.label}
                          </span>
                        ) : (
                          <TimeEntryStatusBadge
                            className="text-xs"
                            status={e.timeEntryStatus}
                          />
                        )}
                      </td>
                      <td className="max-w-[12rem] px-2 py-1.5 text-sm leading-snug">
                        <span className={razonClass}>
                          {formatRazonTablaEquipo(e)}
                          {!ausenciaPorApiStatus && e.edicionNotaAdmin ? (
                            <span className="mt-0.5 block font-normal text-sm opacity-90">
                              {e.edicionNotaAdmin}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td
                        className="max-w-[15rem] px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200"
                        title={ausenciaPorApiStatus ? undefined : formatLastModifiedByUser(e)}
                      >
                        <span className="line-clamp-2 break-all">
                          {ausenciaPorApiStatus ? "—" : formatLastModifiedByUser(e)}
                        </span>
                      </td>
                      <td
                        className="whitespace-nowrap px-2 py-1.5 text-sm text-slate-600 dark:text-slate-300"
                        title={ausenciaPorApiStatus ? undefined : e.updatedAtUtc ?? ""}
                      >
                        {ausenciaPorApiStatus ? "—" : formatFechaModificacionUtc(e.updatedAtUtc)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-sm font-semibold">
                        {ocultaHoras ? "—" : formatMinutesShort(effectiveWorkMinutesEntry(e))}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-sm font-semibold">
                        {ocultaHoras
                          ? "—"
                          : (() => {
                              const xm = effectiveExtraMinutesEntry(e, eq.equipoCapTrabajoDiarioMinutos);
                              return xm > 0 ? formatMinutesShort(xm) : "—";
                            })()}
                      </td>
                      <td className="max-w-[10rem] px-2 py-1.5 text-sm leading-tight">
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
                              <span className="mt-0.5 block text-sm font-normal text-slate-500 dark:text-slate-400">
                                {apiParte.detalle}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td
                        className={`sticky right-0 z-[1] align-middle border-l border-slate-200/80 px-1 py-1.5 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] dark:border-slate-700 ${stripe}`}
                      >
                        {!isWorker || workerTeamHoursCanEditDate(e.workDate) ? (
                          <EquipoTablaAccionesDuo
                            onEditarHora={() =>
                              modal.openEquipoEditModal({
                                workerId: e.workerId,
                                workDate: e.workDate,
                                existing: e,
                                isWeekendFila: workDateIsWeekend(e.workDate),
                                personaLabel: eq.resolveEquipoPersonaNombre(fila),
                                targetUserId: e.userId ?? null,
                              })
                            }
                            onEditarParte={() => {
                              setParteEquipoValidationError(null);
                              return part.openEquipoPartEditor(e);
                            }}
                            parteDisabled={ocultaHoras || !e.checkOutUtc}
                            tieneParte={hasPart}
                          />
                        ) : (
                          <span
                            className="text-xs text-slate-400 dark:text-slate-500"
                            title={`Solo editable en los últimos ${WORKER_TEAM_HOURS_EDIT_WINDOW_DAYS} días naturales.`}
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>
          {eq.equipoRange && eq.filtroPersonaEquipo !== "todas" ? (
            <div className="border-t border-slate-100 bg-slate-50/30 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/20">
              {eq.equipoPeriodo === "anio" && (
                <p className="mb-2 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {eq.opcionesMesDentroAnioEquipo.find((o) => o.value === eq.equipoAnioMesPagina)
                    ?.label ?? ""}{" "}
                  {eq.anioEquipo}
                </p>
              )}
              <EquipoPersonaCalendario
                filas={eq.filasEquipoCalendario}
                rangeStart={
                  eq.equipoPeriodo === "anio" && eq.equipoVistaRange
                    ? eq.equipoVistaRange.start
                    : eq.equipoRange.start
                }
                rangeEnd={
                  eq.equipoPeriodo === "anio" && eq.equipoVistaRange
                    ? eq.equipoVistaRange.end
                    : eq.equipoRange.end
                }
                nombrePersona={
                  eq.equipoWorkersOpciones.find((w) => w.id === eq.filtroPersonaEquipo)?.name ??
                  String(eq.filtroPersonaEquipo)
                }
              />
            </div>
          ) : null}
        </motion.section>
      )}
            </div>

            <motion.aside
              className="w-full shrink-0 xl:sticky xl:top-2 xl:z-[2] xl:w-[min(100%,18rem)] 2xl:w-[min(100%,20rem)]"
              aria-label="Resumen visual del periodo"
              initial={{ opacity: 1, y: 0 }}
              animate={resumenAsideAnim}
            >
              {/*
                Sin max-height ni overflow en el aside: evita barra interna y recortes.
                Donas una debajo de otra; el scroll general es el de <main>.
              */}
              <section className={`${cardSurfaceClass} p-3 sm:p-3.5`}>
                <div className="border-b border-slate-100 pb-2 dark:border-slate-800">
                  <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-blue-700 dark:text-sky-300">
                    Resumen visual
                  </h2>
                  <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
                    Desglose por tipo de fichaje y objetivo frente a imputación.
                  </p>
                  {eq.equipoSummaryError ? (
                    <p className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-amber-200/90 bg-amber-50 px-2.5 py-1.5 text-xs leading-snug text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
                      {eq.equipoSummaryError}
                    </p>
                  ) : null}
                  {eq.equipoSummaryLoading ? (
                    <p className="mt-2 text-sm font-medium text-blue-800 dark:text-sky-200">
                      Cargando resumen para gráficos…
                    </p>
                  ) : null}
                </div>
                <div className="mt-2 space-y-2">
                  <div className="min-h-0 min-w-0 rounded-xl border border-slate-200/90 bg-slate-50/50 px-2 py-2.5 dark:border-slate-600/60 dark:bg-slate-900/40 sm:px-2.5">
                    <FichajeTipoRadialSummary
                      bare
                      bareStack
                      horasNormal={eq.fichajeTipoStats.horasNormal}
                      horasManual={eq.fichajeTipoStats.horasManual}
                      horasSinImputar={eq.horasSinImputarTipoFichaje}
                      registrosNormal={eq.fichajeTipoStats.registrosNormal}
                      registrosManual={eq.fichajeTipoStats.registrosManual}
                      diasSinImputar={eq.diasSinImputarEquipo}
                    />
                  </div>
                  <div className="min-h-0 min-w-0 rounded-lg border-t border-slate-200/80 bg-slate-50/80 px-1.5 py-2 pt-2.5 dark:border-slate-700/80 dark:bg-slate-950/35 sm:px-2">
                    <HorasMensualesDonut
                      bare
                      bareStack
                      horasImputadoHastaTope={eq.hDonutImputado}
                      horasFalta={eq.hDonutFalta}
                      horasExtra={eq.hDonutExtra}
                      horasObjetivo={eq.horasObjetivoMesTeorico}
                      horasImputadasTotal={eq.horasImputadasDecimal}
                      registrosEnPeriodo={eq.equipoRegistrosPeriodoKpi}
                      periodo={eq.equipoPeriodo}
                    />
                  </div>
                </div>
              </section>
            </motion.aside>
          </div>
        </div>
      </div>

      {/* ── Modal: editar día del equipo ───────────────────────── */}
      {modal.equipoModal &&
        (!isWorker || workerTeamHoursCanEditDate(modal.equipoModal.workDate)) && (
        <div
          className={`fixed inset-0 z-[100] ${MODAL_BACKDROP_CENTER}`}
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
            className={modalScrollablePanel("lg")}
            onClick={(ev) => ev.stopPropagation()}
          >
            {modal.equipoModalVista !== "wizard" ? (
              <>
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
                    <span className="ml-1 text-sm text-slate-500">(fin de semana)</span>
                  ) : null}
                </p>
              </>
            ) : null}

            {modal.equipoModalVista === "menu" ? (
              <div className="mt-5 space-y-4">
                {modal.equipoFormError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                    {modal.equipoFormError}
                  </p>
                ) : null}
                <div>
                  <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Ausencias
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={modal.equipoAbsenceSaving || modal.equipoFichajeDeleting}
                      onClick={() => void modal.guardarEquipoVacacionesOBaja("vacaciones")}
                      className="flex-1 rounded-xl border-2 border-sky-400 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900 shadow-sm transition hover:bg-sky-100 disabled:opacity-60 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-900/40"
                    >
                      {modal.equipoAbsenceSaving ? "Guardando…" : "Añadir vacaciones"}
                    </button>
                    <button
                      type="button"
                      disabled={modal.equipoAbsenceSaving || modal.equipoFichajeDeleting}
                      onClick={() => void modal.guardarEquipoVacacionesOBaja("baja")}
                      className="flex-1 rounded-xl border-2 border-violet-400 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-100 disabled:opacity-60 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/35"
                    >
                      {modal.equipoAbsenceSaving ? "Guardando…" : "Añadir baja / ausencia"}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={modal.equipoAbsenceSaving || modal.equipoFichajeDeleting}
                    onClick={() => void modal.guardarEquipoVacacionesOBaja("dia_no_laboral")}
                    className="mt-2 w-full rounded-xl border-2 border-stone-400 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 shadow-sm transition hover:bg-stone-100 disabled:opacity-60 dark:border-stone-500 dark:bg-stone-900/40 dark:text-stone-100 dark:hover:bg-stone-800/50"
                  >
                    {modal.equipoAbsenceSaving ? "Guardando…" : "Marcar día no laboral"}
                  </button>
                  <p className="mt-2 text-sm leading-snug text-slate-500 dark:text-slate-400">
                    Vacaciones, baja o día no laboral: si ya había horario imputado, se guardará en{" "}
                    <strong>Entrada/Salida (antes)</strong>. La fila quedará marcada y se registrará quién
                    modificó.
                  </p>
                </div>
                <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                  <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Jornada laboral
                  </p>
                  <button
                    type="button"
                    disabled={modal.equipoAbsenceSaving || modal.equipoFichajeDeleting}
                    onClick={() => modal.enterEquipoHorarioWizard()}
                    className="w-full rounded-xl border-2 border-agro-500 bg-agro-50 px-4 py-3 text-sm font-semibold text-agro-900 shadow-sm transition hover:bg-agro-100 disabled:opacity-60 dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-50 dark:hover:bg-emerald-900"
                  >
                    Modificar horario (imputación manual)
                  </button>
                  <p className="mt-2 text-sm leading-snug text-slate-500 dark:text-slate-400">
                    Mismo asistente que en <strong>Registro de jornada</strong> (entrada, salida,
                    descanso). Al finalizar se guarda en el servidor como jornada cerrada (RRHH).
                  </p>
                  <button
                    type="button"
                    disabled={
                      modal.equipoAbsenceSaving ||
                      modal.equipoFichajeDeleting ||
                      !(
                        typeof modal.equipoModal.existing?.timeEntryId === "string" &&
                        modal.equipoModal.existing.timeEntryId.trim().length > 0
                      )
                    }
                    title={
                      typeof modal.equipoModal.existing?.timeEntryId === "string" &&
                      modal.equipoModal.existing.timeEntryId.trim().length > 0
                        ? undefined
                        : "No hay fila de fichaje en el servidor para este día"
                    }
                    onClick={() => void modal.eliminarEquipoFichaje()}
                    className="mt-2 w-full rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900 shadow-sm transition hover:bg-red-100 disabled:opacity-60 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-900/45"
                  >
                    {modal.equipoFichajeDeleting ? "Eliminando…" : "Eliminar fichaje"}
                  </button>
                  <p className="mt-2 text-sm leading-snug text-slate-500 dark:text-slate-400">
                    Borra la fila de fichaje del día en el servidor (por ejemplo, si se imputó por error).
                    Si el backend exige condiciones adicionales, verás el mensaje de error arriba.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={modal.equipoAbsenceSaving || modal.equipoFichajeDeleting}
                  onClick={modal.cerrarEquipoModal}
                  className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="mt-2">
                {modal.horarioWizardSaving ? (
                  <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">Guardando…</p>
                ) : null}
                <ForgotModal
                  variant="embedded"
                  step={modal.horarioWizardStep}
                  targetDate={modal.equipoModal.workDate}
                  today={localTodayISO()}
                  soloTime="09:00"
                  fullStart={modal.horarioFullStart}
                  fullEnd={modal.horarioFullEnd}
                  forgotMode={modal.horarioWizardForgotMode}
                  fullBreakMins={modal.horarioFullBreakMins}
                  fullBreakCustom={modal.horarioFullBreakCustom}
                  breakOtro={modal.horarioBreakOtro}
                  error={modal.horarioWizardError}
                  onClose={modal.cerrarEquipoModal}
                  onSetStep={modal.setHorarioWizardStep}
                  onSetError={modal.setHorarioWizardError}
                  onSetTargetDate={modal.setHorarioWizardTargetDate}
                  onSetSoloTime={() => {}}
                  onSetFullStart={modal.setHorarioFullStart}
                  onSetFullEnd={modal.setHorarioFullEnd}
                  onSetForgotMode={modal.setHorarioWizardForgotMode}
                  onSetFullBreakMins={modal.setHorarioFullBreakMins}
                  onSetFullBreakCustom={modal.setHorarioFullBreakCustom}
                  onSetBreakOtro={modal.setHorarioBreakOtro}
                  onSubmitSoloEntrada={() => {}}
                  onSubmitJornadaCompleta={(forced) =>
                    void modal.submitEquipoHorarioJornadaCompleta(forced)
                  }
                  onBackFromFullStartOverride={modal.volverEquipoHorarioWizardAMenu}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: editar parte de trabajo ─────────────────────── */}
      {part.equipoPartModal &&
        (!isWorker || workerTeamHoursCanEditDate(part.equipoPartModal.workDate)) && (
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
