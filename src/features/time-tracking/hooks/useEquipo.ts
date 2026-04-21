"use client";
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { workerNameById } from "@/mocks/time-tracking.mock";
import {
  currentMonthLocalISO,
  currentYearLocal,
  formatDateES,
  listDaysInRange,
  localCalendarISO,
  monthSelectOptions,
  parseMonthYm,
  quarterOptions,
  quarterToRange,
  clampRangeToToday,
  localTodayISO,
  yearOptions,
  yearToRange,
} from "@/shared/utils/time";
import {
  effectiveExtraMinutesEntry,
  effectiveWorkMinutesEntry,
  formatLastModifiedByUser,
  formatRazonTablaEquipo,
  formatWorkReportLinesForUbicacion,
  isSinJornadaImputableRazon,
  RAZON_NO_LABORAL,
  RAZON_SIN_IMPUTAR,
  sessionDisplayNameFromEmail,
  timeEntryConParteEnServidor,
  timeEntrySinParteEnServidor,
} from "@/features/time-tracking/utils/formatters";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";
import { useAuth } from "@/contexts/AuthContext";
import {
  companiesApi,
  timeTrackingApi,
  usersApi,
  workReportsApi,
  workServicesApi,
  type TimeEntryRowsSummaryDto,
} from "@/services";
import { mapTimeEntryRowsItemToMock } from "@/features/time-tracking/utils/mapTimeEntryRowsItemToMock";
import type {
  TimeEntryMock,
  EquipoTablaFila,
  EquipoSortKey,
  EquipoTablaFiltroExtra,
  EquipoWorkerOption,
} from "@/features/time-tracking/types";
import {
  buildEquipoDenseGridRows,
  entryStablePersonKey,
  indexEquipoEntriesByPersonAndDate,
  uniquePersonKeysInRange,
  workerIdFromPersonKey,
} from "@/features/time-tracking/utils/equipoGridMerge";

// ----- Constants & module-level helpers -----

function buildPersonaSortLabel(nameByKey: Map<string, string>) {
  return (f: EquipoTablaFila) => {
    if (f.kind === "registro") {
      const pk = entryStablePersonKey(f.e);
      if (pk) {
        const n = nameByKey.get(pk);
        if (n?.trim()) return n.trim();
      }
      return workerNameById(f.e.workerId);
    }
    if (f.displayName?.trim()) return f.displayName.trim();
    return workerNameById(f.workerId);
  };
}

function rankEquipoFilaKind(f: EquipoTablaFila): number {
  if (f.kind === "registro") return 0;
  if (f.kind === "sinImputar") return 1;
  return 2;
}

function sortEquipoFilasOrigen(filas: EquipoTablaFila[]): EquipoTablaFila[] {
  return [...filas].sort((a, b) => {
    const dA = a.kind === "registro" ? a.e.workDate : a.workDate;
    const dB = b.kind === "registro" ? b.e.workDate : b.workDate;
    if (dA !== dB) return dB.localeCompare(dA);
    const wA = a.kind === "registro" ? a.e.workerId : a.workerId;
    const wB = b.kind === "registro" ? b.e.workerId : b.workerId;
    if (wA !== wB) return wA - wB;
    return rankEquipoFilaKind(a) - rankEquipoFilaKind(b);
  });
}

function compareEquipoFila(
  a: EquipoTablaFila,
  b: EquipoTablaFila,
  key: EquipoSortKey,
  asc: boolean,
  getPersonaLabel?: (f: EquipoTablaFila) => string,
  capWorkMinutesPerDay: number = 8 * 60,
): number {
  const m = asc ? 1 : -1;
  const ts = (iso: string | null | undefined) =>
    iso ? new Date(iso).getTime() : Number.NaN;
  const reg = (f: EquipoTablaFila) => (f.kind === "registro" ? f.e : null);
  const wid = (f: EquipoTablaFila) => (f.kind === "registro" ? f.e.workerId : f.workerId);
  const wd = (f: EquipoTablaFila) => (f.kind === "registro" ? f.e.workDate : f.workDate);
  const razonTxt = (f: EquipoTablaFila) => {
    if (f.kind === "registro") return formatRazonTablaEquipo(f.e);
    if (f.kind === "noLaboral") return RAZON_NO_LABORAL;
    return RAZON_SIN_IMPUTAR;
  };
  const modTxt = (f: EquipoTablaFila) =>
    f.kind === "registro" ? formatLastModifiedByUser(f.e) : "—";

  const eA = reg(a);
  const eB = reg(b);
  let cmp = 0;

  switch (key) {
    case "persona": {
      const la = getPersonaLabel ? getPersonaLabel(a) : workerNameById(wid(a));
      const lb = getPersonaLabel ? getPersonaLabel(b) : workerNameById(wid(b));
      cmp = la.localeCompare(lb, "es", { sensitivity: "base" });
      break;
    }
    case "fecha":
      cmp = wd(a) < wd(b) ? -1 : wd(a) > wd(b) ? 1 : 0;
      break;
    case "entrada":
      if (!eA && !eB) cmp = 0;
      else if (!eA) cmp = 1;
      else if (!eB) cmp = -1;
      else cmp = ts(eA.checkInUtc) - ts(eB.checkInUtc);
      break;
    case "salida":
      if (!eA && !eB) cmp = 0;
      else if (!eA) cmp = 1;
      else if (!eB) cmp = -1;
      else {
        const na = eA.checkOutUtc == null;
        const nb = eB.checkOutUtc == null;
        if (na && nb) cmp = 0;
        else if (na) cmp = 1;
        else if (nb) cmp = -1;
        else cmp = ts(eA.checkOutUtc) - ts(eB.checkOutUtc);
      }
      break;
    case "entradaAntes":
      if (!eA && !eB) cmp = 0;
      else if (!eA) cmp = 1;
      else if (!eB) cmp = -1;
      else {
        const pa = eA.previousCheckInUtc;
        const pb = eB.previousCheckInUtc;
        if (!pa && !pb) cmp = 0;
        else if (!pa) cmp = 1;
        else if (!pb) cmp = -1;
        else cmp = ts(pa) - ts(pb);
      }
      break;
    case "salidaAntes":
      if (!eA && !eB) cmp = 0;
      else if (!eA) cmp = 1;
      else if (!eB) cmp = -1;
      else {
        const pa = eA.previousCheckOutUtc;
        const pb = eB.previousCheckOutUtc;
        if (!pa && !pb) cmp = 0;
        else if (!pa) cmp = 1;
        else if (!pb) cmp = -1;
        else cmp = ts(pa) - ts(pb);
      }
      break;
    case "descanso": {
      const bA = eA ? (eA.breakMinutes ?? 0) : -1;
      const bB = eB ? (eB.breakMinutes ?? 0) : -1;
      cmp = bA - bB;
      break;
    }
    case "estado": {
      const code = (f: EquipoTablaFila) => {
        if (f.kind !== "registro") return "\uFFFF";
        const s = f.e.timeEntryStatus;
        if (s === null || s === undefined) return "\uFFFE";
        if (s === "unknown") return "\uFFFD-unknown";
        return s;
      };
      cmp = code(a).localeCompare(code(b), "en");
      break;
    }
    case "razon":
      cmp = razonTxt(a).localeCompare(razonTxt(b), "es");
      break;
    case "modificado":
      cmp = modTxt(a).localeCompare(modTxt(b), "es", { sensitivity: "base" });
      break;
    case "fechaMod": {
      const uA = eA?.updatedAtUtc;
      const uB = eB?.updatedAtUtc;
      if (!uA && !uB) cmp = 0;
      else if (!uA) cmp = 1;
      else if (!uB) cmp = -1;
      else cmp = ts(uA) - ts(uB);
      break;
    }
    case "duracion": {
      const dMa = eA ? effectiveWorkMinutesEntry(eA) : -1;
      const dMb = eB ? effectiveWorkMinutesEntry(eB) : -1;
      cmp = dMa - dMb;
      break;
    }
    case "extra": {
      const xA = eA ? effectiveExtraMinutesEntry(eA, capWorkMinutesPerDay) : -1;
      const xB = eB ? effectiveExtraMinutesEntry(eB, capWorkMinutesPerDay) : -1;
      cmp = xA - xB;
      break;
    }
    default:
      cmp = 0;
  }
  if (Number.isNaN(cmp)) cmp = 0;
  if (cmp !== 0) return m * cmp;
  const dA = wd(a);
  const dB = wd(b);
  if (dA !== dB) return dB.localeCompare(dA);
  if (wid(a) !== wid(b)) return wid(a) - wid(b);
  return rankEquipoFilaKind(a) - rankEquipoFilaKind(b);
}

