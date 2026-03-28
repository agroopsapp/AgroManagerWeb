"use client";
import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MOCK_WORKERS_FICHA,
  createTeamHistorialDemo,
  workerNameById,
} from "@/mocks/time-tracking.mock";
import {
  currentMonthLocalISO,
  currentYearLocal,
  formatDateES,
  listDaysInRange,
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
  isAusenciaRazon,
  RAZON_NO_LABORAL,
  RAZON_SIN_IMPUTAR,
} from "@/features/time-tracking/utils/formatters";
import { getWorkPartsForWorker } from "@/lib/workPartsStorage";
import type { TimeEntryMock, EquipoTablaFila, EquipoSortKey } from "@/features/time-tracking/types";

// ----- Constants & module-level helpers -----

const EQUIPO_HISTORIAL_STORAGE_KEY = "agro-equipo-historial-v1";

function parseStoredTimeEntries(raw: string | null): TimeEntryMock[] | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return null;
    const ok = p.every(
      (e: unknown) =>
        e !== null &&
        typeof e === "object" &&
        typeof (e as TimeEntryMock).id === "number" &&
        typeof (e as TimeEntryMock).workDate === "string" &&
        typeof (e as TimeEntryMock).checkInUtc === "string" &&
        ((e as TimeEntryMock).checkOutUtc === null ||
          typeof (e as TimeEntryMock).checkOutUtc === "string")
    );
    return ok ? (p as TimeEntryMock[]) : null;
  } catch {
    return null;
  }
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
  asc: boolean
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
    case "persona":
      cmp = workerNameById(wid(a)).localeCompare(workerNameById(wid(b)), "es", {
        sensitivity: "base",
      });
      break;
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
  dir: "asc" | "desc"
): EquipoTablaFila[] {
  const asc = dir === "asc";
  return [...filas].sort((a, b) => compareEquipoFila(a, b, key, asc));
}

// ----- Hook -----

