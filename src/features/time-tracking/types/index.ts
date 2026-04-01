// Tipos locales del feature time-tracking
// Fuente original: app/dashboard/time-tracking/page.tsx

/** Motivo de imputación del registro horario. */
export type TimeEntryRazon =
  | "imputacion_normal"
  | "imputacion_manual_error"
  | "ausencia_vacaciones"
  | "ausencia_baja";

export interface TimeEntryMock {
  id: number;
  /** GUID real del fichaje en backend (`TimeEntries.Id`). */
  timeEntryId?: string | null;
  companyId?: string | null;
  workerId: number;
  userId?: string | null;
  workReportId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  workDate: string; // YYYY-MM-DD
  checkInUtc: string;
  checkOutUtc: string | null;
  isEdited: boolean;
  createdAtUtc: string;
  createdBy: number;
  updatedAtUtc: string | null;
  updatedBy: number | null;
  /** Minutos de descanso declarados por el trabajador al cerrar la jornada. */
  breakMinutes?: number;
  /** Cómo se ha imputado la jornada (fichaje normal vs corrección manual). */
  razon?: TimeEntryRazon;
  /** Entrada registrada vía "Olvidé fichar" (solo entrada); pendiente de salida normal. */
  entradaManual?: boolean;
  /** Salida indicada a posteriori (ej. olvidó fichar salida el día del registro). */
  salidaManual?: boolean;
  /** Usuario de la app que guardó por último (email). Lo enviará el back; mock en demo. */
  lastModifiedByEmail?: string | null;
  /** Nombre para mostrar del último editor (opcional, API). */
  lastModifiedByName?: string | null;
  /** Hora de entrada antes de la última modificación (UTC ISO). Mock / API. */
  previousCheckInUtc?: string | null;
  /** Hora de salida antes de la última modificación (null = sin salida registrada). */
  previousCheckOutUtc?: string | null;
  /** Nota opcional del administrador al corregir horario. */
  edicionNotaAdmin?: string | null;
  /**
   * El backend cerró la jornada a las 23:59 del mismo día (sin fichaje real de salida).
   * Hasta que el trabajador confirme entrada/salida/descanso reales, no puede fichar hoy.
   */
  cierreAutomaticoMedianoche?: boolean;
}

export type EquipoTablaFila =
  | { kind: "registro"; e: TimeEntryMock }
  | { kind: "noLaboral"; workerId: number; workDate: string }
  | { kind: "sinImputar"; workerId: number; workDate: string };

export type EquipoSortKey =
  | "persona"
  | "fecha"
  | "entrada"
  | "salida"
  | "entradaAntes"
  | "salidaAntes"
  | "descanso"
  | "razon"
  | "modificado"
  | "fechaMod"
  | "duracion";

export type ForgotStep =
  | "closed"
  | "pick_day"
  | "pick_type"
  | "solo_time"
  | "full_start"
  | "full_end"
  | "full_rest"
  | "full_rest_amount";

export type ForgotMode =
  | "solo_hoy"
  | "full_hoy"
  | "full_ayer"
  | "full_ultimo_laboral"
  | null;

export type AyerCompletaStep =
  | "closed"
  | "inicio"
  | "fin"
  | "descanso"
  | "descanso_cant";
