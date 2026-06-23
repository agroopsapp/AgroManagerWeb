"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalendarioLaboralDayMark } from "@/features/time-tracking/types";
import {
  calendarioLaboralStorageKey,
  parseCalendarioLaboralJson,
  serializeCalendarioLaboral,
} from "@/features/time-tracking/utils/calendarioLaboral";

type UseCalendarioLaboralOptions = {
  companyId: string | null | undefined;
  /** Admin / Manager / SuperAdmin. Si false, `setVacationMark` no hace nada. */
  canMutateVacations: boolean;
  /**
   * Trabajador: solo carga/expone vacaciones de este usuario (no ve el resto en memoria).
   * Al guardar en localStorage, fusiona solo su mapa sin borrar los de otros usuarios.
   */
  viewerUserId?: string | null;
};

export function useCalendarioLaboral({
  companyId,
  canMutateVacations,
  viewerUserId,
}: UseCalendarioLaboralOptions) {
  const viewerUid = viewerUserId?.trim() ?? "";
  const key = useMemo(() => calendarioLaboralStorageKey(companyId), [companyId]);

  const [vacationsByUserId, setVacationsByUserId] = useState<
    Record<string, Record<string, CalendarioLaboralDayMark>>
  >({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = parseCalendarioLaboralJson(raw);
      if (viewerUid) {
        setVacationsByUserId(
          viewerUid in parsed.vacationsByUserId
            ? { [viewerUid]: parsed.vacationsByUserId[viewerUid] }
            : {},
        );
      } else {
        setVacationsByUserId(parsed.vacationsByUserId);
      }
    } catch {
      setVacationsByUserId({});
    }
    setHydrated(true);
  }, [key, viewerUid]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      let vacationsToPersist = vacationsByUserId;
      if (viewerUid) {
        const raw = window.localStorage.getItem(key);
        const parsed = parseCalendarioLaboralJson(raw);
        vacationsToPersist = {
          ...parsed.vacationsByUserId,
          [viewerUid]: vacationsByUserId[viewerUid] ?? {},
        };
      }
      window.localStorage.setItem(
        key,
        serializeCalendarioLaboral({ holidaysByDate: {}, vacationsByUserId: vacationsToPersist }),
      );
    } catch {
      /* quota / private mode */
    }
  }, [vacationsByUserId, key, hydrated, viewerUid]);

  const setVacationMark = useCallback(
    (userId: string, dateISO: string, mark: CalendarioLaboralDayMark | null) => {
      if (!canMutateVacations) return;
      const uid = userId.trim();
      if (!uid) return;
      if (viewerUid && uid !== viewerUid) return;
      setVacationsByUserId((prev) => {
        const current = prev[uid] ?? {};
        const nextUserMap = { ...current };
        if (mark == null) delete nextUserMap[dateISO];
        else nextUserMap[dateISO] = mark;
        return { ...prev, [uid]: nextUserMap };
      });
    },
    [canMutateVacations, viewerUid],
  );

  return { vacationsByUserId, setVacationMark, hydrated };
}
