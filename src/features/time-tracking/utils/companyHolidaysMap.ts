import type { CalendarioLaboralDayMark } from "@/features/time-tracking/types";
import type { CompanyHolidayDto } from "@/services/company-holidays.service";

export type CompanyHolidaysIndex = {
  holidaysByDate: Record<string, CalendarioLaboralDayMark>;
  /** GUID del festivo en API por fecha (para PUT/DELETE). */
  idByDate: Record<string, string>;
  recordsByDate: Record<string, CompanyHolidayDto>;
};

export function companyHolidaysToIndex(rows: CompanyHolidayDto[]): CompanyHolidaysIndex {
  const holidaysByDate: Record<string, CalendarioLaboralDayMark> = {};
  const idByDate: Record<string, string> = {};
  const recordsByDate: Record<string, CompanyHolidayDto> = {};

  for (const row of rows) {
    const date = row.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    holidaysByDate[date] = {
      kind: "festivo",
      note: row.name.trim() || undefined,
    };
    idByDate[date] = row.id;
    recordsByDate[date] = row;
  }

  return { holidaysByDate, idByDate, recordsByDate };
}

export const DEFAULT_COMPANY_HOLIDAY_NAME = "Festivo";
