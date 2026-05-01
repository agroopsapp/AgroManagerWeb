"use client";

import { kioskApiClient } from "@/lib/kiosk-api-client";

export type KioskPunchResultDto = {
  /** Nombre para mostrar en la tablet (puede ser nombre+apellido o alias). */
  displayName: string;
  /** "checkIn" o "checkOut" según lo que haya ejecutado el backend. */
  action: "checkIn" | "checkOut";
  /** ISO (servidor) de la marca registrada. */
  atUtc: string;
  /** Mensaje opcional del backend (p. ej. "Descanso 30 min"). */
  message?: string | null;
};

export const kioskTimeTrackingApi = {
  /**
   * Fichaje desde kiosco (sin JWT).
   *
   * Backend esperado:
   * - Valida que la petición proviene de dispositivo permitido (por IP/red + X-Kiosk-Device-Id).
   * - Resuelve `code` a persona.
   * - Decide si es entrada o salida según estado actual (como ahora).
   */
  async punch(code: string): Promise<KioskPunchResultDto> {
    const normalized = code.trim();
    if (!normalized) {
      throw new Error("Introduce un código.");
    }
    return kioskApiClient.post<KioskPunchResultDto>("/api/Kiosk/time-entries/punch", {
      code: normalized,
    });
  },
};

