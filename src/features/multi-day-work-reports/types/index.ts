/** Estado del parte según API (`MultiDayWorkReports`). */
export type MultiDayWorkReportStatus = "Abierto" | "Cerrado";

export interface MultiDayWorkReportDto {
  id: string;
  companyId: string;
  clientCompanyId: string;
  title: string;
  notes: string;
  startDate: string;
  endDate: string | null;
  status: MultiDayWorkReportStatus;
  closedAtUtc: string | null;
  closedByUserId: string | null;
  createdAt: string;
}

export interface MultiDayWorkReportCreateBody {
  companyId: string;
  clientCompanyId: string;
  title: string;
  notes: string;
  startDate: string;
  endDate: string | null;
  /** Omitir o null → Abierto en servidor. No enviar Cerrado al crear. */
  status?: MultiDayWorkReportStatus | null;
}

export interface MultiDayWorkReportUpdateBody {
  title: string;
  notes: string;
  startDate: string;
  endDate: string | null;
  status: MultiDayWorkReportStatus;
}

export interface MultiDayWorkReportMaterialLineDto {
  id: string;
  multiDayWorkReportId: string;
  materialId: string;
  quantity: number;
  createdAt: string;
}

export interface MultiDayWorkReportMaterialCreateBody {
  materialId: string;
  quantity: number;
}

export interface MultiDayWorkReportMaterialUpdateBody {
  quantity: number;
}