function sortEquipoFilas(
  filas: EquipoTablaFila[],
  key: EquipoSortKey,
  dir: "asc" | "desc",
  getPersonaLabel?: (f: EquipoTablaFila) => string,
  capWorkMinutesPerDay: number = 8 * 60,
): EquipoTablaFila[] {
  const asc = dir === "asc";
  return [...filas].sort((a, b) =>
    compareEquipoFila(a, b, key, asc, getPersonaLabel, capWorkMinutesPerDay),
  );
}

export type UseEquipoOptions = {
  /**
   * Si true, carga el catálogo de empresas (ClientCompanies) y filtra usuarios/fichajes por `companyId`.
   * Usar en SuperAdmin, Manager y Admin en vistas de equipo.
   */
  enableEquipoCompanyFilter?: boolean;
  /**
   * Si true, incluye (y muestra) usuarios con `excludedFromTimeTracking=true` en el combo «Persona»
   * y en el grid. Si false (por defecto), se ocultan visualmente (UX) como hasta ahora.
   */
  includeExcludedFromTimeTracking?: boolean;
};

// ----- Hook -----

export function useEquipo(options?: UseEquipoOptions) {
  const enableEquipoCompanyFilter = options?.enableEquipoCompanyFilter === true;
  const includeExcludedFromTimeTracking = options?.includeExcludedFromTimeTracking === true;
  const { user: authUser } = useAuth();
  const [filtroPersonaEquipo, setFiltroPersonaEquipo] = useState<string | "todas">("todas");
  const [equipoPeriodo, setEquipoPeriodo] = useState<"dia" | "semana" | "mes" | "trimestre" | "anio">("mes");
  const [equipoDia, setEquipoDia] = useState(localTodayISO());
  const [equipoSemana, setEquipoSemana] = useState(localTodayISO());
  const [mesEquipo, setMesEquipo] = useState(currentMonthLocalISO);
  const [trimestreEquipo, setTrimestreEquipo] = useState(() => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${q}`;
  });
  const [anioEquipo, setAnioEquipo] = useState(currentYearLocal());
  /** Con periodo «Año»: mes 1–12 del detalle (GET /rows por mes; resumen anual en /rows/summary). */
  const [equipoAnioMesPagina, setEquipoAnioMesPagina] = useState(() => new Date().getMonth() + 1);
  /** Tabla: como radios — solo uno de los tres modos extra o ninguno. */
  const [equipoTablaFiltroExtra, setEquipoTablaFiltroExtra] =
    useState<EquipoTablaFiltroExtra>("ninguno");

  const setEquipoSoloSinImputar = useCallback((checked: boolean) => {
    setEquipoTablaFiltroExtra(checked ? "soloSinImputar" : "ninguno");
  }, []);
  const setEquipoSoloSinParteServidor = useCallback((checked: boolean) => {
    setEquipoTablaFiltroExtra(checked ? "soloSinParteServidor" : "ninguno");
  }, []);
  const setEquipoSoloConParteServidor = useCallback((checked: boolean) => {
    setEquipoTablaFiltroExtra(checked ? "soloConParteServidor" : "ninguno");
  }, []);

  /** Restablece alcance (empresa, persona, servicio) y vista rápida; no cambia periodo ni fechas. */
  const equipoBorrarFiltrosAlcance = useCallback(() => {
    setFiltroPersonaEquipo("todas");
    setEquipoSuperAdminCompanyId(null);
    setEquipoServiceId(null);
    setEquipoTablaFiltroExtra("ninguno");
  }, []);

  const opcionesMesEquipo = useMemo(() => monthSelectOptions(12), []);
  const opcionesTrimestre = useMemo(() => quarterOptions(3), []);
  const opcionesAnio = useMemo(() => yearOptions(6), []);
  const opcionesMesDentroAnioEquipo = useMemo(() => {
    const y = Number(anioEquipo);
    if (!Number.isFinite(y)) return [];
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const d = new Date(y, m - 1, 1);
      const raw = d.toLocaleDateString("es-ES", { month: "long" });
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      return { value: m, label };
    });
  }, [anioEquipo]);

  const [teamHistorialEntries, setTeamHistorialEntries] = useState<TimeEntryMock[]>([]);
  /** Trabajadores para filtro «Persona»; rellenar desde API (p. ej. grid horas equipo). */
  const [equipoWorkers, setEquipoWorkers] = useState<EquipoWorkerOption[]>([]);
  const [equipoRowsLoading, setEquipoRowsLoading] = useState(false);
  const [equipoRowsError, setEquipoRowsError] = useState<string | null>(null);
  const [equipoRowsTotalCount, setEquipoRowsTotalCount] = useState(0);
  /** Resumen GET /api/TimeEntries/rows/summary (KPIs y gráficos). */
  const [equipoSummary, setEquipoSummary] = useState<TimeEntryRowsSummaryDto | null>(null);
  const [equipoSummaryLoading, setEquipoSummaryLoading] = useState(false);
  const [equipoSummaryError, setEquipoSummaryError] = useState<string | null>(null);
  const [equipoFetchNonce, setEquipoFetchNonce] = useState(0);
  const equipoFetchSeq = useRef(0);

  const refetchEquipoRows = useCallback(() => {
    setEquipoFetchNonce((n) => n + 1);
  }, []);

  /** Filtro exclusivo SuperAdmin: restringe fichajes y plantilla visibles a una empresa (null = todas). */
  const [equipoSuperAdminCompanyId, setEquipoSuperAdminCompanyId] = useState<string | null>(null);
  const [equipoCompaniesCatalog, setEquipoCompaniesCatalog] = useState<
    { id: string; name: string; organizationCompanyId?: string | null }[]
  >([]);
  const [equipoCompaniesLoading, setEquipoCompaniesLoading] = useState(false);
  const [equipoCompaniesError, setEquipoCompaniesError] = useState<string | null>(null);

  /** Filtro grid: GET /api/TimeEntries/rows?serviceId=… (null = todos). */
  const [equipoServiceId, setEquipoServiceId] = useState<string | null>(null);
  const [equipoServicesCatalog, setEquipoServicesCatalog] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [equipoServicesLoading, setEquipoServicesLoading] = useState(false);
  const [equipoServicesError, setEquipoServicesError] = useState<string | null>(null);

  const equipoTablaScrollRef = useRef<HTMLDivElement>(null);
  const equipoRestaurarScroll = useRef<{ top: number; left: number } | null>(null);
  const equipoMarcarRestaurarScroll = useRef(false);

  // Restore scroll after historial update
  useLayoutEffect(() => {
    if (!equipoMarcarRestaurarScroll.current) return;
    equipoMarcarRestaurarScroll.current = false;
    const pos = equipoRestaurarScroll.current;
    const el = equipoTablaScrollRef.current;
    equipoRestaurarScroll.current = null;
    if (pos && el) {
      el.scrollTop = pos.top;
      el.scrollLeft = pos.left;
    }
  }, [teamHistorialEntries]);

  // Listen for workparts changes to refresh equipo stats
  const [equipoPartsVersion, setEquipoPartsVersion] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fn = () => setEquipoPartsVersion((v) => v + 1);
    window.addEventListener("agromanager-workparts-changed", fn);
    return () => window.removeEventListener("agromanager-workparts-changed", fn);
  }, []);

  useEffect(() => {
    if (!enableEquipoCompanyFilter) {
      setEquipoSuperAdminCompanyId(null);
      setEquipoCompaniesCatalog([]);
      setEquipoCompaniesError(null);
      setEquipoCompaniesLoading(false);
      return;
    }
    let cancelled = false;
    setEquipoCompaniesLoading(true);
    setEquipoCompaniesError(null);
    companiesApi
      .getAll()
      .then((list) => {
        if (!cancelled) {
          setEquipoCompaniesCatalog(
            list.map((c) => ({
              id: c.id,
              name: c.name,
              organizationCompanyId: c.organizationCompanyId ?? null,
            })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEquipoCompaniesError("No se pudieron cargar las empresas.");
          setEquipoCompaniesCatalog([]);
        }
      })
      .finally(() => {
        if (!cancelled) setEquipoCompaniesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enableEquipoCompanyFilter]);

  /**
   * Catálogo GET /api/Services con Bearer (sin `companyId` en query).
   * El backend acota por la empresa del token; independiente del combo «Empresas» del grid.
   */
  useEffect(() => {
    if (!enableEquipoCompanyFilter) {
      setEquipoServiceId(null);
      setEquipoServicesCatalog([]);
      setEquipoServicesError(null);
      setEquipoServicesLoading(false);
      return;
    }
    let cancelled = false;
    setEquipoServicesLoading(true);
    setEquipoServicesError(null);
    const ac = new AbortController();
    workServicesApi
      .getAll({ signal: ac.signal })
      .then((list) => {
        if (!cancelled) {
          setEquipoServicesCatalog(
            list.map((s) => ({ id: s.id, name: s.name })).filter((s) => s.id && s.name),
          );
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setEquipoServicesError(
          userVisibleMessageFromUnknown(e, "No se pudieron cargar los servicios."),
        );
        setEquipoServicesCatalog([]);
      })
      .finally(() => {
        if (!cancelled) setEquipoServicesLoading(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [enableEquipoCompanyFilter]);

  /**
   * Servicio o empresa concreta en API: forzar «solo con parte en servidor» (misma razón que antes
   * solo con servicio — menos ruido en el grid). Sin ambos, vuelve a ningún filtro rápido.
   * El usuario puede cambiar después a «Sin fichar» / «Sin parte»; solo se reaplica al variar empresa/servicio.
   */
  useEffect(() => {
    const scopedService = Boolean(equipoServiceId?.trim());
    const scopedCompany = Boolean(equipoSuperAdminCompanyId?.trim());
    if (scopedService || scopedCompany) {
      setEquipoTablaFiltroExtra("soloConParteServidor");
    } else {
      setEquipoTablaFiltroExtra("ninguno");
    }
  }, [equipoServiceId, equipoSuperAdminCompanyId]);

  /**
   * Catálogo «Persona»: con filtro empresa (admin/manager) → GET /api/Users.
   * Sin él (Worker): solo GET /api/Users/{id} — listar todos suele devolver 403; no llamamos a GetAll.
   */
  useEffect(() => {
    if (enableEquipoCompanyFilter) {
      const ac = new AbortController();
      usersApi
        .getAll({ signal: ac.signal })
        .then((list) => {
          setEquipoWorkers(
            list.map((u) => ({
              id: u.id,
              name: u.name,
              companyId: u.companyId ?? null,
              excludedFromTimeTracking: u.excludedFromTimeTracking === true,
            })),
          );
        })
        .catch((e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setEquipoWorkers([]);
        });
      return () => ac.abort();
    }

    if (!authUser?.id) {
      setEquipoWorkers([]);
      return;
    }

    let cancelled = false;
    const emailFallback = sessionDisplayNameFromEmail(authUser.email);

    (async () => {
      try {
        const u = await usersApi.getById(authUser.id);
        if (cancelled) return;
        setEquipoWorkers([
          {
            id: u.id,
            name: (u.name ?? "").trim() || emailFallback,
            companyId: u.companyId ?? null,
            excludedFromTimeTracking: u.excludedFromTimeTracking === true,
          },
        ]);
      } catch {
        if (!cancelled) {
          setEquipoWorkers([
            {
              id: authUser.id,
              name: emailFallback,
              companyId: authUser.companyId ?? null,
              excludedFromTimeTracking: false,
            },
          ]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enableEquipoCompanyFilter,
    includeExcludedFromTimeTracking,
    authUser?.id,
    authUser?.email,
    authUser?.companyId,
  ]);

  /** Worker: por defecto «Persona» = yo (el desplegable muestra el nombre, no solo «Todos»). */
  useEffect(() => {
    if (enableEquipoCompanyFilter) return;
    if (!authUser?.id) return;
    setFiltroPersonaEquipo((prev) => (prev === "todas" ? authUser.id : prev));
  }, [enableEquipoCompanyFilter, authUser?.id]);

  // ----- Derived / memos -----

  const equipoRange = useMemo(() => {
    if (equipoPeriodo === "dia") {
      const d = equipoDia;
      return { label: formatDateES(d), start: d, end: d };
    }
    if (equipoPeriodo === "semana") {
      const [sy, sm, sd] = equipoSemana.split("-").map(Number);
      if (!sy || !sm || !sd) return null;
      const ref = new Date(sy, sm - 1, sd, 12, 0, 0, 0);
      const dow = ref.getDay();
      const diffToMon = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(ref);
      mon.setDate(mon.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      const start = localCalendarISO(mon);
      const end = localCalendarISO(sun);
      const clamped = clampRangeToToday({ start, end });
      if (!clamped) return null;
      return { label: `Semana del ${formatDateES(start)}`, ...clamped };
    }
    if (equipoPeriodo === "mes") {
      const ym = parseMonthYm(mesEquipo);
      if (!ym) return null;
      const { y, m } = ym;
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const endD = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${String(endD).padStart(2, "0")}`;
      const clamped = clampRangeToToday({ start, end });
      if (!clamped) return null;
      return { label: `Mes ${mesEquipo}`, ...clamped };
    }
    if (equipoPeriodo === "trimestre") {
      const r = quarterToRange(trimestreEquipo);
      if (!r) return null;
      const clamped = clampRangeToToday(r);
      if (!clamped) return null;
      return { label: `Trimestre ${trimestreEquipo}`, ...clamped };
    }
    const r = yearToRange(anioEquipo);
    if (!r) return null;
    const clamped = clampRangeToToday(r);
    if (!clamped) return null;
    return { label: `Año ${anioEquipo}`, ...clamped };
  }, [equipoPeriodo, equipoDia, equipoSemana, mesEquipo, trimestreEquipo, anioEquipo]);

  const prevAnioEquipoRef = useRef(anioEquipo);
  useEffect(() => {
    if (equipoPeriodo !== "anio") return;
    if (prevAnioEquipoRef.current === anioEquipo) return;
    prevAnioEquipoRef.current = anioEquipo;
    const y = Number(anioEquipo);
    if (!Number.isFinite(y)) return;
    const cy = Number(currentYearLocal());
    setEquipoAnioMesPagina(y === cy ? new Date().getMonth() + 1 : 1);
  }, [anioEquipo, equipoPeriodo]);

  const prevEquipoPeriodoRef = useRef(equipoPeriodo);
  useEffect(() => {
    const was = prevEquipoPeriodoRef.current;
    prevEquipoPeriodoRef.current = equipoPeriodo;
    if (equipoPeriodo !== "anio" || was === "anio") return;
    const ym = parseMonthYm(mesEquipo);
    const y = Number(anioEquipo);
    if (!Number.isFinite(y)) return;
    if (ym && ym.y === y) {
      setEquipoAnioMesPagina(ym.m);
    } else {
      const cy = Number(currentYearLocal());
      setEquipoAnioMesPagina(y === cy ? new Date().getMonth() + 1 : 1);
    }
  }, [equipoPeriodo, mesEquipo, anioEquipo]);

  /** Rango que ve el usuario (mes dentro del año si periodo = año; si no, coincide con `equipoRange`). */
  const equipoVistaRange = useMemo(() => {
    if (!equipoRange) return null;
    if (equipoPeriodo !== "anio") {
      return { start: equipoRange.start, end: equipoRange.end };
    }
    const y = Number(anioEquipo);
    const month = equipoAnioMesPagina;
    if (!Number.isFinite(y) || month < 1 || month > 12) return null;
    const start = `${y}-${String(month).padStart(2, "0")}-01`;
    const endD = new Date(y, month, 0).getDate();
    const end = `${y}-${String(month).padStart(2, "0")}-${String(endD).padStart(2, "0")}`;
    const clamped = clampRangeToToday({ start, end });
    if (!clamped) return null;
    return { start: clamped.start, end: clamped.end };
  }, [equipoRange, equipoPeriodo, anioEquipo, equipoAnioMesPagina]);

  /** Rango del grid/tabla y de GET /rows (coincide con `equipoRange` salvo en periodo «año» → un mes). */
  const equipoDetalleRange = useMemo(() => {
    if (!equipoRange) return null;
    return equipoVistaRange ?? equipoRange;
  }, [equipoVistaRange, equipoRange]);

  /** Grid: GET /api/TimeEntries/rows en `equipoVistaRange` (mes si periodo=año). Summary: `equipoRange` completo. */
  useEffect(() => {
    if (!equipoRange) {
      setTeamHistorialEntries([]);
      setEquipoRowsTotalCount(0);
      setEquipoRowsError(null);
      setEquipoRowsLoading(false);
      setEquipoSummary(null);
      setEquipoSummaryError(null);
      setEquipoSummaryLoading(false);
      return;
    }

    const rowsRange = equipoDetalleRange ?? equipoRange;
    const ac = new AbortController();
    const seq = ++equipoFetchSeq.current;
    const userIdForApi =
      filtroPersonaEquipo === "todas" ? undefined : filtroPersonaEquipo.trim();
    const clientCompanyIdForApi = equipoSuperAdminCompanyId?.trim() || undefined;
    const serviceIdForApi = equipoServiceId?.trim() || undefined;
    // Alineación backend (bool?):
    // - si se incluyen excluidos → no enviar param (legacy)
    // - si se ocultan excluidos → enviar false para que summary y grid filtren igual
    const excludedFromTimeTrackingForApi = includeExcludedFromTimeTracking ? undefined : false;

    setEquipoRowsLoading(true);
    setEquipoRowsError(null);
    setEquipoSummaryLoading(true);
    setEquipoSummaryError(null);

    timeTrackingApi
      .getTimeEntryRowsAllItems({
        from: rowsRange.start,
        to: rowsRange.end,
        userId: userIdForApi,
        excludedFromTimeTracking: excludedFromTimeTrackingForApi,
        serviceId: serviceIdForApi,
        clientCompanyId: clientCompanyIdForApi,
        signal: ac.signal,
      })
      .then(({ items, totalCount }: { items: unknown[]; totalCount: number }) => {
        if (seq !== equipoFetchSeq.current) return;
        const mapped = items
          .map(mapTimeEntryRowsItemToMock)
          .filter((x: TimeEntryMock | null): x is TimeEntryMock => x != null);
        setTeamHistorialEntries(mapped);
        setEquipoRowsTotalCount(totalCount);

        const reportIds = Array.from(
          new Set(
            mapped
              .map((e) => e.workReportId?.trim())
              .filter((id): id is string => Boolean(id)),
          ),
        );
        const enrichTargets = mapped.filter(
          (e) =>
            e.workReportId?.trim() &&
            typeof e.workReportLineCount === "number" &&
            e.workReportLineCount > 0,
        );
        if (reportIds.length > 0 && enrichTargets.length > 0) {
          void (async () => {
            const summaries = new Map<string, string>();
            await Promise.all(
              reportIds.map(async (reportId) => {
                try {
                  const rep = await workReportsApi.getByIdWithLines(reportId, {
                    signal: ac.signal,
                  });
                  if (ac.signal.aborted) return;
                  const text = formatWorkReportLinesForUbicacion(rep.lines).trim();
                  if (text) summaries.set(reportId, text);
                } catch {
                  /* parte no legible o sin permiso */
                }
              }),
            );
            if (ac.signal.aborted || seq !== equipoFetchSeq.current) return;
            if (summaries.size === 0) return;
            setTeamHistorialEntries((prev) => {
              if (seq !== equipoFetchSeq.current) return prev;
              return prev.map((e) => {
                const rid = e.workReportId?.trim();
                if (!rid || !summaries.has(rid)) return e;
                return { ...e, workReportLinesSummary: summaries.get(rid) ?? null };
              });
            });
          })();
        }
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        if (seq !== equipoFetchSeq.current) return;
        if (e instanceof DOMException && e.name === "AbortError") {
          return;
        }
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
        setEquipoRowsError(
          userVisibleMessageFromUnknown(e, "No se pudieron cargar los fichajes del equipo."),
        );
        setTeamHistorialEntries([]);
        setEquipoRowsTotalCount(0);
      })
      .finally(() => {
        if (seq === equipoFetchSeq.current) setEquipoRowsLoading(false);
      });

    timeTrackingApi
      .getTimeEntryRowsSummary({
        from: equipoRange.start,
        to: equipoRange.end,
        userId: userIdForApi,
        excludedFromTimeTracking: excludedFromTimeTrackingForApi,
        serviceId: serviceIdForApi,
        clientCompanyId: clientCompanyIdForApi,
        signal: ac.signal,
      })
      .then((summary) => {
        if (seq !== equipoFetchSeq.current) return;
        setEquipoSummary(summary);
        setEquipoSummaryError(null);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        if (seq !== equipoFetchSeq.current) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (e instanceof Error && e.name === "AbortError") return;
        setEquipoSummary(null);
        setEquipoSummaryError(
          userVisibleMessageFromUnknown(
            e,
            "No se pudo cargar el resumen para gráficos (se usan cálculos locales).",
          ),
        );
      })
      .finally(() => {
        if (seq === equipoFetchSeq.current) setEquipoSummaryLoading(false);
      });

    return () => ac.abort();
  }, [
    equipoRange?.start,
    equipoRange?.end,
    equipoDetalleRange?.start,
    equipoDetalleRange?.end,
    filtroPersonaEquipo,
    equipoServiceId,
    equipoSuperAdminCompanyId,
    includeExcludedFromTimeTracking,
    equipoFetchNonce,
  ]);

  /** Fichajes tras filtro por empresa cliente (id de ClientCompany en `clientCompanyIdsInReport`). */
  const entriesVistaEquipo = useMemo(() => {
    if (!equipoSuperAdminCompanyId) return teamHistorialEntries;
    const selected = equipoSuperAdminCompanyId;
    return teamHistorialEntries.filter((e) => {
      const ids = e.clientCompanyIdsInReport;
      if (ids && ids.length > 0) return ids.includes(selected);
      return e.companyId != null && e.companyId === selected;
    });
  }, [teamHistorialEntries, equipoSuperAdminCompanyId]);

  /** UserIds excluidos del fichaje (según catálogo; el backend puede devolver el campo ya filtrado). */
  const equipoExcludedPersonIds = useMemo(
    () =>
      new Set(
        equipoWorkers
          .filter((w) => w.excludedFromTimeTracking === true)
          .map((w) => w.id.trim())
          .filter((id) => id.length > 0),
      ),
    [equipoWorkers],
  );

  /** Fichajes visibles en UI: si no se incluyen excluidos, se quitan los de `excludedFromTimeTracking=true`. */
  const entriesVistaEquipoCliente = useMemo(() => {
    if (includeExcludedFromTimeTracking) return entriesVistaEquipo;
    if (equipoExcludedPersonIds.size === 0) return entriesVistaEquipo;
    return entriesVistaEquipo.filter((e) => {
      const pk = entryStablePersonKey(e);
      if (!pk || pk.startsWith("legacy:")) return true;
      return !equipoExcludedPersonIds.has(pk);
    });
  }, [entriesVistaEquipo, equipoExcludedPersonIds, includeExcludedFromTimeTracking]);

  /** Nombres para tabla/CSV/orden (usuarios API + fallback desde fichajes legacy). */
  const equipoNombrePorClave = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of equipoWorkers) {
      if (w.id) m.set(w.id, w.name);
    }
    for (const e of entriesVistaEquipoCliente) {
      const pk = entryStablePersonKey(e);
      if (!pk || m.has(pk)) continue;
      m.set(pk, workerNameById(e.workerId));
    }
    return m;
  }, [equipoWorkers, entriesVistaEquipoCliente]);

  const resolveEquipoPersonaNombre = useMemo(
    () => buildPersonaSortLabel(equipoNombrePorClave),
    [equipoNombrePorClave]
  );

  const equipoRowsFiltradas = useMemo(() => {
    if (!equipoDetalleRange) return [];
    let rows = entriesVistaEquipoCliente.filter(
      (e) =>
        e.workDate >= equipoDetalleRange.start && e.workDate <= equipoDetalleRange.end
    );
    if (filtroPersonaEquipo !== "todas") {
      rows = rows.filter((e) => entryStablePersonKey(e) === filtroPersonaEquipo);
    }
    return rows;
  }, [entriesVistaEquipoCliente, filtroPersonaEquipo, equipoDetalleRange]);

  /** Recuento para KPI/dona «registros en periodo»: API summary si existe, si no filas cargadas. */
  const equipoRegistrosPeriodoKpi = useMemo(() => {
    if (equipoSummary?.timeEntryCount != null) {
      return Math.max(0, Math.round(equipoSummary.timeEntryCount));
    }
    return equipoRowsFiltradas.length;
  }, [equipoSummary, equipoRowsFiltradas]);

  /** Fichajes del API en [from,to], indexados para el cruce con el calendario denso. */
  const entriesMesEquipoPorPersona = useMemo(() => {
    if (!equipoDetalleRange) return new Map<string, TimeEntryMock>();
    return indexEquipoEntriesByPersonAndDate(
      entriesVistaEquipoCliente,
      equipoDetalleRange.start,
      equipoDetalleRange.end
    );
  }, [entriesVistaEquipoCliente, equipoDetalleRange]);

  /**
   * Eje de personas del grid: persona concreta, lista de trabajadores del API,
   * o claves deducidas de fichajes si aún no hay usuarios cargados.
   */
  const trabajadoresVistaEquipo = useMemo(() => {
    if (filtroPersonaEquipo !== "todas") {
      return [filtroPersonaEquipo];
    }
    if (!equipoDetalleRange) return [];
    if (equipoWorkers.length > 0) {
      return includeExcludedFromTimeTracking
        ? equipoWorkers.map((w) => w.id)
        : equipoWorkers.filter((w) => !w.excludedFromTimeTracking).map((w) => w.id);
    }
    return uniquePersonKeysInRange(
      entriesVistaEquipoCliente,
      equipoDetalleRange.start,
      equipoDetalleRange.end
    );
  }, [filtroPersonaEquipo, equipoWorkers, entriesVistaEquipoCliente, equipoDetalleRange, includeExcludedFromTimeTracking]);

  const diasCalendarioMesEquipo = useMemo(() => {
    if (!equipoDetalleRange) return [];
    return listDaysInRange(equipoDetalleRange.start, equipoDetalleRange.end);
  }, [equipoDetalleRange]);

  const filasEquipoCalendario = useMemo(
    () =>
      buildEquipoDenseGridRows({
        personKeys: trabajadoresVistaEquipo,
        days: diasCalendarioMesEquipo,
        entryByPersonDate: entriesMesEquipoPorPersona,
        nameByPersonKey: equipoNombrePorClave,
      }),
    [
      trabajadoresVistaEquipo,
      diasCalendarioMesEquipo,
      entriesMesEquipoPorPersona,
      equipoNombrePorClave,
    ]
  );

  /** Mismo criterio que el summary del API (`hoursPerWorkingDay`, por defecto 8 h). */
  const equipoCapTrabajoDiarioMinutos = useMemo(() => {
    const h = equipoSummary?.hoursPerWorkingDay;
    if (h != null && Number.isFinite(h) && h > 0) return Math.round(h * 60);
    return 8 * 60;
  }, [equipoSummary]);

  const [equipoSort, setEquipoSort] = useState<{
    key: EquipoSortKey | null;
    dir: "asc" | "desc" | null;
  }>({ key: null, dir: null });

  const equipoFilasOrdenadas = useMemo(() => {
    if (equipoSort.key == null || equipoSort.dir == null) {
      return sortEquipoFilasOrigen(filasEquipoCalendario);
    }
    return sortEquipoFilas(
      filasEquipoCalendario,
      equipoSort.key,
      equipoSort.dir,
      resolveEquipoPersonaNombre,
      equipoCapTrabajoDiarioMinutos,
    );
  }, [
    filasEquipoCalendario,
    equipoSort.key,
    equipoSort.dir,
    resolveEquipoPersonaNombre,
    equipoCapTrabajoDiarioMinutos,
  ]);

  const equipoFilasVista = useMemo(() => {
    let rows = equipoFilasOrdenadas;
    switch (equipoTablaFiltroExtra) {
      case "soloSinImputar":
        rows = rows.filter((f) => f.kind === "sinImputar");
        break;
      case "soloSinParteServidor":
        rows = rows.filter(
          (f) => f.kind === "registro" && timeEntrySinParteEnServidor(f.e),
        );
        break;
      case "soloConParteServidor":
        rows = rows.filter(
          (f) => f.kind === "registro" && timeEntryConParteEnServidor(f.e),
        );
        break;
      default:
        break;
    }
    return rows;
  }, [equipoFilasOrdenadas, equipoTablaFiltroExtra]);

  const setEquipoSortColumn = useCallback((key: EquipoSortKey) => {
    setEquipoSort((s) => {
      if (s.key !== key) return { key, dir: "desc" };
      if (s.dir === "desc") return { key, dir: "asc" };
      return { key: null, dir: null };
    });
  }, []);

  const totalMinutosImputadosMes = useMemo(() => {
    if (equipoSummary?.workedMinutesTotal != null) {
      return Math.max(0, Math.round(equipoSummary.workedMinutesTotal));
    }
    return equipoRowsFiltradas.reduce((acc, e) => acc + effectiveWorkMinutesEntry(e), 0);
  }, [equipoSummary, equipoRowsFiltradas]);

  const totalHorasDecimalMes = useMemo(() => {
    if (equipoSummary?.workedHoursTotal != null) {
      const h = equipoSummary.workedHoursTotal;
      return Math.round(h * 10) / 10;
    }
    return Math.round((totalMinutosImputadosMes / 60) * 10) / 10;
  }, [equipoSummary, totalMinutosImputadosMes]);

  const diasLaborablesMesEquipo = useMemo(() => {
    if (equipoSummary?.workingDaysInRange != null) {
      return Math.max(0, Math.round(equipoSummary.workingDaysInRange));
    }
    if (!equipoRange) return 0;
    return diasCalendarioMesEquipo.filter((d) => !d.isWeekend).length;
  }, [equipoSummary, equipoRange, diasCalendarioMesEquipo]);

  /** Personas que cuentan para el objetivo teórico (API o eje del grid). */
  const personasEnObjetivo = useMemo(() => {
    if (
      equipoSummary?.scope?.peopleCount != null &&
      Number.isFinite(equipoSummary.scope.peopleCount) &&
      equipoSummary.scope.peopleCount > 0
    ) {
      return equipoSummary.scope.peopleCount;
    }
    return filtroPersonaEquipo === "todas" ? trabajadoresVistaEquipo.length : 1;
  }, [equipoSummary, filtroPersonaEquipo, trabajadoresVistaEquipo]);

  const horasObjetivoMesTeorico = useMemo(() => {
    if (equipoSummary?.theoreticalCapHours != null) {
      return Math.max(0, equipoSummary.theoreticalCapHours);
    }
    return diasLaborablesMesEquipo * 8 * personasEnObjetivo;
  }, [equipoSummary, diasLaborablesMesEquipo, personasEnObjetivo]);

  const horasImputadasDecimal = useMemo(() => {
    if (equipoSummary?.workedHoursTotal != null) {
      return Math.max(0, equipoSummary.workedHoursTotal);
    }
    return totalMinutosImputadosMes / 60;
  }, [equipoSummary, totalMinutosImputadosMes]);

  const horasFaltaParaObjetivo = useMemo(() => {
    if (equipoSummary?.donutObjectiveVsWorked) {
      return Math.max(0, equipoSummary.donutObjectiveVsWorked.hoursGapToObjective);
    }
    return Math.max(0, horasObjetivoMesTeorico - horasImputadasDecimal);
  }, [equipoSummary, horasObjetivoMesTeorico, horasImputadasDecimal]);

  const horasExtraSobreObjetivo = useMemo(() => {
    if (equipoSummary?.donutObjectiveVsWorked) {
      return Math.max(0, equipoSummary.donutObjectiveVsWorked.hoursExtraOverObjective);
    }
    return Math.max(0, horasImputadasDecimal - horasObjetivoMesTeorico);
  }, [equipoSummary, horasImputadasDecimal, horasObjetivoMesTeorico]);

  const hDonutImputado = useMemo(() => {
    if (equipoSummary?.donutObjectiveVsWorked) {
      return Math.max(0, equipoSummary.donutObjectiveVsWorked.hoursImputedUpToCap);
    }
    return Math.min(horasImputadasDecimal, horasObjetivoMesTeorico);
  }, [equipoSummary, horasImputadasDecimal, horasObjetivoMesTeorico]);

  const hDonutFalta = useMemo(() => {
    if (equipoSummary?.donutObjectiveVsWorked) {
      return Math.max(0, equipoSummary.donutObjectiveVsWorked.hoursGapToObjective);
    }
    return Math.max(0, horasObjetivoMesTeorico - horasImputadasDecimal);
  }, [equipoSummary, horasObjetivoMesTeorico, horasImputadasDecimal]);

  const hDonutExtra = useMemo(() => {
    if (equipoSummary?.donutObjectiveVsWorked) {
      return Math.max(0, equipoSummary.donutObjectiveVsWorked.hoursExtraOverObjective);
    }
    return Math.max(0, horasImputadasDecimal - horasObjetivoMesTeorico);
  }, [equipoSummary, horasImputadasDecimal, horasObjetivoMesTeorico]);

  const fichajeTipoStats = useMemo(() => {
    if (equipoSummary) {
      return {
        horasNormal: equipoSummary.normalHoursTotal,
        horasManual: equipoSummary.manualHoursTotal,
        registrosNormal: equipoSummary.normalEntryCount,
        registrosManual: equipoSummary.manualEntryCount,
      };
    }
    let minNormal = 0;
    let minManual = 0;
    let nNormal = 0;
    let nManual = 0;
    for (const e of equipoRowsFiltradas) {
      if (isSinJornadaImputableRazon(e.razon)) continue;
      const m = effectiveWorkMinutesEntry(e);
      if (e.razon === "imputacion_manual_error") {
        minManual += m;
        nManual += 1;
      } else {
        minNormal += m;
        nNormal += 1;
      }
    }
    return {
      horasNormal: minNormal / 60,
      horasManual: minManual / 60,
      registrosNormal: nNormal,
      registrosManual: nManual,
    };
  }, [equipoSummary, equipoRowsFiltradas]);

  const diasSinImputarEquipo = useMemo(() => {
    if (equipoSummary?.kpiTeamGrid) {
      return Math.max(0, Math.round(equipoSummary.kpiTeamGrid.slotsWithoutEntry));
    }
    return filasEquipoCalendario.filter((f) => f.kind === "sinImputar").length;
  }, [equipoSummary, filasEquipoCalendario]);
  /**
   * Mismo valor que «Falta para objetivo» (izquierda): tope mensual − imputado total.
   * No usar días_sin_imputar × 8: si un día con fichaje supera 8 h, 8×días + imputado puede
   * superar el tope y desincronizar las dos donas.
   */
  const horasSinImputarTipoFichaje = hDonutFalta;

  const partesEquipoStats = useMemo(() => {
    let diasImputados = 0;
    let diasConParte = 0;
    for (const f of filasEquipoCalendario) {
      if (f.kind !== "registro") continue;
      const e = f.e;
      if (isSinJornadaImputableRazon(e.razon)) continue;
      if (!e.checkOutUtc) continue;
      diasImputados += 1;
      if (timeEntryConParteEnServidor(e)) diasConParte += 1;
    }
    return { diasImputados, diasConParte };
  }, [filasEquipoCalendario, equipoPartsVersion]);

  /**
   * KPIs rejilla densa: cada fila es un par persona-día en el periodo.
   * Parte = mismo criterio que `timeEntryConParteEnServidor` (columna API).
   */
  const equipoRejillaParteStats = useMemo(() => {
    if (equipoSummary?.kpiTeamGrid) {
      const g = equipoSummary.kpiTeamGrid;
      return {
        totalCeldas: g.laborablePersonDaySlots,
        conFichajeCerrado: g.slotsWithClosedTimeEntry,
        conFichajeYParte: g.closedEntriesWithServerPart,
        conFichajeSinParte: g.closedEntriesWithoutServerPart,
      };
    }
    const totalCeldas = filasEquipoCalendario.length;
    let conFichajeCerrado = 0;
    let conFichajeYParte = 0;
    let conFichajeSinParte = 0;
    for (const f of filasEquipoCalendario) {
      if (f.kind !== "registro") continue;
      const e = f.e;
      if (isSinJornadaImputableRazon(e.razon)) continue;
      if (!e.checkOutUtc) continue;
      conFichajeCerrado += 1;
      if (timeEntryConParteEnServidor(e)) conFichajeYParte += 1;
      else conFichajeSinParte += 1;
    }
    return {
      totalCeldas,
      conFichajeCerrado,
      conFichajeYParte,
      conFichajeSinParte,
    };
  }, [equipoSummary, filasEquipoCalendario]);

  /** Jornadas laborables en rejilla (sinImputar + registro) vs filas con fichaje (registro). */
  const equipoJornadasFichajeStats = useMemo(() => {
    if (equipoSummary?.kpiTeamGrid) {
      const g = equipoSummary.kpiTeamGrid;
      const conFichaje =
        g.slotsWithAnyTimeEntry > 0 ? g.slotsWithAnyTimeEntry : g.slotsWithClosedTimeEntry;
      return {
        jornadasLaborables: g.laborablePersonDaySlots,
        conFichaje,
      };
    }
    let jornadasLaborables = 0;
    let conFichaje = 0;
    for (const f of filasEquipoCalendario) {
      if (f.kind === "sinImputar") {
        jornadasLaborables += 1;
      } else if (f.kind === "registro") {
        jornadasLaborables += 1;
        conFichaje += 1;
      }
    }
    return { jornadasLaborables, conFichaje };
  }, [equipoSummary, filasEquipoCalendario]);

  return {
    // filters
    filtroPersonaEquipo,
    setFiltroPersonaEquipo,
    equipoPeriodo,
    setEquipoPeriodo,
    equipoDia,
    setEquipoDia,
    equipoSemana,
    setEquipoSemana,
    mesEquipo,
    setMesEquipo,
    trimestreEquipo,
    setTrimestreEquipo,
    anioEquipo,
    setAnioEquipo,
    equipoAnioMesPagina,
    setEquipoAnioMesPagina,
    opcionesMesDentroAnioEquipo,
    equipoTablaFiltroExtra,
    setEquipoSoloSinImputar,
    setEquipoSoloSinParteServidor,
    setEquipoSoloConParteServidor,
    equipoBorrarFiltrosAlcance,
    opcionesMesEquipo,
    opcionesTrimestre,
    opcionesAnio,
    // data
    teamHistorialEntries,
    setTeamHistorialEntries,
    equipoWorkers,
    /** Trabajadores para el combo Persona (misma companyId de tenant que ClientCompanies). */
    equipoWorkersOpciones: includeExcludedFromTimeTracking
      ? equipoWorkers
      : equipoWorkers.filter((w) => !w.excludedFromTimeTracking),
    /** Mapa userId/legacy → nombre (tabla, CSV, orden). */
    equipoNombrePorClave,
    /** Etiqueta de persona coherente con usuarios API y fichajes. */
    resolveEquipoPersonaNombre,
    /** Para GET fichajes por filas: null si «Todas las personas» (no enviar userId). */
    equipoTimeEntriesUserIdForApi:
      filtroPersonaEquipo === "todas" ? null : filtroPersonaEquipo,
    equipoRowsLoading,
    equipoRowsError,
    equipoSummaryLoading,
    equipoSummaryError,
    /** totalCount devuelto por el API (primera página / metadatos). */
    equipoRowsTotalCount,
    /** Recuento coherente con GET /rows/summary para KPIs (si summary OK). */
    equipoRegistrosPeriodoKpi,
    refetchEquipoRows,
    setEquipoWorkers,
    equipoSuperAdminCompanyId,
    setEquipoSuperAdminCompanyId,
    equipoCompaniesCatalog,
    equipoCompaniesLoading,
    equipoCompaniesError,
    equipoServiceId,
    setEquipoServiceId,
    equipoServicesCatalog,
    equipoServicesLoading,
    equipoServicesError,
    equipoPartsVersion,
    setEquipoPartsVersion,
    // refs
    equipoTablaScrollRef,
    equipoRestaurarScroll,
    equipoMarcarRestaurarScroll,
    // computed
    equipoRange,
    equipoVistaRange,
    equipoRowsFiltradas,
    diasCalendarioMesEquipo,
    filasEquipoCalendario,
    equipoSort,
    equipoFilasOrdenadas,
    equipoFilasVista,
    /** Para columna «Extra» y export: minutos de jornada estándar/día (API summary). */
    equipoCapTrabajoDiarioMinutos,
    setEquipoSortColumn,
    totalMinutosImputadosMes,
    totalHorasDecimalMes,
    diasLaborablesMesEquipo,
    personasEnObjetivo,
    horasObjetivoMesTeorico,
    horasImputadasDecimal,
    horasFaltaParaObjetivo,
    horasExtraSobreObjetivo,
    hDonutImputado,
    hDonutFalta,
    hDonutExtra,
    fichajeTipoStats,
    diasSinImputarEquipo,
    horasSinImputarTipoFichaje,
    partesEquipoStats,
    equipoRejillaParteStats,
    equipoJornadasFichajeStats,
  };
}

// Re-export for use in useEquipoModal
export type UseEquipoResult = ReturnType<typeof useEquipo>;

// Export scroll helpers used in useEquipoModal
export { startTransition };
