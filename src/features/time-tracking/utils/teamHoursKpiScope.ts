import type { EquipoTablaFila, TimeEntryMock } from "@/features/time-tracking/types";

import {

  equipoAbsenceEtiquetaKind,

  timeEntryConParteEnServidor,

} from "@/features/time-tracking/utils/formatters";

import type { TimeEntryRowsSummaryDto } from "@/services/time-tracking.service";



/**

 * Ausencias que no exigen parte ni se mezclan con «sin parte».

 */

export function isTimeEntryAbsenceForKpi(

  e: Pick<TimeEntryMock, "timeEntryStatus" | "rowKind">,

): boolean {

  const s = e.timeEntryStatus;

  return (

    s === "Vacation" ||

    s === "SickLeave" ||

    s === "NonWorkingDay" ||

    s === "FestivoEmpresa" ||

    e.rowKind === "companyHoliday"

  );

}



/** Solo la baja no suma en horas imputadas del KPI. */

export function isBajaDayForKpi(

  e: Pick<TimeEntryMock, "timeEntryStatus" | "razon" | "rowKind">,

): boolean {

  return equipoAbsenceEtiquetaKind(e) === "baja";

}



/** Vacaciones, festivo o baja: día cubierto sin parte de obra. */

export function isImputedAbsenceDayForKpi(

  e: Pick<TimeEntryMock, "timeEntryStatus" | "razon" | "rowKind">,

): boolean {

  const ausencia = equipoAbsenceEtiquetaKind(e);

  return ausencia === "vacaciones" || ausencia === "festivo_empresa" || ausencia === "baja";

}



/** Jornada de trabajo real (no ausencia): abierta o cerrada. */

export function isRealWorkTimeEntryForKpi(

  e: Pick<TimeEntryMock, "timeEntryStatus" | "rowKind">,

): boolean {

  if (isTimeEntryAbsenceForKpi(e)) return false;

  return e.timeEntryStatus === "Open" || e.timeEntryStatus === "Closed";

}



/**

 * Día laborable cubierto: trabajo real, vacaciones, festivo o baja.

 * Festivo cuenta como «ha fichado»; la baja también (sin horas imputadas).

 */

export function isCoveredLaborDayForKpi(

  e: Pick<TimeEntryMock, "timeEntryStatus" | "razon" | "rowKind">,

): boolean {

  const ausencia = equipoAbsenceEtiquetaKind(e);

  if (

    ausencia === "vacaciones" ||

    ausencia === "festivo_empresa" ||

    ausencia === "baja"

  ) {

    return true;

  }

  return isRealWorkTimeEntryForKpi(e);

}



/** Solo fichajes cerrados de trabajo real sin parte en servidor. */

export function isClosedWorkWithoutPartForKpi(e: TimeEntryMock): boolean {

  if (isTimeEntryAbsenceForKpi(e)) return false;

  return e.timeEntryStatus === "Closed" && !timeEntryConParteEnServidor(e);

}



export type TeamHoursKpiScopeCounts = {

  haFichado: number;

  sinFichar: number;

  vacaciones: number;
  bajas: number;
  sinParte: number;

  minutosImputados: number;

  jornadasLaborables: number;

  jornadasFichadas: number;

  jornadasCerradas: number;

  partesCompletados: number;

  jornadasFichadasPct: number;

  partesPct: number;

};



export function dailyCapMinutesFromSummary(summary: TimeEntryRowsSummaryDto | null): number {

  const h = summary?.hoursPerWorkingDay;

  if (h != null && Number.isFinite(h) && h > 0) return Math.round(h * 60);

  return 8 * 60;

}



function minutosImputadosFromSummary(summary: TimeEntryRowsSummaryDto | null): number {

  if (summary?.workedMinutesTotal != null && Number.isFinite(summary.workedMinutesTotal)) {

    return Math.max(0, Math.round(summary.workedMinutesTotal));

  }

  return 0;

}



export function workedMinutesForKpiDetail(e: TimeEntryMock): number {

  if (typeof e.workedMinutes === "number" && Number.isFinite(e.workedMinutes) && e.workedMinutes >= 0) {

    return Math.round(e.workedMinutes);

  }

  return 0;

}



/**

 * Minutos que suman al KPI de horas imputadas.

 * Excluye solo baja y día no laboral; vacaciones y festivo cuentan (con tope diario si el API no manda minutos).

 */

export function workedMinutesForKpiImputation(

  e: TimeEntryMock,

  dailyCapMinutes = 8 * 60,

): number {

  const ausencia = equipoAbsenceEtiquetaKind(e);

  if (ausencia === "baja" || ausencia === "no_laboral") return 0;



  const api = workedMinutesForKpiDetail(e);

  if (api > 0) return api;



  if (ausencia === "vacaciones" || ausencia === "festivo_empresa") {

    return Math.max(0, dailyCapMinutes);

  }



  if (e.timeEntryStatus === "Open" || e.timeEntryStatus === "Closed") {

    if (e.checkInUtc && e.checkOutUtc) {

      return Math.max(

        0,

        Math.round((new Date(e.checkOutUtc).getTime() - new Date(e.checkInUtc).getTime()) / 60000) -

          (e.breakMinutes ?? 0),

      );

    }

  }

  return 0;

}



