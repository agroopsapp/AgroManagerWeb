"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  animate,
  motion,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
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
import { EquipoCumplimientoSemanalHeatmap } from "@/features/time-tracking/components/EquipoCumplimientoSemanalHeatmap";
import { EquipoCumplimientoPartesHeatmap } from "@/features/time-tracking/components/EquipoCumplimientoPartesHeatmap";
import {
  EquipoTablaAccionesDuo,
  EquipoTablaBotonPrimeraJornada,
} from "@/features/time-tracking/components/EquipoTablaAccionesIconos";
import { TimeEntryStatusBadge } from "@/features/time-tracking/components/TimeEntryStatusBadge";
import { EquipoRegistrosFiltrosEtiquetas } from "@/features/time-tracking/components/EquipoRegistrosFiltrosEtiquetas";
import {
  KpiIconAlert,
  KpiIconClipboardCheck,
  KpiIconClock,
  KpiIconUsers,
} from "@/components/icons/KpiLineIcons";

const EquipoPartModal = dynamic(
  () => import("@/features/time-tracking/components/EquipoPartModal").then((m) => m.EquipoPartModal),
  { ssr: false },
);

/** Campos de filtro: borde suave, foco discreto (patrón SaaS). */
/** Tarjeta base: una sola “capa” visual, sin competir con contenido interno. */
const cardSurfaceClass = "agro-surface rounded-3xl";

const FILTER_ANIM_EASE_OUT = [0.16, 1, 0.3, 1] as const;
const FILTER_ANIM_EASE_IN = [0.4, 0, 0.2, 1] as const;

/** Worker: edición en «Fichajes y partes» solo en los últimos N días naturales (incluye sábados y domingos). */
const WORKER_TEAM_HOURS_EDIT_WINDOW_DAYS = 7;

