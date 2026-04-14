"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalendarioLaboralDayMark, CalendarioLaboralMarkKind } from "@/features/time-tracking/types";
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

  const [marks, setMarks] = useState<Record<string, CalendarioLaboralDayMark>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      setMarks(parseCalendarioLaboralJson(raw));
    } catch {
      setMarks({});
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, serializeCalendarioLaboral(marks));
    } catch {
      /* quota / private mode */
    }
  }, [marks, key, hydrated]);

  const setDayMark = useCallback((dateISO: string, mark: CalendarioLaboralDayMark | null) => {
    setMarks((prev) => {
      const next = { ...prev };
      if (mark == null) delete next[dateISO];
      else next[dateISO] = mark;
      return next;
    });
  }, []);

  const setDayKind = useCallback(
    (dateISO: string, kind: CalendarioLaboralMarkKind | null, note?: string) => {
      if (kind == null) {
        setDayMark(dateISO, null);
        return;
      }
      const trimmed = note?.trim();
      setDayMark(dateISO, {
        kind,
        note: trimmed ? trimmed.slice(0, 120) : undefined,
      });
    },
    [setDayMark],
  );

  return { marks, setDayKind, setDayMark, hydrated };
}
