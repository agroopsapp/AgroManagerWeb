// Tipos locales del feature time-tracking
// Fuente original: app/dashboard/time-tracking/page.tsx

/** Valores exactos de `status` en JSON del API de fichajes (sin normalizar mayúsculas). */
export type TimeEntryApiStatus =
  | "Open"
  | "Closed"
  | "Vacation"
  | "SickLeave"
  | "NonWorkingDay";

/** Motivo de imputación del registro horario. */
export type TimeEntryRazon =
  | "imputacion_normal"
  | "imputacion_manual_error"
  | "ausencia_vacaciones"
  | "ausencia_baja"
  | "dia_no_laboral";

export interface TimeEntryMock {
  id: number;
  /** GUID real del fichaje en backend (`TimeEntries.Id`). */
  timeEntryId?: string | null;
  companyId?: string | null;
  /** Ids de empresa cliente en el parte (`clientCompanyIdsInReport` en TimeEntries/rows). */
  clientCompanyIdsInReport?: string[] | null;
  workerId: number;
  userId?: string | null;
  workReportId?: string | null;
  /** Estado del parte en servidor (p. ej. GET /TimeEntries/rows). */
  workReportStatus?: string | null;
  /** Número de líneas del parte en servidor. */
  workReportLineCount?: number | null;
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
  /** Minutos netos trabajados según API (p. ej. GET /TimeEntries/rows); prioridad en stats si viene informado. */
  workedMinutes?: number | null;
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
  /** Zona o ubicación de trabajo si el API la envía en GET /TimeEntries/rows. */
  workAreaName?: string | null;
  /**
   * El backend cerró la jornada a las 23:59 del mismo día (sin fichaje real de salida).
   * Hasta que el trabajador confirme entrada/salida/descanso reales, no puede fichar hoy.
   */
  cierreAutomaticoMedianoche?: boolean;
  /**
   * Estado de la jornada según el backend (campo JSON `status`, camelCase).
   * Si el valor no está en la lista blanca del API → `"unknown"` (UI gris).
   */
  timeEntryStatus?: TimeEntryApiStatus | "unknown" | null;
}

export type EquipoTablaFila =
  | { kind: "registro"; e: TimeEntryMock }
  | {
      kind: "noLaboral";
      /** userId de aplicación (GUID) o clave `legacy:{workerId}` si el fichaje no trae userId. */
      userId: string;
      workerId: number;
      workDate: string;
      displayName?: string;
    }
  | {
      kind: "sinImputar";
      userId: string;
      workerId: number;
      workDate: string;
      displayName?: string;
    };

/** Usuario en el filtro «Persona» (GET /api/Users → `id` = userId GUID). */
export interface EquipoWorkerOption {
  id: string;
  name: string;
  companyId?: string | null;
}

/** Filtro extra de la tabla equipo: solo uno activo (comportamiento tipo radio). */
export type EquipoTablaFiltroExtra =
  | "ninguno"
  | "soloSinImputar"
  | "soloSinParteServidor"
  | "soloConParteServidor";

export type EquipoSortKey =
  | "persona"
  | "fecha"
  | "entrada"
  | "salida"
  | "entradaAntes"
  | "salidaAntes"
  | "descanso"
  | "estado"
  | "razon"
  | "modificado"
  | "fechaMod"
  | "duracion"
  | "extra";

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

/** Calendario público de empresa: festivos y vacaciones (referencia visual; persistencia local hasta API). */
export type CalendarioLaboralMarkKind = "festivo" | "vacaciones";

export type CalendarioLaboralDayMark = {
  kind: CalendarioLaboralMarkKind;
  /** Texto breve opcional (p. ej. nombre del festivo). */
  note?: string;
};
