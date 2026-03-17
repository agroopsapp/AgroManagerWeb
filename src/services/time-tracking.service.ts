"use client";

import { apiClient } from "@/lib/api-client";

export interface TimeEntryDto {
  id: number;
  workerId: number;
  workDate: string; // YYYY-MM-DD (date de trabajo)
  checkInUtc: string; // ISO en UTC
  checkOutUtc: string | null; // ISO en UTC o null si sigue abierta
  isEdited: boolean;
  createdAtUtc: string;
  createdBy: number;
  updatedAtUtc: string | null;
  updatedBy: number | null;
}

export interface TimeEntrySummaryDto {
  entries: TimeEntryDto[];
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.append(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const timeTrackingApi = {
  /**
   * Devuelve los fichajes del trabajador autenticado.
   * from/to en formato YYYY-MM-DD (fecha de trabajo).
   */
  async getMyEntries(from?: string, to?: string): Promise<TimeEntryDto[]> {
    const query = buildQuery({ from, to });
    const data = await apiClient.get<TimeEntrySummaryDto>(`/api/time-entries/my${query}`);
    return data.entries;
  },

  /** Marca entrada del trabajador autenticado. */
  async checkIn(): Promise<TimeEntryDto> {
    return apiClient.post<TimeEntryDto>("/api/time-entries/check-in");
  },

  /** Marca salida del trabajador autenticado. */
  async checkOut(): Promise<TimeEntryDto> {
    return apiClient.post<TimeEntryDto>("/api/time-entries/check-out");
  },
};