/** Vista compacta de la tabla de registros antes de expandir (mismos filtros / ordenación). */
const TEAM_HOURS_TABLA_PREVIEW_ROWS = 7;

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
// AnimatedNumber: transición suave entre valores (count up/down) sin saltos.
// ---------------------------------------------------------------------------
function AnimatedNumber({
  value,
  format,
  duration = 0.55,
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
}) {
  const fmt = format ?? ((v: number) => Math.round(v).toLocaleString("es-ES"));
  const [display, setDisplay] = useState<number>(Number.isFinite(value) ? value : 0);
  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    const controls = animate(display, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  return <>{fmt(display)}</>;
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
  const [hoyDrawerOpen, setHoyDrawerOpen] = useState(false);
  const [hoyUseToday, setHoyUseToday] = useState(true);
  /** Tabla de registros: por defecto solo las primeras N filas del resultado filtrado. */
  const [tablaRegistrosVerTodos, setTablaRegistrosVerTodos] = useState(false);
  /** Resumen KPI superior: tarjetas (1) o barras (2). */
  const [equipoKpiPagina, setEquipoKpiPagina] = useState<0 | 1>(0);
  // Marcado = comportamiento habitual: ocultar excluidos del fichaje.
  const [ocultarExcluidosFichaje, setOcultarExcluidosFichaje] = useState(true);
  /** Solo escritorio (lg+): montar filtros en columna lateral; en móvil se abren con un FAB. */
  const [teamHoursIsLgLayout, setTeamHoursIsLgLayout] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false,
  );
  /** Móvil/tablet (<lg): controla la visibilidad del panel de filtros que se abre desde el FAB. */
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { user, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace("/login");
  }, [user, isReady, router]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setTeamHoursIsLgLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /* En cuanto pasamos a layout lg+ los filtros viven en la columna lateral,
     así que cerramos el panel móvil para evitar dos filtros visibles a la vez. */
  useEffect(() => {
    if (teamHoursIsLgLayout && mobileFiltersOpen) setMobileFiltersOpen(false);
  }, [teamHoursIsLgLayout, mobileFiltersOpen]);

  /* Cerrar el panel móvil con Escape — patrón estándar de bottom-sheet/modal. */
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileFiltersOpen]);

  const eq = useEquipo({
    enableEquipoCompanyFilter:
      user?.role === USER_ROLE.SuperAdmin ||
      user?.role === USER_ROLE.Manager ||
      user?.role === USER_ROLE.Admin,
    includeExcludedFromTimeTracking: !ocultarExcluidosFichaje,
  });

  /**
   * Panel "hoy" (siempre): usa el mismo hook/endpoints pero fijando periodo=dia y fecha=hoy.
   * Así no dependemos del periodo actual (mes/año) y mantenemos datos reales.
   */
  const eqHoy = useEquipo({
    enableEquipoCompanyFilter:
      user?.role === USER_ROLE.SuperAdmin ||
      user?.role === USER_ROLE.Manager ||
      user?.role === USER_ROLE.Admin,
    includeExcludedFromTimeTracking: !ocultarExcluidosFichaje,
  });

  useEffect(() => {
    // Fijar a "hoy" y copiar el alcance actual (empresa/servicio) para que el panel respete el filtro lateral.
    eqHoy.setEquipoPeriodo("dia");
    eqHoy.setFiltroPersonaEquipo("todas");
    eqHoy.setEquipoSuperAdminCompanyId(eq.equipoSuperAdminCompanyId ?? null);
    eqHoy.setEquipoServiceId(eq.equipoServiceId ?? null);
    if (hoyUseToday) {
      eqHoy.setEquipoDia(localTodayISO());
    } else {
      // Si el usuario activó el selector de fecha, respetamos su valor actual (o inicializamos a hoy si está vacío).
      eqHoy.setEquipoDia(eqHoy.equipoDia || localTodayISO());
    }
    // No aplicamos "vista rápida" aquí: la tarjeta de hoy debe mostrar el estado completo del día.
    // (Si se desea, se puede mapear `eq.equipoTablaFiltroExtra` a eqHoy en el futuro.)
  }, [
    eqHoy,
    eq.equipoSuperAdminCompanyId,
    eq.equipoServiceId,
    eqHoy.equipoDia,
    hoyUseToday,
  ]);

  useEffect(() => {
    // Evita quedarse con una persona que ya no existe en el combo al cambiar el modo.
    eq.setFiltroPersonaEquipo("todas");
  }, [ocultarExcluidosFichaje]);

  useWheelScrollChain(eq.equipoTablaScrollRef, eq.diasCalendarioMesEquipo.length > 0);

  useEffect(() => {
    setTablaRegistrosVerTodos(false);
  }, [
    eq.equipoPeriodo,
    eq.equipoDia,
    eq.equipoSemana,
    eq.mesEquipo,
    eq.trimestreEquipo,
    eq.anioEquipo,
    eq.equipoAnioMesPagina,
    eq.filtroPersonaEquipo,
    eq.equipoSuperAdminCompanyId,
    eq.equipoServiceId,
    eq.equipoTablaFiltroExtra,
    ocultarExcluidosFichaje,
  ]);

  /**
   * Altura del contenedor de scroll de la tabla:
   * - Compacto: solo se ven ~7 filas; el resto es scrollable dentro del propio grid.
   * - Expandido: ocupa hasta 82vh (comportamiento original).
   * El alto compacto incluye `thead` sticky + 7 filas + un pequeño margen.
   */
  const tablaRegistrosScrollClass = tablaRegistrosVerTodos
    ? "max-h-none lg:max-h-[min(82vh,calc(100dvh-12.5rem))] lg:overflow-y-auto"
    : "max-h-[26rem] overflow-y-auto";

  /**
   * Refetch combinado: la rejilla principal (`eq`) y el panel "Resumen equipo" (`eqHoy`)
   * son dos instancias independientes de useEquipo. Al editar/crear desde la rejilla,
   * hay que refrescar ambas para que la tarjeta del día se actualice sin recargar la página.
   */
  const refetchEquipoRowsAll = useCallback(() => {
    eq.refetchEquipoRows();
    eqHoy.refetchEquipoRows();
  }, [eq.refetchEquipoRows, eqHoy.refetchEquipoRows]);

  const setEquipoPartsVersionAll = useCallback<React.Dispatch<React.SetStateAction<number>>>(
    (updater) => {
      eq.setEquipoPartsVersion(updater);
      eqHoy.setEquipoPartsVersion(updater);
    },
    [eq.setEquipoPartsVersion, eqHoy.setEquipoPartsVersion],
  );

  const part = useEquipoPart({
    setEquipoPartsVersion: setEquipoPartsVersionAll,
    refetchEquipoRows: refetchEquipoRowsAll,
    onValidationError: setParteEquipoValidationError,
  });

  const modal = useEquipoModal({
    user,
    equipoTablaScrollRef: eq.equipoTablaScrollRef,
    equipoRestaurarScroll: eq.equipoRestaurarScroll,
    equipoMarcarRestaurarScroll: eq.equipoMarcarRestaurarScroll,
    refetchEquipoRows: refetchEquipoRowsAll,
    equipoWorkersCatalog: eq.equipoWorkersOpciones,
    equipoSuperAdminCompanyId: eq.equipoSuperAdminCompanyId,
    onHorarioJornadaCompletaGuardada: async (entry) => {
      setParteEquipoValidationError(null);
      await part.openEquipoPartEditor(entry);
    },
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

    /**
     * Transición "in-place" al cambiar filtros:
     * - No mueve el scroll (la página se queda donde está).
     * - Crossfade muy ligero + pequeño desplazamiento (no parece una recarga).
     * - Animaciones paralelas con stagger mínimo, total < ~0.45 s.
     */
    const transReset = {
      opacity: 1,
      y: 0,
      scaleY: 1,
      transition: { duration: 0.28, ease: FILTER_ANIM_EASE_OUT },
    } as const;

    const stopAll = () => {
      kpiBlockAnim.stop();
      objetivoBlockAnim.stop();
      registrosBlockAnim.stop();
      resumenAsideAnim.stop();
    };

    if (reduceMotion) {
      stopAll();
      void kpiBlockAnim.start(transReset);
      void objetivoBlockAnim.start(transReset);
      void registrosBlockAnim.start(transReset);
      void resumenAsideAnim.start(transReset);
      return;
    }

    let alive = true;

    const run = async () => {
      stopAll();

      // Salida sutil (no se "vacía" la página: opacidad mínima 0.94)
      await Promise.all([
        kpiBlockAnim.start({
          opacity: 0.94,
          y: 3,
          transition: { duration: 0.14, ease: FILTER_ANIM_EASE_IN },
        }),
        objetivoBlockAnim.start({
          opacity: 0.94,
          y: 3,
          transition: { duration: 0.14, ease: FILTER_ANIM_EASE_IN },
        }),
        registrosBlockAnim.start({
          opacity: 0.92,
          y: 4,
          scaleY: 0.995,
          transition: { duration: 0.16, ease: FILTER_ANIM_EASE_IN },
        }),
        resumenAsideAnim.start({
          opacity: 0.94,
          y: 3,
          transition: { duration: 0.14, ease: FILTER_ANIM_EASE_IN },
        }),
      ]);
      if (!alive) return;

      // Entrada en paralelo con stagger mínimo: sensación de "actualizado", no de recarga
      await Promise.all([
        kpiBlockAnim.start({
          opacity: 1,
          y: 0,
          transition: { duration: 0.32, ease: FILTER_ANIM_EASE_OUT, delay: 0 },
        }),
        objetivoBlockAnim.start({
          opacity: 1,
          y: 0,
          transition: { duration: 0.32, ease: FILTER_ANIM_EASE_OUT, delay: 0.04 },
        }),
        registrosBlockAnim.start({
          opacity: 1,
          y: 0,
          scaleY: 1,
          transition: { duration: 0.36, ease: FILTER_ANIM_EASE_OUT, delay: 0.06 },
        }),
        resumenAsideAnim.start({
          opacity: 1,
          y: 0,
          transition: { duration: 0.32, ease: FILTER_ANIM_EASE_OUT, delay: 0.08 },
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

  const hoyResumen = useMemo(() => {
    const diaSeleccionado = hoyUseToday ? localTodayISO() : (eqHoy.equipoDia || localTodayISO());
    const filas = eqHoy.equipoFilasVista;

    let empezadas = 0;
    let vacaciones = 0;
    let baja = 0;
    let noLaboral = 0;
    let sinFichar = 0;
    let sinParte = 0;
    let itemsTarjeta = 0;

    for (const f of filas) {
      const workDate =
        f.kind === "registro"
          ? f.e.workDate
          : f.kind === "noLaboral" || f.kind === "sinImputar"
            ? f.workDate
            : null;
      if (!workDate || workDate !== diaSeleccionado) continue;

      if (f.kind === "noLaboral") {
        // No laboral (fin de semana / festivo de rejilla) NO se muestra en el panel.
        noLaboral += 1;
        continue;
      }
      if (f.kind === "sinImputar") {
        sinFichar += 1;
        itemsTarjeta += 1;
        continue;
      }
      if (f.kind !== "registro") continue;
      const e = f.e;
      const abs = equipoAbsenceEtiquetaKind(e);
      if (e.checkInUtc) empezadas += 1;
      if (abs === "vacaciones") {
        vacaciones += 1;
        itemsTarjeta += 1;
        continue;
      }
      if (abs === "baja") {
        baja += 1;
        itemsTarjeta += 1;
        continue;
      }
      if (abs === "no_laboral") {
        // Día no laborable a nivel de registro: tampoco se muestra.
        continue;
      }

      // Si han fichado, solo mostramos los que NO tienen parte creado.
      // Si han fichado y tienen parte: NO se muestra.
      if (e.checkInUtc && !timeEntryConParteEnServidor(e)) {
        sinParte += 1;
        itemsTarjeta += 1;
      }
    }

    const pendientesCriticos = sinFichar + sinParte;
    return {
      diaSeleccionado,
      filas,
      counts: { empezadas, vacaciones, baja, noLaboral, sinFichar, sinParte, pendientesCriticos, itemsTarjeta },
    };
  }, [eqHoy.equipoFilasVista, eqHoy.equipoDia, hoyUseToday]);

  function TeamHoursFiltrosInner() {
    return (
      <div className="space-y-3">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h2 className="agro-section-title">Filtros</h2>
                <button
                  type="button"
                  onClick={() => eq.equipoBorrarFiltrosAlcance()}
                  disabled={
                    eq.filtroPersonaEquipo === "todas" &&
                    !eq.equipoSuperAdminCompanyId?.trim() &&
                    !eq.equipoServiceId?.trim() &&
                    eq.equipoTablaFiltroExtra === "ninguno"
                  }
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  title="Quitar empresa, persona, servicio y vista rápida (el periodo no cambia)"
                >
                  Borrar filtros
                </button>
              </div>
              <p className="agro-muted mt-1 leading-snug">
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

          {user!.role === USER_ROLE.SuperAdmin ||
          user!.role === USER_ROLE.Manager ||
          user!.role === USER_ROLE.Admin ? (
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

          {user!.role === USER_ROLE.SuperAdmin ||
          user!.role === USER_ROLE.Manager ||
          user!.role === USER_ROLE.Admin ? (
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
            <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
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
                    "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-200",
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
                    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-200",
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
                    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-200",
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
                <p className="agro-muted leading-snug">
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
                  className="w-full rounded-xl border border-emerald-700/30 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-100 dark:hover:bg-emerald-950/50"
                >
                  {exportPartesBundleLoading ? "Generando PDF…" : "PDF partes + fichajes"}
                </button>
                {exportPartesBundleError ? (
                  <p className="text-[11px] font-medium leading-snug text-rose-700 dark:text-rose-200">
                    {exportPartesBundleError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
    );
  }

  function TeamHoursEquipoKpiSection({ idSuffix }: { idSuffix: string }) {
    const cumplimientoPct = useMemo(() => {
      const objetivo = Number(eq.horasObjetivoMesTeorico ?? 0);
      const imputadas = Number(eq.horasImputadasDecimal ?? 0);
      if (!objetivo || objetivo <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round((imputadas / objetivo) * 100)));
    }, [eq.horasImputadasDecimal, eq.horasObjetivoMesTeorico]);

    /**
     * Donut con conic-gradient animado: actualizamos la `bg` cada frame con
     * useMotionValue → useTransform, así no hay saltos al cambiar filtros.
     */
    const cumplimientoMv = useMotionValue(cumplimientoPct);
    useEffect(() => {
      const controls = animate(cumplimientoMv, cumplimientoPct, {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      });
      return () => controls.stop();
    }, [cumplimientoPct, cumplimientoMv]);
    const cumplimientoRingBg = useTransform(
      cumplimientoMv,
      (v) => `conic-gradient(#4ade80 ${v * 3.6}deg, rgba(255,255,255,0.10) 0deg)`,
    );

    /**
     * IMPORTANTe: este panel debe seguir el filtro lateral (incluida la "vista rápida"),
     * así que derivamos contadores/KPIs desde `eq.equipoFilasVista`.
     */
    const kpiScope = useMemo(() => {
      // Periodo "Año": el proyecto define que el summary/gráficos usan el año completo,
      // mientras la tabla es un mes. Aquí respetamos esa norma usando el summary.
      if (eq.equipoPeriodo === "anio" && eq.equipoSummary?.kpiTeamGrid) {
        const g = eq.equipoSummary.kpiTeamGrid;
        const jornadasLaborables = Math.max(0, Math.round(g.laborablePersonDaySlots ?? 0));
        const jornadasFichadas = Math.max(
          0,
          Math.round(
            (g.slotsWithAnyTimeEntry > 0 ? g.slotsWithAnyTimeEntry : g.slotsWithClosedTimeEntry) ?? 0,
          ),
        );
        const sinFichar = Math.max(0, Math.round(g.slotsWithoutEntry ?? 0));
        const jornadasCerradas = Math.max(0, Math.round(g.slotsWithClosedTimeEntry ?? 0));
        const partesCompletados = Math.max(0, Math.round(g.closedEntriesWithServerPart ?? 0));
        const sinParte = Math.max(0, Math.round(g.closedEntriesWithoutServerPart ?? 0));
        const minutosImputados = Math.max(0, Math.round(eq.equipoSummary.workedMinutesTotal ?? 0));

        const jornadasFichadasPct =
          jornadasLaborables > 0 ? Math.round((jornadasFichadas / jornadasLaborables) * 100) : 0;
        const partesPct =
          jornadasCerradas > 0 ? Math.round((partesCompletados / jornadasCerradas) * 100) : 0;

        return {
          haFichado: jornadasFichadas,
          sinFichar,
          // En summary no tenemos "vacaciones" desglosado; lo dejamos en 0 para año.
          vacaciones: 0,
          sinParte,
          minutosImputados,
          jornadasLaborables,
          jornadasFichadas,
          jornadasCerradas,
          partesCompletados,
          jornadasFichadasPct,
          partesPct,
        };
      }

      let haFichado = 0;
      let sinFichar = 0;
      let vacaciones = 0;
      let sinParte = 0;

      let jornadasLaborables = 0;
      let jornadasFichadas = 0;
      let jornadasCerradas = 0;
      let partesCompletados = 0;

      let minutosImputados = 0;

      for (const fila of eq.equipoFilasVista) {
        if (fila.kind === "sinImputar") {
          sinFichar += 1;
          jornadasLaborables += 1;
          continue;
        }
        if (fila.kind !== "registro") continue;

        jornadasLaborables += 1;
        jornadasFichadas += 1;
        haFichado += 1;

        const e = fila.e;
        const ausencia = equipoAbsenceEtiquetaKind(e);
        if (ausencia === "vacaciones") vacaciones += 1;

        if (e.checkOutUtc) {
          jornadasCerradas += 1;
          if (timeEntryConParteEnServidor(e)) partesCompletados += 1;
          else sinParte += 1;
        }

        minutosImputados += effectiveWorkMinutesEntry(e);
      }

      const jornadasFichadasPct =
        jornadasLaborables > 0 ? Math.round((jornadasFichadas / jornadasLaborables) * 100) : 0;
      const partesPct =
        jornadasCerradas > 0 ? Math.round((partesCompletados / jornadasCerradas) * 100) : 0;

      return {
        haFichado,
        sinFichar,
        vacaciones,
        sinParte,
        minutosImputados,
        jornadasLaborables,
        jornadasFichadas,
        jornadasCerradas,
        partesCompletados,
        jornadasFichadasPct,
        partesPct,
      };
    }, [eq.equipoFilasVista]);

    return (
      <motion.section
        className={`${cardSurfaceClass} overflow-hidden`}
        initial={{ opacity: 1, y: 0 }}
        animate={kpiBlockAnim}
      >
        <div
          className="relative overflow-hidden bg-gradient-to-r from-emerald-950 via-emerald-950 to-emerald-900 px-5 py-5 text-emerald-50"
        >
          {/* Fondo fotográfico difuminado (premium) */}
          <div
            className="absolute inset-0 scale-[1.08] bg-center bg-cover opacity-[0.38] blur-[6px] saturate-[1.08] contrast-[1.03]"
            style={{ backgroundImage: "url('/login-bg.png')" }}
            aria-hidden
          />
          {/* Velo oscuro para mantener contraste */}
          <div className="absolute inset-0 bg-emerald-950/35" aria-hidden />
          <div className="absolute inset-0 opacity-[0.14]" aria-hidden>
            <div className="h-full w-full bg-[radial-gradient(circle_at_20%_30%,rgba(74,222,128,0.35),transparent_50%),radial-gradient(circle_at_80%_40%,rgba(34,197,94,0.25),transparent_45%),linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent)]" />
          </div>

          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200/85">
              {(() => {
                const nombrePersona =
                  eq.filtroPersonaEquipo !== "todas"
                    ? eq.equipoWorkersOpciones.find((w) => w.id === eq.filtroPersonaEquipo)?.name ??
                      String(eq.filtroPersonaEquipo)
                    : null;
                const sujeto = nombrePersona ? `Estado de ${nombrePersona}` : "Estado del equipo";
                switch (eq.equipoPeriodo) {
                  case "dia":
                    return `${sujeto} · Día`;
                  case "semana":
                    return `${sujeto} · Semana`;
                  case "mes":
                    return `${sujeto} · Mes`;
                  case "trimestre":
                    return `${sujeto} · Trimestre`;
                  case "anio":
                    return `${sujeto} · Año`;
                  default:
                    return sujeto;
                }
              })()}
              {periodoEtiqueta ? (
                <span className="ml-2 normal-case tracking-normal text-emerald-100/70">
                  · {periodoEtiqueta}
                </span>
              ) : null}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[26rem_1px_minmax(0,1fr)] lg:items-center">
              {/* Bloque izquierdo: donut + lista */}
              <div className="flex items-center gap-6">
                <motion.div
                  className="relative h-[148px] w-[148px] shrink-0 rounded-full p-[12px]"
                  style={{ background: cumplimientoRingBg }}
                >
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-emerald-950/70 ring-1 ring-white/10">
                    <span className="text-4xl font-semibold tracking-tight tabular-nums text-white">
                      <AnimatedNumber value={cumplimientoPct} format={(v) => `${Math.round(v)}%`} />
                    </span>
                    <span className="mt-1 text-[11px] font-semibold leading-tight text-emerald-50/80">
                      Cumplimiento
                      <br />
                      {(() => {
                        switch (eq.equipoPeriodo) {
                          case "dia":
                            return "del día";
                          case "semana":
                            return "de la semana";
                          case "mes":
                            return "del mes";
                          case "trimestre":
                            return "del trimestre";
                          case "anio":
                            return "del año";
                          default:
                            return "del periodo";
                        }
                      })()}
                    </span>
                  </div>
                </motion.div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 ring-1 ring-white/10">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                    <span className="tabular-nums font-semibold text-white">
                      <AnimatedNumber value={kpiScope.haFichado} />
                    </span>
                    <span className="text-sm text-emerald-50/80">Ha fichado</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 ring-1 ring-white/10">
                    <span className="h-2 w-2 rounded-full bg-rose-400" aria-hidden />
                    <span className="tabular-nums font-semibold text-white">
                      <AnimatedNumber value={kpiScope.sinFichar} />
                    </span>
                    <span className="text-sm text-emerald-50/80">Sin fichar</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 ring-1 ring-white/10">
                    <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
                    <span className="tabular-nums font-semibold text-white">
                      <AnimatedNumber value={kpiScope.vacaciones} />
                    </span>
                    <span className="text-sm text-emerald-50/80">Vacaciones</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 ring-1 ring-white/10">
                    <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                    <span className="tabular-nums font-semibold text-white">
                      <AnimatedNumber value={kpiScope.sinParte} />
                    </span>
                    <span className="text-sm text-emerald-50/80">Sin parte</span>
                  </div>
                </div>
              </div>

              <div className="hidden h-24 w-px bg-white/12 lg:block" aria-hidden />

              {/* Bloque derecho: 4 KPIs (como mock: icono arriba centrado) */}
              <div className="min-w-0">
                <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
                  <div className="flex min-w-0 flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5">
                      <KpiIconClock className="text-white/85" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
                      <AnimatedNumber
                        value={kpiScope.minutosImputados}
                        format={(v) => formatMinutesShort(Math.round(v))}
                      />
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-50/90">Horas imputadas</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-emerald-50/70">
                      de {Number(eq.horasObjetivoMesTeorico ?? 0).toLocaleString("es-ES")} h objetivo
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5">
                      <KpiIconUsers className="text-white/85" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
                      <AnimatedNumber value={kpiScope.jornadasFichadas} />{" "}
                      <span className="text-white/70">/</span>{" "}
                      <AnimatedNumber value={kpiScope.jornadasLaborables} />
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-50/90">Jornadas fichadas</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-emerald-50/70">
                      <AnimatedNumber
                        value={kpiScope.jornadasFichadasPct}
                        format={(v) => `${Math.round(v)}`}
                      />
                      % del equipo
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5">
                      <KpiIconClipboardCheck className="text-white/85" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
                      <AnimatedNumber value={kpiScope.partesCompletados} />{" "}
                      <span className="text-white/70">/</span>{" "}
                      <AnimatedNumber value={kpiScope.jornadasCerradas} />
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-50/90">Partes completados</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-emerald-50/70">
                      <AnimatedNumber
                        value={kpiScope.partesPct}
                        format={(v) => `${Math.round(v)}`}
                      />
                      % del equipo
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5">
                      <KpiIconAlert className="text-white/85" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
                      <AnimatedNumber value={kpiScope.sinFichar} />
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-50/90">Sin imputar</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-emerald-50/70">
                      requiere revisión
                    </p>
                  </div>
                </div>

                {/* Control de vista (1/2) eliminado: panel fijo como el mock */}
              </div>
            </div>
          </div>
        </div>
      </motion.section>
    );
  }

  function TeamHoursObjetivoCard() {
    return (
      <motion.section
        className={`${cardSurfaceClass} p-3 sm:p-4`}
        initial={{ opacity: 1, y: 0 }}
        animate={objetivoBlockAnim}
        aria-label="Objetivo del periodo e imputación"
      >
        <EquipoObjetivoMesEncabezado
          diasLaborables={eq.diasLaborablesMesEquipo}
          personasEnObjetivo={eq.personasEnObjetivo}
          horasObjetivo={eq.horasObjetivoMesTeorico}
          filtroTodasPersonas={eq.filtroPersonaEquipo === "todas"}
          periodo={eq.equipoPeriodo}
          compact
        />
        <EquipoBarraLaboralesExtra
          horasObjetivo={eq.horasObjetivoMesTeorico}
          horasImputadasLabor={eq.hDonutImputado}
          horasFalta={eq.horasFaltaParaObjetivo}
          horasExtra={eq.hDonutExtra}
          horasImputadasTotal={eq.horasImputadasDecimal}
          compact
          hideTotalImputado
        />
      </motion.section>
    );
  }

  return (
    <div className="min-w-0 max-w-full pb-24 lg:pb-6">
      <header className="space-y-3 pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-1">
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
          <p className="agro-kicker">Centro de control · Equipo, fichajes y partes</p>
          <h1 className="agro-h1">Fichajes y partes del equipo</h1>
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

          {/* Fecha de hoy retirada: la información de periodo ya está en el cuadro verde "Estado del equipo". */}
        </div>

        {null}
      </header>

      {/* ── Layout principal ─────────────────────────────────────────────────
          Decisión clave: en xl+ el wrapper exterior es `flex-row` con dos
          columnas hermanas — el **grid principal** (filtros + barra verde + main)
          y el **aside derecho**. Antes el aside vivía DENTRO del grid con
          `xl:row-span-2`, lo que provocaba que cuando el aside crecía (calendario,
          tarjetas) las dos filas del grid se estiraran y aparecía un hueco vacío
          entre la barra verde y los filtros. Sacándolo del grid, su altura es
          independiente y no afecta a la fila izquierda.
       */}
      {/* Barra verde KPI — versión móvil (<lg): primer elemento visible.
          Se duplica fuera del grid para garantizar que aparezca antes del aside
          (que en móvil tiene `order-first`). En lg+ se oculta y la versión
          de dentro del grid (col-span-2 row 1) es la que se muestra. */}
      <div className="mb-4 lg:hidden">
        <TeamHoursEquipoKpiSection idSuffix="-mobile" />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-4">

        {/* Grid principal (lg+: 2 cols filtros + main; en sm: stack). */}
        <div className="flex flex-col gap-4 lg:flex-1 lg:min-w-0 lg:grid lg:grid-cols-[16.25rem_minmax(0,1fr)] lg:items-stretch lg:gap-4">

        {/* ── Fila 1: Barra verde (cols 1-2 en lg+; oculta en <lg porque arriba ya
            renderizamos otra instancia móvil para que sea el primer elemento). ── */}
        <div className="hidden min-h-0 min-w-0 lg:col-span-2 lg:row-start-1 lg:block">
          <TeamHoursEquipoKpiSection idSuffix="" />
        </div>

        {/* ── Panel de filtros lateral (solo lg+; en móvil: `<details>` encima del grid) ───────── */}
        {teamHoursIsLgLayout ? (
          <div className="min-h-0 min-w-0 lg:col-start-1 lg:row-start-2">
            <aside
              aria-label="Filtros de la vista"
              className={`${cardSurfaceClass} p-3 lg:sticky lg:top-3`}
            >
              <TeamHoursFiltrosInner />
            </aside>
          </div>
        ) : null}

        {/* En móvil/tablet los filtros viven en un panel flotante (FAB + bottom-sheet)
            que se monta al final del componente, fuera del flujo del grid. */}

        {/* ── Contenido principal (fila 2, col 2): actividad + registros ── */}
        <div className="min-h-0 min-w-0 space-y-3 lg:col-start-2 lg:row-start-2">

          {/* El calendario de la persona se ha movido a la columna derecha (recuadro tras "Resumen del periodo"). */}

          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:gap-3">
            <div className="min-h-0 min-w-0 flex-1 space-y-3">
              {teamHoursIsLgLayout ? <TeamHoursObjetivoCard /> : null}

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
          <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/15 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <h2 className="agro-section-title">Registros</h2>
              <p className="agro-muted mt-0.5">
                Tabla del periodo actual con acciones por fila.
              </p>
            </div>
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
                    title: `Fichajes y partes — ${periodoEtiqueta}`,
                    fileBaseName,
                  });
                }}
                className="agro-btn-primary"
                title="Exporta la tabla actual (filtros incluidos)"
              >
                <span aria-hidden className="opacity-90">
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

          {eq.equipoFilasVista.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/25">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                  {eq.equipoFilasVista.length}
                </span>{" "}
                {eq.equipoFilasVista.length === 1 ? "registro" : "registros"} en el filtro actual
                {!tablaRegistrosVerTodos && eq.equipoFilasVista.length > TEAM_HOURS_TABLA_PREVIEW_ROWS
                  ? " · desliza dentro del grid para ver el resto."
                  : "."}
              </p>
              {eq.equipoFilasVista.length > TEAM_HOURS_TABLA_PREVIEW_ROWS ? (
                <button
                  type="button"
                  onClick={() => setTablaRegistrosVerTodos((v) => !v)}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {tablaRegistrosVerTodos ? "Compactar grid" : "Expandir grid"}
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Tabla scroll (sticky thead: NO usar overflow-x:hidden en el mismo ancestro que sticky) */}
          <div
            ref={eq.equipoTablaScrollRef}
            className={`team-hours-table-scroll isolate w-full min-w-0 max-w-full overflow-x-auto border-t border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950/15 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y] ${tablaRegistrosScrollClass}`}
            style={{
              overscrollBehaviorY: "auto",
              overscrollBehaviorX: "contain",
            }}
          >
            <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-[15] border-b border-slate-200/90 bg-white/95 text-xs font-semibold text-slate-600 shadow-[0_1px_0_rgba(15,23,42,0.06)] backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 dark:shadow-[0_1px_0_rgba(0,0,0,0.35)]">
                <tr>
                  {(
                    [
                      { key: "persona", label: "Trabajador" },
                      { key: "fecha", label: "Fecha" },
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
                  {(
                    [
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
                  <th className="sticky top-0 right-0 z-[20] bg-white/95 px-1.5 py-1.5 text-center text-[11px] font-medium text-slate-500 shadow-[-8px_0_20px_-12px_rgba(15,23,42,0.18)] backdrop-blur-md dark:bg-slate-900/95 dark:text-slate-400">
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
                        <td className="px-2 py-1.5 text-sm align-middle">
                          <span
                            className={`${equipoTablaEtiquetaBaseClass} ${timeEntryApiStatusBadgeClass("NonWorkingDay")}`}
                          >
                            No laboral
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
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
                        <td className="px-2 py-1.5 text-sm align-middle">
                          <span
                            className={`${equipoTablaEtiquetaBaseClass} ${equipoTablaSinImputarBadgeClass}`}
                          >
                            Sin imputar
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">—</td>
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
                  const isImpManual = e.razon === "imputacion_manual_error";
                  const razonClass =
                    "inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200";
                  const razonLabel = isImpManual ? "Imp Manual" : formatRazonTablaEquipo(e);

                  return (
                    <tr key={`${e.id}-${e.workerId}-${e.workDate}`} className={zebra}>
                      <td className="whitespace-nowrap px-2 py-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {eq.resolveEquipoPersonaNombre(fila)}
                      </td>
                      <td className="min-w-[9rem] px-2 py-1.5 text-sm">
                        {formatDateEsWeekdayDdMmYyyy(e.workDate)}
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
                      <td className="whitespace-nowrap px-2 py-1.5 text-sm">
                        {ocultaHoras ? "—" : formatTimeLocal(e.checkInUtc)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-sm">
                        {ocultaHoras ? "—" : formatTimeLocal(e.checkOutUtc)}
                      </td>
                      <td className="px-2 py-1.5 text-sm">
                        {ocultaHoras ? "—" : formatMinutesShort(e.breakMinutes ?? 0)}
                      </td>
                      <td className="max-w-[12rem] px-2 py-1.5 text-sm leading-snug">
                        <span className={razonClass}>
                          <span className="truncate">{razonLabel}</span>
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
                          <span
                            className={`agro-badge ${
                              apiParte.tieneParte ? "agro-badge-ok" : "agro-badge-danger"
                            }`}
                          >
                            {apiParte.tieneParte ? "Sí" : "No"}
                          </span>
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

          {eq.equipoFilasVista.length > TEAM_HOURS_TABLA_PREVIEW_ROWS ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/25">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {tablaRegistrosVerTodos ? (
                  <>
                    Grid expandido ·{" "}
                    <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                      {eq.equipoFilasVista.length}
                    </span>{" "}
                    registros visibles.
                  </>
                ) : (
                  <>
                    Grid compacto ·{" "}
                    <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                      {eq.equipoFilasVista.length}
                    </span>{" "}
                    registros (desliza dentro del grid para verlos todos).
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => setTablaRegistrosVerTodos((v) => !v)}
                className="agro-btn-primary"
              >
                {tablaRegistrosVerTodos ? "Compactar grid" : "Expandir grid"}
              </button>
            </div>
          ) : null}
          {/* Calendario de la persona se renderiza arriba (protagonista) cuando hay persona filtrada. */}
        </motion.section>
      )}
            </div>
          </div>

          </div>
        </div>
        {/* fin del grid principal — el aside queda como columna hermana DENTRO del flex-row */}

        {/* ── Aside (lg+: columna derecha 22.5rem; <lg: aparece ARRIBA, sobre el grid principal,
            con `order-first` para mantener el patrón "resumen visual primero, tabla al final"). ── */}
        <div className="block w-full order-first lg:order-none lg:w-[22.5rem] lg:flex-shrink-0">
          <div className="space-y-3 lg:sticky lg:top-3">
              <section className={`${cardSurfaceClass} p-3 sm:p-3.5`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="agro-kicker">Resumen equipo</h2>
                  <span className="agro-badge agro-badge-danger">
                    {hoyResumen.counts.itemsTarjeta.toLocaleString("es-ES")}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => setHoyUseToday((v) => !v)}
                    className="inline-flex min-w-[92px] items-center justify-between gap-3 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm outline-none ring-emerald-500/25 hover:bg-slate-50 focus-visible:ring-2 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/50"
                    aria-pressed={hoyUseToday}
                    title="Alternar entre hoy y fecha"
                  >
                    <span>Hoy</span>
                    <span
                      className={`relative h-5 w-9 shrink-0 overflow-hidden rounded-full p-0.5 transition-colors ${
                        hoyUseToday ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-700"
                      }`}
                      aria-hidden
                    >
                      <span
                        className={`absolute left-0 top-0 m-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          hoyUseToday ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>

                  <div className="inline-flex min-w-[170px] items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">Fecha</span>
                    <input
                      type="date"
                      value={hoyUseToday ? localTodayISO() : (eqHoy.equipoDia || localTodayISO())}
                      onChange={(e) => {
                        setHoyUseToday(false);
                        eqHoy.setEquipoDia(e.target.value);
                      }}
                      disabled={hoyUseToday}
                      className="h-7 rounded-lg border border-transparent bg-transparent px-1 text-[11px] font-semibold text-slate-700 outline-none disabled:opacity-40 dark:text-slate-100"
                      aria-label="Seleccionar día"
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {hoyResumen.filas
                    .filter((f) => {
                      // Panel "día seleccionado": ignorar filas de otros días.
                      const workDate =
                        f.kind === "registro" ? f.e.workDate : f.kind === "noLaboral" || f.kind === "sinImputar" ? f.workDate : null;
                      if (!workDate || workDate !== hoyResumen.diaSeleccionado) return false;

                      // 1) Sin fichar (laborable sin entrada): siempre se muestra.
                      if (f.kind === "sinImputar") return true;
                      // No laboral (rejilla): NO se muestra.
                      if (f.kind === "noLaboral") return false;
                      if (f.kind !== "registro") return false;

                      const e = f.e;
                      const abs = equipoAbsenceEtiquetaKind(e);
                      // 2) Baja y 3) Vacaciones: siempre se muestran.
                      if (abs === "baja" || abs === "vacaciones") return true;
                      // No laborable a nivel registro: NO se muestra.
                      if (abs === "no_laboral") return false;
                      // 4) Si ha fichado y NO tiene parte: se muestra.
                      // Si ha fichado y tiene parte: NO se muestra.
                      return Boolean(e.checkInUtc) && !timeEntryConParteEnServidor(e);
                    })
                    .sort((a, b) => {
                      // Orden: Sin fichar (0) → Baja (1) → Vacaciones (2) → Sin parte (3)
                      const prio = (f: typeof a) => {
                        if (f.kind === "sinImputar") return 0;
                        if (f.kind !== "registro") return 99;
                        const abs = equipoAbsenceEtiquetaKind(f.e);
                        if (abs === "baja") return 1;
                        if (abs === "vacaciones") return 2;
                        return 3;
                      };
                      return prio(a) - prio(b);
                    })
                    .slice(0, 3)
                    .map((f, idx) => {
                      const isSinImputar = f.kind === "sinImputar";
                      const isNoLaboral = f.kind === "noLaboral";
                      const nombre = eqHoy.resolveEquipoPersonaNombre(f as any);
                      const initials = nombre
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase())
                        .join("");

                      const label = (() => {
                        if (isSinImputar) return "Sin fichar";
                        if (isNoLaboral) return "No laboral";
                        const abs = equipoAbsenceEtiquetaKind(f.e);
                        if (abs === "baja") return "Baja";
                        if (abs === "vacaciones") return "Vacaciones";
                        if (!timeEntryConParteEnServidor(f.e)) return "Sin parte";
                        return "Revisar";
                      })();

                      const badgeClass = (() => {
                        if (label === "Vacaciones") return "agro-badge-info";
                        if (label === "Baja") return "agro-badge-warn";
                        if (label === "Sin parte") return "agro-badge-warn";
                        if (label === "No laboral") return "agro-badge-info";
                        return "agro-badge-danger";
                      })();

                      const sub = (() => {
                        if (isSinImputar) return "No tiene registro de entrada.";
                        if (isNoLaboral) return "Día marcado como no laborable.";
                        const abs = equipoAbsenceEtiquetaKind(f.e);
                        if (abs === "baja") return "De baja médica.";
                        if (abs === "vacaciones") return "En periodos de vacaciones.";
                        return "Jornada registrada sin parte.";
                      })();

                      return (
                        <div
                          key={`${idx}-${isSinImputar || isNoLaboral ? `h-${f.userId}-${f.workDate}` : `r-${f.e.id}`}`}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/50"
                        >
                          <div className="h-9 w-9 shrink-0 rounded-full bg-slate-200 text-[11px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-100 flex items-center justify-center">
                            {initials || "—"}
                          </div>
                          <p
                            className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900 dark:text-slate-100"
                            title={nombre}
                          >
                            {nombre}
                          </p>
                          <span
                            className={`agro-badge ${badgeClass} shrink-0`}
                            title={sub}
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  {hoyResumen.filas.length === 0 ? (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                      No hay datos de hoy con los filtros actuales.
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setHoyDrawerOpen(true)}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900/50"
                >
                  Ver todos los trabajadores (hoy)
                </button>
              </section>

              {/* Cumplimiento semanal — datos reales de GET /api/TimeEntries/rows/heatmap.
                  Solo se muestra para periodos cortos (día / semana / mes); en trimestre y año
                  el heatmap pierde legibilidad y la consulta sería excesiva. */}
              <section className={`${cardSurfaceClass} p-3 sm:p-3.5`}>
                <div className="mb-3">
                  <h2 className="agro-section-title min-w-0 truncate">
                    Cumplimiento semanal
                  </h2>
                  <p className="agro-muted mt-1 text-xs">Cumplimiento horas teóricas.</p>
                </div>
                <div>
                  {eq.equipoPeriodo === "trimestre" || eq.equipoPeriodo === "anio" ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400">
                      Disponible solo para periodos de hasta un mes. Cambia el filtro a{" "}
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Día, Semana o Mes
                      </span>{" "}
                      para ver el heatmap.
                    </div>
                  ) : (
                    <EquipoCumplimientoSemanalHeatmap
                      data={eq.equipoHeatmap}
                      loading={eq.equipoHeatmapLoading}
                      error={eq.equipoHeatmapError}
                    />
                  )}
                </div>
              </section>

              {/* Disciplina de partes — datos reales de GET /api/TimeEntries/rows/heatmap-parts.
                  Mismo gating que el heatmap de horas: solo en periodos ≤ mes. */}
              <section className={`${cardSurfaceClass} p-3 sm:p-3.5`}>
                <div className="mb-3">
                  <h2 className="agro-section-title min-w-0 truncate">
                    Cumplimiento de partes
                  </h2>
                  <p className="agro-muted mt-1 text-xs">
                    Partes creados sobre fichajes cerrados.
                  </p>
                </div>
                <div>
                  {eq.equipoPeriodo === "trimestre" || eq.equipoPeriodo === "anio" ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400">
                      Disponible solo para periodos de hasta un mes. Cambia el filtro a{" "}
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Día, Semana o Mes
                      </span>{" "}
                      para ver el heatmap.
                    </div>
                  ) : (
                    <EquipoCumplimientoPartesHeatmap
                      data={eq.equipoHeatmapParts}
                      loading={eq.equipoHeatmapPartsLoading}
                      error={eq.equipoHeatmapPartsError}
                    />
                  )}
                </div>
              </section>

              {/*
               * Calendario de la persona (solo cuando hay persona filtrada).
               * Antes vivía al final de la tabla; ahora aparece aquí, en el aside derecho,
               * tras "Resumen del periodo".
               */}
              {/* Calendario individual: el recuadro está SIEMPRE presente para mantener
                  el ritmo visual del aside. Si aún no hay persona seleccionada o falta
                  rango, dentro aparece un mensaje guía en lugar de ocultar la card. */}
              {(() => {
                const personaSeleccionada = eq.filtroPersonaEquipo !== "todas";
                const nombrePersona = personaSeleccionada
                  ? eq.equipoWorkersOpciones.find((w) => w.id === eq.filtroPersonaEquipo)?.name ??
                    String(eq.filtroPersonaEquipo)
                  : null;
                const puedePintarCalendario = Boolean(eq.equipoRange) && personaSeleccionada;
                return (
                  <section className={`${cardSurfaceClass} p-3 sm:p-3.5`}>
                    <div className="mb-3">
                      <h2 className="agro-section-title min-w-0 truncate">
                        {nombrePersona ? `Calendario · ${nombrePersona}` : "Calendario · persona"}
                      </h2>
                      <p className="agro-muted mt-1 text-xs">
                        {eq.equipoPeriodo === "anio"
                          ? `${
                              eq.opcionesMesDentroAnioEquipo.find(
                                (o) => o.value === eq.equipoAnioMesPagina,
                              )?.label ?? ""
                            } ${eq.anioEquipo}`
                          : "Estado por día."}
                      </p>
                    </div>
                    {puedePintarCalendario && eq.equipoRange ? (
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
                        nombrePersona={nombrePersona ?? ""}
                      />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                        Filtra por una persona concreta en el panel de filtros para ver aquí su
                        calendario del periodo.
                      </div>
                    )}
                  </section>
                );
              })()}

              {null}
            </div>{/* cierre inner aside */}
          </div>{/* cierre outer aside */}
        </div>{/* cierre wrapper flex-row (grid + aside hermanos) */}

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

      {/* ── Modal: listado de hoy (todos los trabajadores) ───────────────── */}
      {hoyDrawerOpen ? (
        <div
          className={`fixed inset-0 z-[120] ${MODAL_BACKDROP_CENTER}`}
          role="dialog"
          aria-modal="true"
          aria-label="Trabajadores de hoy"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setHoyDrawerOpen(false);
          }}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") setHoyDrawerOpen(false);
          }}
        >
          <div className={modalScrollablePanel("lg")} onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="agro-kicker">Hoy</p>
                <h2 className="agro-h1 text-lg">Todos los trabajadores</h2>
                <p className="agro-muted mt-1">
                  {formatDateES(hoyResumen.diaSeleccionado)} · Estado del día (iniciado, vacaciones, no laboral, sin fichar, parte).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHoyDrawerOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {hoyResumen.filas.map((fila, i) => {
                if (fila.kind === "noLaboral" || fila.kind === "sinImputar") {
                  const isNoLaboral = fila.kind === "noLaboral";
                  return (
                    <div
                      key={`${fila.kind}-${fila.userId}-${fila.workDate}-${i}`}
                      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/35"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {eqHoy.resolveEquipoPersonaNombre(fila)}
                          </p>
                          <p className="agro-muted mt-0.5">{formatDateES(fila.workDate)}</p>
                        </div>
                        <span
                          className={`agro-badge ${isNoLaboral ? "agro-badge-info" : "agro-badge-danger"}`}
                        >
                          {isNoLaboral ? "No laboral" : "Sin fichar"}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (fila.kind !== "registro") return null;
                const e = fila.e;
                const abs = equipoAbsenceEtiquetaKind(e);
                const hasPart = timeEntryConParteEnServidor(e);
                const badge =
                  abs === "vacaciones"
                    ? "agro-badge-info"
                    : !e.checkInUtc
                      ? "agro-badge-danger"
                      : e.checkOutUtc && !hasPart
                        ? "agro-badge-warn"
                        : "agro-badge-ok";
                const badgeTxt =
                  abs === "vacaciones"
                    ? "Vacaciones"
                    : !e.checkInUtc
                      ? "Sin fichar"
                      : e.checkOutUtc && !hasPart
                        ? "Sin parte"
                        : "OK";

                return (
                  <div
                    key={`${e.id}-${e.workerId}-${e.workDate}-${i}`}
                    className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950/35"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {eqHoy.resolveEquipoPersonaNombre(fila)}
                        </p>
                        <p className="agro-muted mt-0.5">{formatDateES(e.workDate)}</p>
                      </div>
                      <span className={`agro-badge ${badge}`}>{badgeTxt}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Filtros móvil: FAB + bottom-sheet (solo <lg) ──────────────────────────
          - El FAB queda fijo abajo a la derecha en móvil/tablet.
          - Al pulsarlo abre un panel deslizante desde la parte inferior con los
            mismos controles del aside lateral (`TeamHoursFiltrosInner`).
          - Se oculta por completo en lg+ (allí los filtros viven en columna lateral). */}
      {!teamHoursIsLgLayout ? (
        <>
          <button
            type="button"
            aria-label={mobileFiltersOpen ? "Cerrar filtros" : "Abrir filtros"}
            aria-expanded={mobileFiltersOpen}
            aria-controls="team-hours-filtros-mobile"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 ring-1 ring-emerald-700/40 transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-emerald-500 dark:ring-emerald-300/30 dark:hover:bg-emerald-400 lg:hidden"
          >
            {mobileFiltersOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden
              >
                <path d="M6 6 18 18 M18 6 6 18" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden
              >
                <path d="M3 5h18 M6 12h12 M10 19h4" />
              </svg>
            )}
          </button>

          {mobileFiltersOpen ? (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
                aria-hidden
                onClick={() => setMobileFiltersOpen(false)}
              />
              {/* Bottom-sheet */}
              <div
                id="team-hours-filtros-mobile"
                role="dialog"
                aria-modal="true"
                aria-label="Filtros del periodo y alcance"
                className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white p-4 pb-20 shadow-2xl dark:border-slate-700 dark:bg-slate-900 lg:hidden"
              >
                <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden />
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Filtros
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    className="rounded-md px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Cerrar
                  </button>
                </div>
                <TeamHoursFiltrosInner />
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {null}
    </div>
  );
}