export function useEquipo() {
  const [filtroPersonaEquipo, setFiltroPersonaEquipo] = useState<number | "todas">("todas");
  const [equipoPeriodo, setEquipoPeriodo] = useState<"dia" | "mes" | "trimestre" | "anio">("mes");
  const [equipoDia, setEquipoDia] = useState(localTodayISO());
  const [mesEquipo, setMesEquipo] = useState(currentMonthLocalISO);
  const [trimestreEquipo, setTrimestreEquipo] = useState(() => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${q}`;
  });
  const [anioEquipo, setAnioEquipo] = useState(currentYearLocal());

  const opcionesMesEquipo = useMemo(() => monthSelectOptions(12), []);
  const opcionesTrimestre = useMemo(() => quarterOptions(3), []);
  const opcionesAnio = useMemo(() => yearOptions(6), []);

  const [teamHistorialEntries, setTeamHistorialEntries] = useState<TimeEntryMock[]>(() =>
    createTeamHistorialDemo()
  );
  const [equipoHistorialListo, setEquipoHistorialListo] = useState(false);

  const equipoTablaScrollRef = useRef<HTMLDivElement>(null);
  const equipoRestaurarScroll = useRef<{ top: number; left: number } | null>(null);
  const equipoMarcarRestaurarScroll = useRef(false);

  // Load from sessionStorage on mount
  useEffect(() => {
    try {
      const raw =
        typeof window !== "undefined"
          ? sessionStorage.getItem(EQUIPO_HISTORIAL_STORAGE_KEY)
          : null;
      const parsed = parseStoredTimeEntries(raw);
      if (parsed !== null && parsed.length > 0) {
        setTeamHistorialEntries(parsed);
      }
    } catch {
      /* ignore */
    }
    setEquipoHistorialListo(true);
  }, []);

  // Persist to sessionStorage
  useEffect(() => {
    if (!equipoHistorialListo || typeof window === "undefined") return;
    try {
      sessionStorage.setItem(EQUIPO_HISTORIAL_STORAGE_KEY, JSON.stringify(teamHistorialEntries));
    } catch {
      /* quota */
    }
  }, [teamHistorialEntries, equipoHistorialListo]);

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

  // ----- Derived / memos -----

  const equipoRange = useMemo(() => {
    if (equipoPeriodo === "dia") {
      const d = equipoDia;
      return { label: formatDateES(d), start: d, end: d };
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
  }, [equipoPeriodo, equipoDia, mesEquipo, trimestreEquipo, anioEquipo]);

  const equipoRowsFiltradas = useMemo(() => {
    if (!equipoRange) return [];
    let rows = teamHistorialEntries.filter(
      (e) => e.workDate >= equipoRange.start && e.workDate <= equipoRange.end
    );
    if (filtroPersonaEquipo !== "todas") {
      rows = rows.filter((e) => e.workerId === filtroPersonaEquipo);
    }
    return rows;
  }, [teamHistorialEntries, filtroPersonaEquipo, equipoRange]);

  const entriesMesEquipoPorTrabajador = useMemo(() => {
    const map = new Map<string, TimeEntryMock>();
    if (!equipoRange) return map;
    for (const e of teamHistorialEntries) {
      if (e.workDate < equipoRange.start || e.workDate > equipoRange.end) continue;
      map.set(`${e.workerId}-${e.workDate}`, e);
    }
    return map;
  }, [teamHistorialEntries, equipoRange]);

  const trabajadoresVistaEquipo = useMemo(
    () =>
      filtroPersonaEquipo === "todas"
        ? MOCK_WORKERS_FICHA.map((w) => w.id)
        : [filtroPersonaEquipo as number],
    [filtroPersonaEquipo]
  );

  const diasCalendarioMesEquipo = useMemo(() => {
    if (!equipoRange) return [];
    return listDaysInRange(equipoRange.start, equipoRange.end);
  }, [equipoRange]);

  const filasEquipoCalendario = useMemo(() => {
    const filas: EquipoTablaFila[] = [];
    for (const wid of trabajadoresVistaEquipo) {
      for (const { workDate, isWeekend } of diasCalendarioMesEquipo) {
        if (isWeekend) {
          const we = entriesMesEquipoPorTrabajador.get(`${wid}-${workDate}`);
          if (we) {
            filas.push({ kind: "registro", e: we });
          } else {
            filas.push({ kind: "noLaboral", workerId: wid, workDate });
          }
        } else {
          const e = entriesMesEquipoPorTrabajador.get(`${wid}-${workDate}`);
          if (e) filas.push({ kind: "registro", e });
          else filas.push({ kind: "sinImputar", workerId: wid, workDate });
        }
      }
    }
    return filas;
  }, [trabajadoresVistaEquipo, diasCalendarioMesEquipo, entriesMesEquipoPorTrabajador]);

  const [equipoSort, setEquipoSort] = useState<{
    key: EquipoSortKey | null;
    dir: "asc" | "desc" | null;
  }>({ key: null, dir: null });

  const equipoFilasOrdenadas = useMemo(() => {
    if (equipoSort.key == null || equipoSort.dir == null) {
      return sortEquipoFilasOrigen(filasEquipoCalendario);
    }
    return sortEquipoFilas(filasEquipoCalendario, equipoSort.key, equipoSort.dir);
  }, [filasEquipoCalendario, equipoSort.key, equipoSort.dir]);

  const setEquipoSortColumn = (key: EquipoSortKey) => {
    setEquipoSort((s) => {
      if (s.key !== key) return { key, dir: "desc" };
      if (s.dir === "desc") return { key, dir: "asc" };
      return { key: null, dir: null };
    });
  };

  const totalMinutosImputadosMes = useMemo(
    () => equipoRowsFiltradas.reduce((acc, e) => acc + effectiveWorkMinutesEntry(e), 0),
    [equipoRowsFiltradas]
  );
  const totalHorasDecimalMes = Math.round((totalMinutosImputadosMes / 60) * 10) / 10;

  const diasLaborablesMesEquipo = useMemo(() => {
    if (!equipoRange) return 0;
    return diasCalendarioMesEquipo.filter((d) => !d.isWeekend).length;
  }, [equipoRange, diasCalendarioMesEquipo]);

  const personasEnObjetivo =
    filtroPersonaEquipo === "todas" ? MOCK_WORKERS_FICHA.length : 1;
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
      if (isAusenciaRazon(e.razon)) continue;
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
  const horasSinImputarTipoFichaje = diasSinImputarEquipo * 8;

  const partesEquipoStats = useMemo(() => {
    const keyHasPart = new Set<string>();
    for (const wid of trabajadoresVistaEquipo) {
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
      if (isAusenciaRazon(e.razon)) continue;
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
    mesEquipo,
    setMesEquipo,
    trimestreEquipo,
    setTrimestreEquipo,
    anioEquipo,
    setAnioEquipo,
    opcionesMesEquipo,
    opcionesTrimestre,
    opcionesAnio,
    // data
    teamHistorialEntries,
    setTeamHistorialEntries,
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
