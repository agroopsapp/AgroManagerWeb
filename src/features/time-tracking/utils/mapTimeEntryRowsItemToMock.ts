import type { TimeEntryMock, TimeEntryRazon } from "@/features/time-tracking/types";
import { stableNumericIdFromUserId } from "@/features/time-tracking/utils/equipoGridMerge";
import { parseTimeEntryApiStatus } from "@/features/time-tracking/utils/timeEntryApiStatus";
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
  isManuallyCompleted: boolean
): TimeEntryRazon {
  const k = kind.toLowerCase();
  // Ausencias / tipo de día antes que «manual»: si no, `manual`+`isManuallyCompleted` oculta vacation en el kind.
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

/**
 * Convierte un ítem de `GET /api/TimeEntries/rows` al modelo de grid (`TimeEntryMock`).
 * Ignora filas que no sean fichajes reconocibles.
 */
export function mapTimeEntryRowsItemToMock(raw: unknown): TimeEntryMock | null {
  if (raw === null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const rowKind = String(o.rowKind ?? o.RowKind ?? "timeEntry");
  if (!/^time[_]?entry$/i.test(rowKind.trim())) return null;

  const userIdRaw = o.userId ?? o.UserId;
  const userId = typeof userIdRaw === "string" && userIdRaw.trim() ? userIdRaw.trim() : null;
  const timeEntryIdRaw = o.timeEntryId ?? o.TimeEntryId;
  const timeEntryId =
    typeof timeEntryIdRaw === "string" && timeEntryIdRaw.trim()
      ? timeEntryIdRaw.trim()
      : timeEntryIdRaw != null
        ? String(timeEntryIdRaw)
        : "";

  const workDateRaw = o.workDate ?? o.WorkDate;
  const workDate =
    typeof workDateRaw === "string" && workDateRaw.trim().length >= 10
      ? workDateRaw.trim().slice(0, 10)
      : "";

  const startAtRaw = o.startAt ?? o.StartAt;
  const startAt = typeof startAtRaw === "string" ? startAtRaw : "";
  const endAtRaw = o.endAt ?? o.EndAt;
  const endAt =
    endAtRaw === null || endAtRaw === undefined
      ? null
      : typeof endAtRaw === "string"
        ? endAtRaw.trim() || null
        : null;

  if (!workDate || !startAt || !userId) return null;

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

  const imputationKind = String(o.imputationKind ?? o.ImputationKind ?? "normal");
  const isManuallyCompleted = Boolean(o.isManuallyCompleted ?? o.IsManuallyCompleted ?? false);
  const timeEntryStatus = parseTimeEntryApiStatus(o.status ?? o.Status);

  let razon = imputationKindToRazon(imputationKind, isManuallyCompleted);
  if (timeEntryStatus === "Vacation") razon = "ausencia_vacaciones";
  else if (timeEntryStatus === "SickLeave") razon = "ausencia_baja";
  else if (timeEntryStatus === "NonWorkingDay") razon = "dia_no_laboral";

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
  const workReportIdRaw = o.workReportId ?? o.WorkReportId;
  const workReportId =
    typeof workReportIdRaw === "string" && workReportIdRaw.trim() ? workReportIdRaw.trim() : null;

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

  const lastModifiedAtRaw = o.lastModifiedAt ?? o.LastModifiedAt;
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

  const workerId = stableNumericIdFromUserId(userId);
  const id = stableIdFromString(timeEntryId || `${userId}|${workDate}|${startAt}`);

  return {
    id,
    timeEntryId: timeEntryId || null,
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
    timeEntryStatus,
  };
}