/** Suma de minutos imputables desde la rejilla densa (solo excluye bajas). */

export function minutosImputadosFromFilas(

  filas: EquipoTablaFila[],

  dailyCapMinutes = 8 * 60,

): number {

  let total = 0;

  for (const fila of filas) {

    if (fila.kind !== "registro") continue;

    total += workedMinutesForKpiImputation(fila.e, dailyCapMinutes);

  }

  return total;

}



/**

 * Pills y minutos del banner verde (día/semana/mes).

 * - Minutos: rejilla local (solo baja excluida); si no hay filas, summary del API.

 * - Ha fichado / jornadas fichadas: trabajo, vacaciones, festivo o baja.

 */

export function buildTeamHoursKpiScopeFromFilas(

  filas: EquipoTablaFila[],

  summary: TimeEntryRowsSummaryDto | null,

): TeamHoursKpiScopeCounts {

  let haFichado = 0;

  let sinFichar = 0;

  let vacaciones = 0;
  let bajas = 0;
  let sinParte = 0;

  let jornadasLaborables = 0;

  let jornadasFichadas = 0;

  let jornadasCerradas = 0;

  let partesCompletados = 0;



  for (const fila of filas) {

    if (fila.kind === "sinImputar") {

      sinFichar += 1;

      jornadasLaborables += 1;

      continue;

    }

    if (fila.kind === "noLaboral") continue;

    if (fila.kind !== "registro") continue;



    const e = fila.e;

    const ausencia = equipoAbsenceEtiquetaKind(e);

    if (ausencia === "no_laboral") continue;



    jornadasLaborables += 1;



    if (ausencia === "vacaciones") {

      vacaciones += 1;

      haFichado += 1;

      jornadasFichadas += 1;

      continue;

    }

    if (ausencia === "festivo_empresa") {

      haFichado += 1;

      jornadasFichadas += 1;

      continue;

    }

    if (ausencia === "baja") {
      bajas += 1;
      haFichado += 1;

      jornadasFichadas += 1;

      continue;

    }



    if (isRealWorkTimeEntryForKpi(e)) {

      haFichado += 1;

      jornadasFichadas += 1;

    }

    if (e.timeEntryStatus === "Closed" && !isTimeEntryAbsenceForKpi(e)) {

      jornadasCerradas += 1;

      if (timeEntryConParteEnServidor(e)) partesCompletados += 1;

      else sinParte += 1;

    }

  }



  const dailyCap = dailyCapMinutesFromSummary(summary);

  const minutosDesdeFilas = minutosImputadosFromFilas(filas, dailyCap);

  const minutosImputados =

    filas.length > 0 ? minutosDesdeFilas : minutosImputadosFromSummary(summary);



  const jornadasFichadasPct =

    jornadasLaborables > 0 ? Math.round((jornadasFichadas / jornadasLaborables) * 100) : 0;

  const partesPct =

    jornadasCerradas > 0 ? Math.round((partesCompletados / jornadasCerradas) * 100) : 0;



  return {

    haFichado,

    sinFichar,

    vacaciones,
    bajas,
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



/** Minutos para totales locales cuando no hay summary (misma regla: solo baja excluida). */

export function workedMinutesForPeriodTotal(

  e: TimeEntryMock,

  dailyCapMinutes = 8 * 60,

): number {

  return workedMinutesForKpiImputation(e, dailyCapMinutes);

}



export type GridChartCounts = {

  jornadasLaborables: number;

  conFichaje: number;

  conFichajeYParte: number;

  /** Solo jornadas cerradas de trabajo real sin parte (no vacaciones/festivo/baja). */

  conFichajeSinParteLaboral: number;

  diasImputadosCerrados: number;

  diasConParte: number;

};



/**

 * Conteos para donas «Fichaje y parte» y «Días con parte» desde la rejilla densa.

 */

export function countGridCellsForCharts(filas: EquipoTablaFila[]): GridChartCounts {

  let jornadasLaborables = 0;

  let conFichaje = 0;

  let conFichajeYParte = 0;

  let conFichajeSinParteLaboral = 0;

  let diasImputadosCerrados = 0;

  let diasConParte = 0;



  for (const f of filas) {

    if (f.kind === "noLaboral") continue;

    if (f.kind === "sinImputar") {

      jornadasLaborables += 1;

      continue;

    }

    if (f.kind !== "registro") continue;



    const ausencia = equipoAbsenceEtiquetaKind(f.e);

    if (ausencia === "no_laboral") continue;



    jornadasLaborables += 1;



    if (isCoveredLaborDayForKpi(f.e)) {

      conFichaje += 1;

    }



    if (f.e.timeEntryStatus === "Closed" && !isTimeEntryAbsenceForKpi(f.e)) {

      diasImputadosCerrados += 1;

      if (timeEntryConParteEnServidor(f.e)) {

        conFichajeYParte += 1;

        diasConParte += 1;

      } else {

        conFichajeSinParteLaboral += 1;

      }

    }

  }



  return {

    jornadasLaborables,

    conFichaje,

    conFichajeYParte,

    conFichajeSinParteLaboral,

    diasImputadosCerrados,

    diasConParte,

  };

}


