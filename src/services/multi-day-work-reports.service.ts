import { apiClient } from "@/lib/api-client";
import type {
  MultiDayWorkReportCreateBody,
  MultiDayWorkReportDto,
  MultiDayWorkReportMaterialCreateBody,
  MultiDayWorkReportMaterialLineDto,
  MultiDayWorkReportMaterialUpdateBody,
  MultiDayWorkReportStatus,
  MultiDayWorkReportUpdateBody,
} from "@/features/multi-day-work-reports/types";

const BASE = "/api/MultiDayWorkReports";

function unwrapList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const inner =
      o.value ?? o.Value ?? o.data ?? o.Data ?? o.items ?? o.Items ?? o.results ?? o.Results;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function parseStatus(raw: unknown): MultiDayWorkReportStatus {
  const s = String(raw ?? "").trim();
  if (s === "Cerrado" || s === "Closed") return "Cerrado";
  return "Abierto";
}

export function normalizeMultiDayWorkReport(input: unknown): MultiDayWorkReportDto | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const id = String(o.id ?? o.Id ?? "").trim();
  if (!id) return null;
  const endRaw = o.endDate ?? o.EndDate;
  const endDate =
    endRaw === null || endRaw === undefined
      ? null
      : typeof endRaw === "string"
        ? endRaw.slice(0, 10)
        : String(endRaw).slice(0, 10);
  return {
    id,
    companyId: String(o.companyId ?? o.CompanyId ?? ""),
    clientCompanyId: String(o.clientCompanyId ?? o.ClientCompanyId ?? ""),
    title: typeof o.title === "string" ? o.title : String(o.Title ?? ""),
    notes: typeof o.notes === "string" ? o.notes : String(o.Notes ?? ""),
    startDate: String(o.startDate ?? o.StartDate ?? "").slice(0, 10),
    endDate: endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : null,
    status: parseStatus(o.status ?? o.Status),
    closedAtUtc: strOrNull(o.closedAtUtc ?? o.ClosedAtUtc),
    closedByUserId: strOrNull(o.closedByUserId ?? o.ClosedByUserId),
    createdAt:
      typeof (o.createdAt ?? o.CreatedAt) === "string"
        ? String(o.createdAt ?? o.CreatedAt)
        : String(o.createdAt ?? o.CreatedAt ?? ""),
  };
}

export function normalizeMaterialLine(input: unknown): MultiDayWorkReportMaterialLineDto | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const id = String(o.id ?? o.Id ?? "").trim();
  if (!id) return null;
  const qtyRaw = o.quantity ?? o.Quantity;
  const quantity =
    typeof qtyRaw === "number" ? qtyRaw : Number.parseFloat(String(qtyRaw ?? "NaN"));
  if (!Number.isFinite(quantity)) return null;
  return {
    id,
    multiDayWorkReportId: String(o.multiDayWorkReportId ?? o.MultiDayWorkReportId ?? ""),
    materialId: String(o.materialId ?? o.MaterialId ?? ""),
    quantity,
    createdAt:
      typeof (o.createdAt ?? o.CreatedAt) === "string"
        ? String(o.createdAt ?? o.CreatedAt)
        : String(o.createdAt ?? o.CreatedAt ?? ""),
  };
}

