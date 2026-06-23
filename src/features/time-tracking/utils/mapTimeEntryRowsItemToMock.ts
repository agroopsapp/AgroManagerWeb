import type { TimeEntryMock, TimeEntryRazon } from "@/features/time-tracking/types";

import {
  stableNumericIdFromUserId,
  normalizePersonKey,
} from "@/features/time-tracking/utils/equipoGridMerge";

import { parseTimeEntryApiStatus } from "@/features/time-tracking/utils/timeEntryApiStatus";

import {

  isEmptyGuid,

  normalizeTimeEntryRowKind,

} from "@/features/time-tracking/utils/timeEntryRowKind";

import { diffDurationMinutes } from "@/shared/utils/time";



function stableIdFromString(s: string): number {

  let h = 0;

  for (let i = 0; i < s.length; i++) {

    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;

  }

  return Math.abs(h) || 1;

}



function imputationKindToRazon(

  kind: string,

  isManuallyCompleted: boolean,

  timeEntryStatus: ReturnType<typeof parseTimeEntryApiStatus>,

): TimeEntryRazon {

  if (timeEntryStatus === "FestivoEmpresa") return "dia_no_laboral";

  const k = kind.toLowerCase();

  if (

    k.includes("no_laboral") ||

    k.includes("no laboral") ||

    k.includes("nonworking") ||

    k.includes("non_working") ||

    k.includes("festivo")

  ) {

    return "dia_no_laboral";

  }

  if (k.includes("vacacion") || k.includes("vacation")) return "ausencia_vacaciones";

  if (

    k.includes("baja") ||

    k.includes("sick") ||

    (k.includes("ausencia") && !k.includes("vacacion"))

  ) {

    return "ausencia_baja";

  }

  if (isManuallyCompleted || k.includes("manual") || k.includes("error") || k.includes("rrhh")) {

    return "imputacion_manual_error";

  }

  return "imputacion_normal";

}



function normalizeOptionalGuid(raw: unknown): string | null {

  if (raw == null) return null;

  const s = String(raw).trim();

  if (!s || isEmptyGuid(s)) return null;

  return s;

}



/**

 * Convierte un ítem de filas de fichaje (grid o «mis fichajes») al modelo local (`TimeEntryMock`).

 * Acepta `rowKind: timeEntry` y `companyHoliday`.

 */

