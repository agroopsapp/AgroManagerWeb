import type { TimeEntryMock } from "@/features/time-tracking/types";

import { isEmptyGuid } from "@/features/time-tracking/utils/timeEntryRowKind";



/** Filas de `/mine` o `/rows` pertenecientes al usuario de la sesión (prioriza GUID). */

export function timeEntryBelongsToSessionUser(

  e: TimeEntryMock,

  sessionUserId: string | undefined | null,

  miWorkerId: number,

): boolean {

  const uid = sessionUserId?.trim();

  const entryUid = e.userId?.trim();

  if (uid && entryUid) return uid === entryUid;

  return e.workerId === miWorkerId;

}



/** Alinea `workerId` numérico de demo con el de la sesión tras mapear filas del servidor. */

export function normalizeTimeEntryForSession(

  e: TimeEntryMock,

  sessionUserId: string | undefined | null,

  miWorkerId: number,

): TimeEntryMock {

  if (!timeEntryBelongsToSessionUser(e, sessionUserId, miWorkerId)) return e;

  return { ...e, workerId: miWorkerId };

}



/** Prioriza fichaje real; luego festivo sintético. */

export function pickPreferredDayEntry(entries: TimeEntryMock[]): TimeEntryMock | null {

  if (entries.length === 0) return null;

  const real = entries.find(

    (e) =>

      e.timeEntryId &&

      !isEmptyGuid(e.timeEntryId) &&

      e.rowKind !== "companyHoliday",

  );

  if (real) return real;

  const festivo = entries.find((e) => e.timeEntryStatus === "FestivoEmpresa");

  if (festivo) return festivo;

  return [...entries].sort(

    (a, b) => new Date(b.checkInUtc).getTime() - new Date(a.checkInUtc).getTime(),

  )[0];

}