export const multiDayWorkReportsApi = {
  getAll(opts?: { signal?: AbortSignal; companyId?: string }): Promise<MultiDayWorkReportDto[]> {
    const q =
      opts?.companyId && opts.companyId.trim().length > 0
        ? `?companyId=${encodeURIComponent(opts.companyId.trim())}`
        : "";
    return apiClient
      .get<unknown>(`${BASE}${q}`, { signal: opts?.signal })
      .then((raw) =>
        unwrapList(raw)
          .map(normalizeMultiDayWorkReport)
          .filter((r): r is MultiDayWorkReportDto => r !== null),
      );
  },

  getById(id: string, opts?: { signal?: AbortSignal }): Promise<MultiDayWorkReportDto> {
    return apiClient
      .get<unknown>(`${BASE}/${encodeURIComponent(id)}`, { signal: opts?.signal })
      .then((raw) => {
        const r = normalizeMultiDayWorkReport(raw);
        if (!r) throw new Error("Respuesta de parte de obra no válida.");
        return r;
      });
  },

  create(body: MultiDayWorkReportCreateBody, opts?: { signal?: AbortSignal }): Promise<MultiDayWorkReportDto> {
    const payload: Record<string, unknown> = {
      companyId: body.companyId,
      clientCompanyId: body.clientCompanyId,
      title: body.title,
      notes: body.notes,
      startDate: body.startDate,
      endDate: body.endDate,
    };
    if (body.status != null && body.status !== "Abierto") {
      payload.status = body.status;
    }
    return apiClient
      .post<unknown>(`${BASE}`, payload, { signal: opts?.signal })
      .then((raw) => {
        const r = normalizeMultiDayWorkReport(raw);
        if (!r) throw new Error("Respuesta de creación no válida.");
        return r;
      });
  },

  update(
    id: string,
    body: MultiDayWorkReportUpdateBody,
    opts?: { signal?: AbortSignal },
  ): Promise<MultiDayWorkReportDto> {
    return apiClient
      .put<unknown>(
        `${BASE}/${encodeURIComponent(id)}`,
        {
          title: body.title,
          notes: body.notes,
          startDate: body.startDate,
          endDate: body.endDate,
          status: body.status,
        },
        { signal: opts?.signal },
      )
      .then(async (raw) => {
        const r = normalizeMultiDayWorkReport(raw);
        if (r) return r;
        return multiDayWorkReportsApi.getById(id, opts);
      });
  },

  delete(id: string, opts?: { signal?: AbortSignal }): Promise<void> {
    return apiClient.delete<void>(`${BASE}/${encodeURIComponent(id)}`, { signal: opts?.signal });
  },

  getMaterials(
    reportId: string,
    opts?: { signal?: AbortSignal },
  ): Promise<MultiDayWorkReportMaterialLineDto[]> {
    return apiClient
      .get<unknown>(`${BASE}/${encodeURIComponent(reportId)}/materials`, { signal: opts?.signal })
      .then((raw) =>
        unwrapList(raw)
          .map(normalizeMaterialLine)
          .filter((l): l is MultiDayWorkReportMaterialLineDto => l !== null),
      );
  },

  addMaterial(
    reportId: string,
    body: MultiDayWorkReportMaterialCreateBody,
    opts?: { signal?: AbortSignal },
  ): Promise<MultiDayWorkReportMaterialLineDto> {
    return apiClient
      .post<unknown>(
        `${BASE}/${encodeURIComponent(reportId)}/materials`,
        { materialId: body.materialId, quantity: body.quantity },
        { signal: opts?.signal },
      )
      .then((raw) => {
        const l = normalizeMaterialLine(raw);
        if (!l) throw new Error("Respuesta de línea de material no válida.");
        return l;
      });
  },

  updateMaterialQuantity(
    reportId: string,
    lineId: string,
    body: MultiDayWorkReportMaterialUpdateBody,
    opts?: { signal?: AbortSignal },
  ): Promise<MultiDayWorkReportMaterialLineDto> {
    return apiClient
      .put<unknown>(
        `${BASE}/${encodeURIComponent(reportId)}/materials/${encodeURIComponent(lineId)}`,
        { quantity: body.quantity },
        { signal: opts?.signal },
      )
      .then(async (raw) => {
        const l = normalizeMaterialLine(raw);
        if (l) return l;
        const lines = await multiDayWorkReportsApi.getMaterials(reportId, opts);
        const found = lines.find((x) => x.id === lineId);
        if (found) return found;
        throw new Error("No se pudo confirmar la línea de material actualizada.");
      });
  },

  deleteMaterialLine(reportId: string, lineId: string, opts?: { signal?: AbortSignal }): Promise<void> {
    return apiClient.delete<void>(
      `${BASE}/${encodeURIComponent(reportId)}/materials/${encodeURIComponent(lineId)}`,
      { signal: opts?.signal },
    );
  },
};
