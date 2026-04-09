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
  effectiveWorkMinutesEntry,
  formatLastModifiedByUser,
  formatRazon,
  isSinJornadaImputableRazon,
  RAZON_NO_LABORAL,
  RAZON_SIN_IMPUTAR,
  timeEntryConParteEnServidor,
  timeEntrySinParteEnServidor,
} from "@/features/time-tracking/utils/formatters";
import { ApiError } from "@/lib/api-client";
import { getWorkPartsForWorker } from "@/lib/workPartsStorage";
import { companiesApi, timeTrackingApi, usersApi, workServicesApi } from "@/services";
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
  getPersonaLabel?: (f: EquipoTablaFila) => string
): number {
  const m = asc ? 1 : -1;
  const ts = (iso: string | null | undefined) =>
    iso ? new Date(iso).getTime() : Number.NaN;
  const reg = (f: EquipoTablaFila) => (f.kind === "registro" ? f.e : null);
  const wid = (f: EquipoTablaFila) => (f.kind === "registro" ? f.e.workerId : f.workerId);
  const wd = (f: EquipoTablaFila) => (f.kind === "registro" ? f.e.workDate : f.workDate);
  const razonTxt = (f: EquipoTablaFila) => {
    if (f.kind === "registro") return formatRazon(f.e.razon);
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
  getPersonaLabel?: (f: EquipoTablaFila) => string
): EquipoTablaFila[] {
  const asc = dir === "asc";
  return [...filas].sort((a, b) => compareEquipoFila(a, b, key, asc, getPersonaLabel));
}

export type UseEquipoOptions = {
  /**
   * Si true, carga el catálogo de empresas (ClientCompanies) y filtra usuarios/fichajes por `companyId`.
   * Usar en SuperAdmin, Manager y Admin en vistas de equipo.
   */
  enableEquipoCompanyFilter?: boolean;
};

// ----- Hook -----

export function useEquipo(options?: UseEquipoOptions) {
  const enableEquipoCompanyFilter = options?.enableEquipoCompanyFilter === true;
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

  const opcionesMesEquipo = useMemo(() => monthSelectOptions(12), []);
  const opcionesTrimestre = useMemo(() => quarterOptions(3), []);
  const opcionesAnio = useMemo(() => yearOptions(6), []);

  const [teamHistorialEntries, setTeamHistorialEntries] = useState<TimeEntryMock[]>([]);
  /** Trabajadores para filtro «Persona»; rellenar desde API (p. ej. grid horas equipo). */
  const [equipoWorkers, setEquipoWorkers] = useState<EquipoWorkerOption[]>([]);
  const [equipoRowsLoading, setEquipoRowsLoading] = useState(false);
  const [equipoRowsError, setEquipoRowsError] = useState<string | null>(null);
  const [equipoRowsTotalCount, setEquipoRowsTotalCount] = useState(0);
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
          e instanceof ApiError && e.message.trim()
            ? e.message.trim()
            : "No se pudieron cargar los servicios.",
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
   * Filtro por servicio en API: el grid denso sigue generando celdas «sin imputar» por calendario.
   * Forzar «solo con parte en servidor» al elegir servicio evita filas vacías irrelevantes; al quitar
   * servicio se desactiva ese checkbox (vuelve la vista completa del periodo).
   */
  useEffect(() => {
    setEquipoTablaFiltroExtra(equipoServiceId?.trim() ? "soloConParteServidor" : "ninguno");
  }, [equipoServiceId]);

  /** Trabajadores (GET /api/Users). Misma companyId de tenant que las ClientCompanies del combo Empresa. */
  useEffect(() => {
    if (!enableEquipoCompanyFilter) {
      setEquipoWorkers([]);
      return;
    }
    const ac = new AbortController();
    usersApi
      .getAll(undefined, { signal: ac.signal })
      .then((list) => {
        setEquipoWorkers(
          list.map((u) => ({
            id: u.id,
            name: u.name,
            companyId: u.companyId ?? null,
          })),
        );
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setEquipoWorkers([]);
      });
    return () => ac.abort();
  }, [enableEquipoCompanyFilter]);

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

  /** Grid equipo: GET /api/TimeEntries/rows (todas las páginas → cruce denso en cliente). */
  useEffect(() => {
    if (!equipoRange) {
      setTeamHistorialEntries([]);
      setEquipoRowsTotalCount(0);
      setEquipoRowsError(null);
      setEquipoRowsLoading(false);
      return;
    }

    const ac = new AbortController();
    const seq = ++equipoFetchSeq.current;
    const userIdForApi =
      filtroPersonaEquipo === "todas" ? undefined : filtroPersonaEquipo.trim();

    setEquipoRowsLoading(true);
    setEquipoRowsError(null);

    timeTrackingApi
      .getTimeEntryRowsAllItems({
        from: equipoRange.start,
        to: equipoRange.end,
        userId: userIdForApi,
        serviceId: equipoServiceId?.trim() || undefined,
        signal: ac.signal,
      })
      .then(({ items, totalCount }: { items: unknown[]; totalCount: number }) => {
        if (seq !== equipoFetchSeq.current) return;
        const mapped = items
          .map(mapTimeEntryRowsItemToMock)
          .filter((x: TimeEntryMock | null): x is TimeEntryMock => x != null);
        setTeamHistorialEntries(mapped);
        setEquipoRowsTotalCount(totalCount);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        if (seq !== equipoFetchSeq.current) return;
        if (e instanceof ApiError) {
          setEquipoRowsError(e.message);
        } else if (e instanceof DOMException && e.name === "AbortError") {
          return;
        } else if (e instanceof Error && e.name === "AbortError") {
          return;
        } else {
          setEquipoRowsError("No se pudieron cargar los fichajes del equipo.");
        }
        setTeamHistorialEntries([]);
        setEquipoRowsTotalCount(0);
      })
      .finally(() => {
        if (seq === equipoFetchSeq.current) setEquipoRowsLoading(false);
      });

    return () => ac.abort();
  }, [
    equipoRange?.start,
    equipoRange?.end,
    filtroPersonaEquipo,
    equipoServiceId,
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

  /** Nombres para tabla/CSV/orden (usuarios API + fallback desde fichajes legacy). */
  const equipoNombrePorClave = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of equipoWorkers) {
      if (w.id) m.set(w.id, w.name);
    }
    for (const e of entriesVistaEquipo) {
      const pk = entryStablePersonKey(e);
      if (!pk || m.has(pk)) continue;
      m.set(pk, workerNameById(e.workerId));
    }
    return m;
  }, [equipoWorkers, entriesVistaEquipo]);

  const resolveEquipoPersonaNombre = useMemo(
    () => buildPersonaSortLabel(equipoNombrePorClave),
    [equipoNombrePorClave]
  );

  const equipoRowsFiltradas = useMemo(() => {
    if (!equipoRange) return [];
    let rows = entriesVistaEquipo.filter(
      (e) => e.workDate >= equipoRange.start && e.workDate <= equipoRange.end
    );
    if (filtroPersonaEquipo !== "todas") {
      rows = rows.filter((e) => entryStablePersonKey(e) === filtroPersonaEquipo);
    }
    return rows;
  }, [entriesVistaEquipo, filtroPersonaEquipo, equipoRange]);

  /** Fichajes del API en [from,to], indexados para el cruce con el calendario denso. */
  const entriesMesEquipoPorPersona = useMemo(() => {
    if (!equipoRange) return new Map<string, TimeEntryMock>();
    return indexEquipoEntriesByPersonAndDate(
      entriesVistaEquipo,
      equipoRange.start,
      equipoRange.end
    );
  }, [entriesVistaEquipo, equipoRange]);

  /**
   * Eje de personas del grid: persona concreta, lista de trabajadores del API,
   * o claves deducidas de fichajes si aún no hay usuarios cargados.
   */
  const trabajadoresVistaEquipo = useMemo(() => {
    if (filtroPersonaEquipo !== "todas") {
      return [filtroPersonaEquipo];
    }
    if (!equipoRange) return [];
    if (equipoWorkers.length > 0) {
      return equipoWorkers.map((w) => w.id);
    }
    return uniquePersonKeysInRange(entriesVistaEquipo, equipoRange.start, equipoRange.end);
  }, [filtroPersonaEquipo, equipoWorkers, entriesVistaEquipo, equipoRange]);

  const diasCalendarioMesEquipo = useMemo(() => {
    if (!equipoRange) return [];
    return listDaysInRange(equipoRange.start, equipoRange.end);
  }, [equipoRange]);

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
      resolveEquipoPersonaNombre
    );
  }, [
    filasEquipoCalendario,
    equipoSort.key,
    equipoSort.dir,
    resolveEquipoPersonaNombre,
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

  const totalMinutosImputadosMes = useMemo(
    () => equipoRowsFiltradas.reduce((acc, e) => acc + effectiveWorkMinutesEntry(e), 0),
    [equipoRowsFiltradas]
  );
  const totalHorasDecimalMes = Math.round((totalMinutosImputadosMes / 60) * 10) / 10;

  const diasLaborablesMesEquipo = useMemo(() => {
    if (!equipoRange) return 0;
    return diasCalendarioMesEquipo.filter((d) => !d.isWeekend).length;
  }, [equipoRange, diasCalendarioMesEquipo]);

  /** Personas que cuentan para el objetivo teórico = mismo eje que el grid denso. */
  const personasEnObjetivo =
    filtroPersonaEquipo === "todas" ? trabajadoresVistaEquipo.length : 1;
  const horasObjetivoMesTeorico = diasLaborablesMesEquipo * 8 * personasEnObjetivo;
  const horasImputadasDecimal = totalMinutosImputadosMes / 60;
  const horasFaltaParaObjetivo = Math.max(0, horasObjetivoMesTeorico - horasImputadasDecimal);
  const horasExtraSobreObjetivo = Math.max(0, horasImputadasDecimal - horasObjetivoMesTeorico);
  const hDonutImputado = Math.min(horasImputadasDecimal, horasObjetivoMesTeorico);
  const hDonutFalta = Math.max(0, horasObjetivoMesTeorico - horasImputadasDecimal);
  const hDonutExtra = Math.max(0, horasImputadasDecimal - horasObjetivoMesTeorico);

  const fichajeTipoStats = useMemo(() => {
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
  }, [equipoRowsFiltradas]);

  const diasSinImputarEquipo = useMemo(
    () => filasEquipoCalendario.filter((f) => f.kind === "sinImputar").length,
    [filasEquipoCalendario]
  );
  /**
   * Mismo valor que «Falta para objetivo» (izquierda): tope mensual − imputado total.
   * No usar días_sin_imputar × 8: si un día con fichaje supera 8 h, 8×días + imputado puede
   * superar el tope y desincronizar las dos donas.
   */
  const horasSinImputarTipoFichaje = hDonutFalta;

  const partesEquipoStats = useMemo(() => {
    const keyHasPart = new Set<string>();
    for (const pk of trabajadoresVistaEquipo) {
      const wid = workerIdFromPersonKey(pk);
      const list = getWorkPartsForWorker(wid);
      for (const p of list) {
        if (!p?.workDate) continue;
        if (p.workDate.slice(0, 7) !== mesEquipo) continue;
        keyHasPart.add(`${wid}-${p.workDate}`);
      }
    }
    let diasImputados = 0;
    let diasConParte = 0;
    for (const f of filasEquipoCalendario) {
      if (f.kind !== "registro") continue;
      const e = f.e;
      if (isSinJornadaImputableRazon(e.razon)) continue;
      if (!e.checkOutUtc) continue;
      diasImputados += 1;
      if (keyHasPart.has(`${e.workerId}-${e.workDate}`)) diasConParte += 1;
    }
    return { diasImputados, diasConParte };
  }, [filasEquipoCalendario, trabajadoresVistaEquipo, mesEquipo, equipoPartsVersion]);

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
    equipoTablaFiltroExtra,
    setEquipoSoloSinImputar,
    setEquipoSoloSinParteServidor,
    setEquipoSoloConParteServidor,
    opcionesMesEquipo,
    opcionesTrimestre,
    opcionesAnio,
    // data
    teamHistorialEntries,
    setTeamHistorialEntries,
    equipoWorkers,
    /** Trabajadores para el combo Persona (misma companyId de tenant que ClientCompanies). */
    equipoWorkersOpciones: equipoWorkers,
    /** Mapa userId/legacy → nombre (tabla, CSV, orden). */
    equipoNombrePorClave,
    /** Etiqueta de persona coherente con usuarios API y fichajes. */
    resolveEquipoPersonaNombre,
    /** Para GET fichajes por filas: null si «Todas las personas» (no enviar userId). */
    equipoTimeEntriesUserIdForApi:
      filtroPersonaEquipo === "todas" ? null : filtroPersonaEquipo,
    equipoRowsLoading,
    equipoRowsError,
    /** totalCount devuelto por el API (primera página / metadatos). */
    equipoRowsTotalCount,
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
    equipoRowsFiltradas,
    diasCalendarioMesEquipo,
    filasEquipoCalendario,
    equipoSort,
    equipoFilasOrdenadas,
    equipoFilasVista,
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
  };
}

// Re-export for use in useEquipoModal
export type UseEquipoResult = ReturnType<typeof useEquipo>;

// Export scroll helpers used in useEquipoModal
export { startTransition };