export function mapTimeEntryRowsItemToMock(raw: unknown): TimeEntryMock | null {

  if (raw === null || typeof raw !== "object") return null;

  const o = raw as Record<string, unknown>;



  const rowKindRaw = o.rowKind ?? o.RowKind;

  const userIdRaw = o.userId ?? o.UserId ?? o.applicationUserId ?? o.ApplicationUserId;

  const userId = normalizePersonKey(typeof userIdRaw === "string" ? userIdRaw : null);



  const timeEntryIdRaw = o.timeEntryId ?? o.TimeEntryId ?? o.id ?? o.Id;

  const timeEntryIdCandidate =

    timeEntryIdRaw != null ? String(timeEntryIdRaw).trim() : "";

  const companyHolidayId = normalizeOptionalGuid(o.companyHolidayId ?? o.CompanyHolidayId);



  const workDateRaw = o.workDate ?? o.WorkDate;

  const workDate =

    typeof workDateRaw === "string" && workDateRaw.trim().length >= 10

      ? workDateRaw.trim().slice(0, 10)

      : "";



  const startAtRaw = o.startAt ?? o.StartAt ?? o.checkInUtc ?? o.CheckInUtc;

  const endAtRaw = o.endAt ?? o.EndAt ?? o.checkOutUtc ?? o.CheckOutUtc;

  let endAt =

    endAtRaw === null || endAtRaw === undefined

      ? null

      : typeof endAtRaw === "string"

        ? endAtRaw.trim() || null

        : null;



  const timeEntryStatus = parseTimeEntryApiStatus(o.status ?? o.Status);

  let rowKind =
    rowKindRaw != null && String(rowKindRaw).trim() !== ""
      ? normalizeTimeEntryRowKind(rowKindRaw)
      : null;
  if (!rowKind) {
    if (timeEntryStatus === "FestivoEmpresa") rowKind = "companyHoliday";
    else rowKind = "timeEntry";
  }

  let startAt = typeof startAtRaw === "string" ? startAtRaw.trim() : "";
  if (
    !startAt &&
    workDate &&
    (rowKind === "companyHoliday" || timeEntryStatus === "FestivoEmpresa")
  ) {
    startAt = `${workDate}T00:00:00.000Z`;
  }
  if (!endAt && startAt && rowKind === "companyHoliday") {
    endAt = startAt;
  }

  if (!workDate || !startAt || !userId) return null;

  const imputationKind = String(o.imputationKind ?? o.ImputationKind ?? "normal");

  const isManuallyCompleted = Boolean(o.isManuallyCompleted ?? o.IsManuallyCompleted ?? false);



  let razon = imputationKindToRazon(imputationKind, isManuallyCompleted, timeEntryStatus);

  if (timeEntryStatus === "Vacation") razon = "ausencia_vacaciones";

  else if (timeEntryStatus === "SickLeave") razon = "ausencia_baja";

  else if (timeEntryStatus === "NonWorkingDay") razon = "dia_no_laboral";



  const holidayNameRaw = o.holidayName ?? o.HolidayName;

  const holidayName =

    typeof holidayNameRaw === "string" && holidayNameRaw.trim() ? holidayNameRaw.trim() : null;



  const workedMinutesRaw = o.workedMinutes ?? o.WorkedMinutes;

  const workedMinutes =

    typeof workedMinutesRaw === "number" && Number.isFinite(workedMinutesRaw)

      ? Math.max(0, workedMinutesRaw)

      : Number.parseInt(String(workedMinutesRaw ?? "0"), 10) || 0;



  const breakSummaryRaw = o.breakSummary ?? o.BreakSummary;

  const breakSummary = typeof breakSummaryRaw === "string" ? breakSummaryRaw : "";

  let breakMinutes = 0;

  const m = breakSummary.match(/(\d+)\s*min/i);

  if (m) breakMinutes = Number.parseInt(m[1], 10) || 0;

  else {

    const gross = diffDurationMinutes(startAt, endAt);

    if (gross !== null) breakMinutes = Math.max(0, gross - workedMinutes);

  }



  const companyIdRaw = o.companyId ?? o.CompanyId;

  const companyId = typeof companyIdRaw === "string" ? companyIdRaw : null;



  const rawCcIds = o.clientCompanyIdsInReport ?? o.ClientCompanyIdsInReport;

  let clientCompanyIdsInReport: string[] | null = null;

  if (Array.isArray(rawCcIds)) {

    const parsed = rawCcIds

      .map((x) => (x == null ? "" : String(x).trim()))

      .filter((s) => s.length > 0);

    if (parsed.length > 0) clientCompanyIdsInReport = parsed;

  }

  const userNameRaw = o.userName ?? o.UserName;

  const userName = typeof userNameRaw === "string" ? userNameRaw : null;

  const workReportId = normalizeOptionalGuid(o.workReportId ?? o.WorkReportId);



  const workReportStatusRaw = o.workReportStatus ?? o.WorkReportStatus;

  const workReportStatus =

    typeof workReportStatusRaw === "string" && workReportStatusRaw.trim()

      ? workReportStatusRaw.trim()

      : null;



  const workReportLineCountRaw = o.workReportLineCount ?? o.WorkReportLineCount;

  let workReportLineCount: number | null = null;

  if (typeof workReportLineCountRaw === "number" && Number.isFinite(workReportLineCountRaw)) {

    workReportLineCount = Math.max(0, Math.round(workReportLineCountRaw));

  } else if (workReportLineCountRaw != null && workReportLineCountRaw !== "") {

    const p = Number.parseInt(String(workReportLineCountRaw), 10);

    if (Number.isFinite(p) && p >= 0) workReportLineCount = p;

  }



  const lastModifiedAtRaw = o.lastModifiedAt ?? o.LastModifiedAt ?? o.updatedAtUtc ?? o.UpdatedAtUtc;

  const updatedAtUtc =

    typeof lastModifiedAtRaw === "string" && lastModifiedAtRaw.trim()

      ? lastModifiedAtRaw.trim()

      : null;

  const lastModifiedByEmailRaw = o.lastModifiedByEmail ?? o.LastModifiedByEmail;

  const lastModifiedByEmail =

    typeof lastModifiedByEmailRaw === "string" ? lastModifiedByEmailRaw : null;



  const workAreaNameRaw =

    o.workAreaName ??

    o.WorkAreaName ??

    o.workLocationName ??

    o.WorkLocationName ??

    o.locationName ??

    o.LocationName;

  const workAreaName =

    typeof workAreaNameRaw === "string" && workAreaNameRaw.trim() ? workAreaNameRaw.trim() : null;



  const workReportLinesSummaryRaw =

    o.workReportLinesSummary ??

    o.WorkReportLinesSummary ??

    o.workReportLocationSummary ??

    o.WorkReportLocationSummary;

  const workReportLinesSummary =

    typeof workReportLinesSummaryRaw === "string" && workReportLinesSummaryRaw.trim()

      ? workReportLinesSummaryRaw.trim()

      : null;



  const workerId = stableNumericIdFromUserId(userId);

  const stableKey =

    rowKind === "companyHoliday" && companyHolidayId

      ? `holiday|${companyHolidayId}`

      : !isEmptyGuid(timeEntryIdCandidate)

        ? timeEntryIdCandidate

        : `${userId}|${workDate}|${startAt}`;

  const id = stableIdFromString(stableKey);

  const timeEntryId =

    rowKind === "companyHoliday"

      ? null

      : !isEmptyGuid(timeEntryIdCandidate)

        ? timeEntryIdCandidate

        : null;



  return {

    id,

    timeEntryId,

    companyId,

    clientCompanyIdsInReport,

    workerId,

    userId,

    workReportId,

    workReportStatus,

    workReportLineCount,

    userName,

    workDate,

    checkInUtc: startAt,

    checkOutUtc: endAt,

    isEdited: isManuallyCompleted,

    createdAtUtc: startAt,

    createdBy: workerId,

    updatedAtUtc,

    updatedBy: null,

    lastModifiedByEmail,

    lastModifiedByName: null,

    breakMinutes,

    workedMinutes,

    razon,

    entradaManual: false,

    salidaManual: false,

    previousCheckInUtc: null,

    previousCheckOutUtc: null,

    edicionNotaAdmin: null,

    cierreAutomaticoMedianoche: false,

    workAreaName,

    workReportLinesSummary,

    timeEntryStatus,

    rowKind,

    companyHolidayId,

    holidayName,

  };

}


