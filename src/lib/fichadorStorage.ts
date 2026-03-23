/** Misma clave que en time-tracking (localStorage). */
export const FICHADOR_STORAGE_KEY = "agro-fichador-entries-v1";

export function localCalendarISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type FichajeHoyEstado = "sin_entrada" | "jornada_abierta" | "jornada_cerrada";

type EntryLike = {
  checkInUtc: string;
  checkOutUtc: string | null;
  workDate?: string; // YYYY-MM-DD
  breakMinutes?: number;
  razon?: string;
};

function formatHoraLocalEs(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function esAusenciaRazon(razon: string | undefined): boolean {
  return razon === "ausencia_vacaciones" || razon === "ausencia_baja";
}

/** Duración en minutos entre dos ISO UTC; null si inválido. */
function minutosBrutos(inIso: string, outIso: string): number | null {
  const a = new Date(inIso).getTime();
  const b = new Date(outIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return Math.round((b - a) / 60000);
}

/** Etiqueta legible para minutos trabajados (efectivos). */
export function formatDuracionImputacionEs(totalMin: number): string {
  if (totalMin <= 0) return "0 min";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Resumen de imputación del día actual (calendario local) para el trabajador. */
export type ResumenImputacionHoy =
  | { estado: "sin_imputar" }
  | {
      estado: "falta_salida";
      horaEntradaLocal: string;
      checkInUtc: string;
    }
  | {
      estado: "completa";
      horaEntradaLocal: string;
      horaSalidaLocal: string;
      minutosEfectivos: number;
      minutosBrutos: number;
      esAusencia: boolean;
      esManual: boolean;
    };

function esManualRazon(razon: string | undefined): boolean {
  return razon === "imputacion_manual_error";
}

/**
 * Resumen de imputación para una fecha concreta (calendario local) del trabajador.
 * workDate: YYYY-MM-DD
 */
export function leerResumenImputacionParaFecha(
  workerId: number = 1,
  workDate: string
): ResumenImputacionHoy {
  if (typeof window === "undefined") return { estado: "sin_imputar" };
  try {
    const raw = localStorage.getItem(FICHADOR_STORAGE_KEY);
    if (!raw) return { estado: "sin_imputar" };
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return { estado: "sin_imputar" };
    const dayEntries = p.filter(
      (e: unknown) =>
        e !== null &&
        typeof e === "object" &&
        (e as { workerId?: number }).workerId === workerId &&
        (e as { workDate?: string }).workDate === workDate
    ) as EntryLike[];
    if (dayEntries.length === 0) return { estado: "sin_imputar" };
    const latest = [...dayEntries].sort(
      (a, b) => new Date(b.checkInUtc).getTime() - new Date(a.checkInUtc).getTime()
    )[0];
    const out = latest.checkOutUtc;
    if (out == null || out === "") {
      return {
        estado: "falta_salida",
        horaEntradaLocal: formatHoraLocalEs(latest.checkInUtc),
        checkInUtc: latest.checkInUtc,
      };
    }
    const bruto = minutosBrutos(latest.checkInUtc, out) ?? 0;
    const ausencia = esAusenciaRazon(latest.razon);
    const manual = esManualRazon(latest.razon);
    const descanso = latest.breakMinutes ?? 0;
    const efectivo = ausencia ? 0 : Math.max(0, bruto - descanso);
    return {
      estado: "completa",
      horaEntradaLocal: formatHoraLocalEs(latest.checkInUtc),
      horaSalidaLocal: formatHoraLocalEs(out),
      minutosEfectivos: efectivo,
      minutosBrutos: bruto,
      esAusencia: ausencia,
      esManual: manual,
    };
  } catch {
    return { estado: "sin_imputar" };
  }
}

/** Resumen de imputación para HOY (calendario local). */
export function leerResumenImputacionHoy(workerId: number = 1): ResumenImputacionHoy {
  return leerResumenImputacionParaFecha(workerId, localCalendarISO(new Date()));
}

/** Estado del fichaje del usuario con sesión para el día calendario local actual. */
export function leerEstadoFichajeHoy(workerId: number = 1): FichajeHoyEstado {
  const r = leerResumenImputacionHoy(workerId);
  if (r.estado === "sin_imputar") return "sin_entrada";
  if (r.estado === "falta_salida") return "jornada_abierta";
  return "jornada_cerrada";
}

export function leerEstadoFichajeParaFecha(
  workerId: number = 1,
  workDate: string
): FichajeHoyEstado {
  const r = leerResumenImputacionParaFecha(workerId, workDate);
  if (r.estado === "sin_imputar") return "sin_entrada";
  if (r.estado === "falta_salida") return "jornada_abierta";
  return "jornada_cerrada";
}
