"use client";

import { apiClient } from "@/lib/api-client";

const BASE = "/api/WorkReports";

export interface WorkReportDto {
  id: string;
  companyId: string;
  timeEntryId: string;
  userId: string;
  workDate: string;
  status: string;
  notes: string | null;
  signatureUrl?: string | null;
  signatureAt?: string | null;
  signatureUserId?: string | null;
  pdfGeneratedAt?: string | null;
}

export interface WorkReportLineDto {
  id: string;
  workReportId: string;
  clientCompanyId: string;
  serviceId: string;
  workAreaId: string;
  minutes: number;
  notes: string | null;
  /** Texto descriptivo si el API lo devuelve en with-lines (p. ej. nombres al cerrar el parte). */
  clientCompanyNameSnapshot?: string;
  serviceNameSnapshot?: string;
  workAreaNameSnapshot?: string;
}

export interface WorkReportWithLinesDto extends WorkReportDto {
  lines: WorkReportLineDto[];
}

export interface WorkReportLineCreateInput {
  clientCompanyId: string;
  serviceId: string;
  workAreaId: string;
  minutes: number;
  clientCompanyNameSnapshot: string;
  serviceNameSnapshot: string;
  workAreaNameSnapshot: string;
  notes: string;
  workAreaDescriptionSnapshot: string;
}

function snapshotStr(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
}

function normalizeWorkReportLine(input: unknown): WorkReportLineDto {
  const o = (input ?? {}) as Record<string, unknown>;
  const minutesRaw = o.minutes ?? o.Minutes;
  return {
    id: String(o.id ?? o.Id ?? ""),
    workReportId: String(o.workReportId ?? o.WorkReportId ?? ""),
    clientCompanyId: String(o.clientCompanyId ?? o.ClientCompanyId ?? ""),
    serviceId: String(o.serviceId ?? o.ServiceId ?? ""),
    workAreaId: String(o.workAreaId ?? o.WorkAreaId ?? ""),
    minutes:
      typeof minutesRaw === "number"
        ? minutesRaw
        : Number.parseInt(String(minutesRaw ?? "0"), 10) || 0,
    notes:
      typeof (o.notes ?? o.Notes) === "string"
        ? String(o.notes ?? o.Notes)
        : null,
    clientCompanyNameSnapshot: snapshotStr(
      o.clientCompanyNameSnapshot,
      o.ClientCompanyNameSnapshot,
    ),
    serviceNameSnapshot: snapshotStr(o.serviceNameSnapshot, o.ServiceNameSnapshot),
    workAreaNameSnapshot: snapshotStr(o.workAreaNameSnapshot, o.WorkAreaNameSnapshot),
  };
}

function normalizeWorkReport(input: unknown): WorkReportDto {
  const o = (input ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? o.Id ?? ""),
    companyId: String(o.companyId ?? o.CompanyId ?? ""),
    timeEntryId: String(o.timeEntryId ?? o.TimeEntryId ?? ""),
    userId: String(o.userId ?? o.UserId ?? ""),
    workDate: String(o.workDate ?? o.WorkDate ?? "").slice(0, 10),
    status: String(o.status ?? o.Status ?? ""),
    notes:
      typeof (o.notes ?? o.Notes) === "string"
        ? String(o.notes ?? o.Notes)
        : null,
    signatureUrl:
      typeof (o.signatureUrl ?? o.SignatureUrl) === "string"
        ? String(o.signatureUrl ?? o.SignatureUrl)
        : null,
    signatureAt:
      typeof (o.signatureAt ?? o.SignatureAt) === "string"
        ? String(o.signatureAt ?? o.SignatureAt)
        : null,
    signatureUserId:
      typeof (o.signatureUserId ?? o.SignatureUserId) === "string"
        ? String(o.signatureUserId ?? o.SignatureUserId)
        : null,
    pdfGeneratedAt:
      typeof (o.pdfGeneratedAt ?? o.PdfGeneratedAt) === "string"
        ? String(o.pdfGeneratedAt ?? o.PdfGeneratedAt)
        : null,
  };
}

function normalizeWorkReportWithLines(input: unknown): WorkReportWithLinesDto {
  const o = (input ?? {}) as Record<string, unknown>;
  const linesRaw = o.lines ?? o.Lines;
  const lines = Array.isArray(linesRaw)
    ? linesRaw.map(normalizeWorkReportLine)
    : [];
  return {
    ...normalizeWorkReport(input),
    lines,
  };
}

export const workReportsApi = {
  getById(id: string): Promise<WorkReportDto> {
    return apiClient
      .get<unknown>(`${BASE}/${encodeURIComponent(id)}`)
      .then(normalizeWorkReport);
  },

  getByIdWithLines(
    id: string,
    init?: { signal?: AbortSignal },
  ): Promise<WorkReportWithLinesDto> {
    return apiClient
      .get<unknown>(`${BASE}/with-lines/${encodeURIComponent(id)}`, init)
      .then(normalizeWorkReportWithLines);
  },

  create(body: {
    companyId: string;
    timeEntryId: string;
    userId: string;
    workDate: string;
    status: "Draft" | "Open" | "Closed";
    notes: string;
  }): Promise<WorkReportDto> {
    return apiClient.post<unknown>(BASE, body).then(normalizeWorkReport);
  },

  createWithLines(body: {
    companyId: string;
    timeEntryId: string;
    userId: string;
    workDate: string;
    status: "Draft" | "Open" | "Closed";
    notes: string;
    lines: WorkReportLineCreateInput[];
  }): Promise<WorkReportWithLinesDto> {
    return apiClient
      .post<unknown>(`${BASE}/with-lines`, body)
      .then(normalizeWorkReportWithLines);
  },

  updateWithLines(
    id: string,
    body: {
      status: "Draft" | "Open" | "Closed";
      notes: string | null;
      signatureUrl: string | null;
      signatureAt: string | null;
      signatureUserId: string | null;
      pdfGeneratedAt: string | null;
      lines: WorkReportLineCreateInput[];
    },
  ): Promise<WorkReportWithLinesDto> {
    return apiClient
      .put<unknown>(`${BASE}/with-lines/${encodeURIComponent(id)}`, body)
      .then(normalizeWorkReportWithLines);
  },

  update(
    id: string,
    body: {
      status: "Draft" | "Open" | "Closed";
      notes: string | null;
      signatureUrl: string | null;
      signatureAt: string | null;
      signatureUserId: string | null;
      pdfGeneratedAt: string | null;
    },
  ): Promise<void> {
    return apiClient.put<void>(`${BASE}/${encodeURIComponent(id)}`, body);
  },
};
