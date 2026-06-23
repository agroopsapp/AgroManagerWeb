import type { EquipoTablaFila } from "@/features/time-tracking/types";
import {
  equipoAbsenceEtiquetaKind,
  timeEntryConParteEnServidor,
} from "@/features/time-tracking/utils/formatters";

export type TeamHoursTodaySummary = ReturnType<typeof buildTeamHoursTodaySummary>;

export function getEquipoFilaWorkDate(fila: EquipoTablaFila): string | null {
  return fila.kind === "registro"
    ? fila.e.workDate
    : fila.kind === "noLaboral" || fila.kind === "sinImputar"
      ? fila.workDate
      : null;
}

export function buildTeamHoursTodaySummary(
  filas: EquipoTablaFila[],
  diaSeleccionado: string,
) {
  let empezadas = 0;
  let vacaciones = 0;
  let baja = 0;
  let noLaboral = 0;
  let sinFichar = 0;
  let sinParte = 0;
  let itemsTarjeta = 0;

  for (const f of filas) {
    const workDate = getEquipoFilaWorkDate(f);
    if (!workDate || workDate !== diaSeleccionado) continue;

    if (f.kind === "noLaboral") {
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

    if (abs === "vacaciones") {
      vacaciones += 1;
      empezadas += 1;
      itemsTarjeta += 1;
      continue;
    }
    if (abs === "festivo_empresa") {
      empezadas += 1;
      itemsTarjeta += 1;
      continue;
    }
    if (abs === "baja") {
      baja += 1;
      empezadas += 1;
      itemsTarjeta += 1;
      continue;
    }
    if (abs === "no_laboral") continue;

    if (e.timeEntryStatus === "Open" || e.timeEntryStatus === "Closed") {
      empezadas += 1;
    }
    if (e.timeEntryStatus === "Closed" && !timeEntryConParteEnServidor(e)) {
      sinParte += 1;
      itemsTarjeta += 1;
    }
  }

  return {
    diaSeleccionado,
    filas,
    counts: {
      empezadas,
      vacaciones,
      baja,
      noLaboral,
      sinFichar,
      sinParte,
      pendientesCriticos: sinFichar + sinParte,
      itemsTarjeta,
    },
  };
}

export function isTeamHoursTodaySummaryVisibleRow(
  fila: EquipoTablaFila,
  diaSeleccionado: string,
) {
  const workDate = getEquipoFilaWorkDate(fila);
  if (!workDate || workDate !== diaSeleccionado) return false;
  if (fila.kind === "sinImputar") return true;
  if (fila.kind === "noLaboral" || fila.kind !== "registro") return false;

  const abs = equipoAbsenceEtiquetaKind(fila.e);
  if (abs === "baja" || abs === "vacaciones") return true;
  if (abs === "no_laboral") return false;
  if (fila.e.timeEntryStatus !== "Closed") return false;
  return !timeEntryConParteEnServidor(fila.e);
}

export function getTeamHoursTodaySummaryRowPriority(fila: EquipoTablaFila) {
  if (fila.kind === "sinImputar") return 0;
  if (fila.kind !== "registro") return 99;
  const abs = equipoAbsenceEtiquetaKind(fila.e);
  if (abs === "baja") return 1;
  if (abs === "vacaciones") return 2;
  return 3;
}

export function getTeamHoursTodaySummaryRowLabel(fila: EquipoTablaFila) {
  if (fila.kind === "sinImputar") return "Sin fichar";
  if (fila.kind === "noLaboral") return "No laboral";
  if (fila.kind !== "registro") return "Revisar";
  const abs = equipoAbsenceEtiquetaKind(fila.e);
  if (abs === "baja") return "Baja";
  if (abs === "vacaciones") return "Vacaciones";
  if (!timeEntryConParteEnServidor(fila.e)) return "Sin parte";
  return "Revisar";
}

export function getTeamHoursTodaySummaryRowBadgeClass(label: string) {
  if (label === "Vacaciones") return "agro-badge-info";
  if (label === "Baja" || label === "Sin parte") return "agro-badge-warn";
  if (label === "No laboral") return "agro-badge-info";
  return "agro-badge-danger";
}

export function getTeamHoursTodaySummaryRowSubtitle(fila: EquipoTablaFila) {
  if (fila.kind === "sinImputar") return "No tiene registro de entrada.";
  if (fila.kind === "noLaboral") return "Día marcado como no laborable.";
  if (fila.kind !== "registro") return "Revisar registro.";
  const abs = equipoAbsenceEtiquetaKind(fila.e);
  if (abs === "baja") return "De baja médica.";
  if (abs === "vacaciones") return "En periodos de vacaciones.";
  return "Jornada registrada sin parte.";
}
