import type { TimeEntryDto } from "@/services/time-tracking.service";
import type { TimeEntryMock, TimeEntryRazon } from "@/features/time-tracking/types";
import { parseTimeEntryApiStatus } from "@/features/time-tracking/utils/timeEntryApiStatus";

function normalizeRazon(input: string | null | undefined): TimeEntryRazon | undefined {
  if (
    input === "imputacion_normal" ||
    input === "imputacion_manual_error" ||
    input === "ausencia_vacaciones" ||
    input === "ausencia_baja" ||
    input === "dia_no_laboral"
  ) {
    return input;
  }
  return undefined;
}

/** Única conversión `TimeEntryDto` → modelo de UI (lista fichajes, parte equipo, etc.). */
export function timeEntryDtoToMock(dto: TimeEntryDto, fallbackWorkerId: number): TimeEntryMock {
  const { status: apiStatus, ...dtoRest } = dto;
  const workerId =
    Number.isFinite(dto.workerId) && dto.workerId > 0 ? dto.workerId : fallbackWorkerId;
  return {
    ...dtoRest,
    timeEntryId: dto.timeEntryId ?? null,
    companyId: dto.companyId ?? null,
    workerId,
    breakMinutes: dto.breakMinutes ?? 0,
    razon: normalizeRazon(dto.razon),
    userName: dto.userName ?? null,
    userEmail: dto.userEmail ?? null,
    lastModifiedByEmail: dto.lastModifiedByEmail ?? null,
    lastModifiedByName: dto.lastModifiedByName ?? null,
    timeEntryStatus: parseTimeEntryApiStatus(apiStatus),
  };
}
