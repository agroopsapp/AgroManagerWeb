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
};

export function useCalendarioLaboral({ companyId }: UseCalendarioLaboralOptions) {
  const key = useMemo(() => calendarioLaboralStorageKey(companyId), [companyId]);

  const [holidaysByDate, setHolidaysByDate] = useState<Record<string, CalendarioLaboralDayMark>>({});
  const [vacationsByUserId, setVacationsByUserId] = useState<
    Record<string, Record<string, CalendarioLaboralDayMark>>
  >({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = parseCalendarioLaboralJson(raw);
      setHolidaysByDate(parsed.holidaysByDate);
      setVacationsByUserId(parsed.vacationsByUserId);
    } catch {
      setHolidaysByDate({});
      setVacationsByUserId({});
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        key,
        serializeCalendarioLaboral({ holidaysByDate, vacationsByUserId }),
      );
    } catch {
      /* quota / private mode */
    }
  }, [holidaysByDate, vacationsByUserId, key, hydrated]);

  const setHolidayMark = useCallback((dateISO: string, mark: CalendarioLaboralDayMark | null) => {
    setHolidaysByDate((prev) => {
      const next = { ...prev };
      if (mark == null) delete next[dateISO];
      else next[dateISO] = mark;
      return next;
    });
  }, []);

  const setVacationMark = useCallback(
    (userId: string, dateISO: string, mark: CalendarioLaboralDayMark | null) => {
      const uid = userId.trim();
      if (!uid) return;
      setVacationsByUserId((prev) => {
        const current = prev[uid] ?? {};
        const nextUserMap = { ...current };
        if (mark == null) delete nextUserMap[dateISO];
        else nextUserMap[dateISO] = mark;
        return { ...prev, [uid]: nextUserMap };
      });
    },
    [],
  );

  return { holidaysByDate, vacationsByUserId, setHolidayMark, setVacationMark, hydrated };
}
