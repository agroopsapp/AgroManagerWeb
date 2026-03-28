"use client";
import { startTransition, useEffect, useRef, useState } from "react";
import {
  checkoutLocalIsoAfterCheckin,
  dateTimeLocalToUtcIso,
  minutesGrossWorkDay,
  utcToLocalHHMM,
} from "@/shared/utils/time";
import { isAusenciaRazon } from "@/features/time-tracking/utils/formatters";
import { MOCK_RRHH_LAST_MODIFIER } from "@/mocks/time-tracking.mock";
import type { TimeEntryMock } from "@/features/time-tracking/types";

type AuthUser = { id?: string; email?: string | null; role?: string } | null | undefined;

interface Params {
  user: AuthUser;
  setTeamHistorialEntries: React.Dispatch<React.SetStateAction<TimeEntryMock[]>>;
  equipoTablaScrollRef: React.RefObject<HTMLDivElement>;
  equipoRestaurarScroll: React.MutableRefObject<{ top: number; left: number } | null>;
  equipoMarcarRestaurarScroll: React.MutableRefObject<boolean>;
}

export function useEquipoModal({
  user,
  setTeamHistorialEntries,
  equipoTablaScrollRef,
  equipoRestaurarScroll,
  equipoMarcarRestaurarScroll,
}: Params) {
  const [equipoModal, setEquipoModal] = useState<null | {
    workerId: number;
    workDate: string;
    existing: TimeEntryMock | null;
    isWeekendFila: boolean;
  }>(null);
  const [equipoModalVista, setEquipoModalVista] = useState<"menu" | "horario">("menu");
  const [equipoFormIn, setEquipoFormIn] = useState("08:00");
  const [equipoFormOut, setEquipoFormOut] = useState("17:00");
  const [equipoFormBreak, setEquipoFormBreak] = useState(30);
  const [equipoFormNota, setEquipoFormNota] = useState("");
  const [equipoFormError, setEquipoFormError] = useState<string | null>(null);

  const equipoModalScrollY = useRef(0);

  // Block body scroll when modal is open
  useEffect(() => {
    if (!equipoModal) return;
    equipoModalScrollY.current = window.scrollY;
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${equipoModalScrollY.current}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      window.scrollTo(0, equipoModalScrollY.current);
    };
  }, [equipoModal]);

  const openEquipoEditModal = (opts: {
    workerId: number;
    workDate: string;
    existing: TimeEntryMock | null;
    isWeekendFila: boolean;
  }) => {
    setEquipoModalVista("menu");
    setEquipoFormError(null);
    const ex = opts.existing;
    if (ex && !isAusenciaRazon(ex.razon) && ex.checkOutUtc) {
      setEquipoFormIn(utcToLocalHHMM(ex.checkInUtc));
      setEquipoFormOut(utcToLocalHHMM(ex.checkOutUtc));
      setEquipoFormBreak(ex.breakMinutes ?? 30);
    } else {
      setEquipoFormIn("08:00");
      setEquipoFormOut("17:00");
      setEquipoFormBreak(30);
    }
    setEquipoFormNota(ex?.edicionNotaAdmin?.trim() ?? "");
    setEquipoModal(opts);
  };

  const cerrarEquipoModal = () => {
    setEquipoModal(null);
    setEquipoFormError(null);
  };

  const guardarEquipoVacacionesOBaja = (tipo: "vacaciones" | "baja") => {
    if (!equipoModal) return;
    const { workerId, workDate, existing } = equipoModal;
    const email = user?.email ?? MOCK_RRHH_LAST_MODIFIER;
    const name = user?.email?.split("@")[0] ?? null;
    const now = new Date().toISOString();
    let previousCheckInUtc: string | null = null;
    let previousCheckOutUtc: string | null = null;
    if (existing && !isAusenciaRazon(existing.razon)) {
      previousCheckInUtc = existing.checkInUtc;
      previousCheckOutUtc = existing.checkOutUtc;
    } else if (existing?.previousCheckInUtc || existing?.previousCheckOutUtc) {
      previousCheckInUtc = existing.previousCheckInUtc ?? null;
      previousCheckOutUtc = existing.previousCheckOutUtc ?? null;
    }
    const placeholderIso = dateTimeLocalToUtcIso(workDate, "12:00");
    const tab = equipoTablaScrollRef.current;
    if (tab) {
      equipoRestaurarScroll.current = { top: tab.scrollTop, left: tab.scrollLeft };
      equipoMarcarRestaurarScroll.current = true;
    }
    startTransition(() => {
      setTeamHistorialEntries((prev) => {
        const nextId = prev.reduce((m, e) => Math.max(m, e.id), 0) + 1;
        const newEntry: TimeEntryMock = {
          id: existing?.id ?? nextId,
          workerId,
          workDate,
          checkInUtc: placeholderIso,
          checkOutUtc: placeholderIso,
          isEdited: true,
          createdAtUtc: existing?.createdAtUtc ?? now,
          createdBy: existing?.createdBy ?? workerId,
          updatedAtUtc: now,
          updatedBy: 1,
          breakMinutes: 0,
          razon: tipo === "vacaciones" ? "ausencia_vacaciones" : "ausencia_baja",
          lastModifiedByEmail: email,
          lastModifiedByName: name,
          previousCheckInUtc,
          previousCheckOutUtc,
          edicionNotaAdmin: null,
        };
        const idx = prev.findIndex((e) => e.workerId === workerId && e.workDate === workDate);
        const base = idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
        return [...base, newEntry];
      });
    });
    cerrarEquipoModal();
  };

  const guardarEquipoHorarioManual = () => {
    if (!equipoModal) return;
    const { workerId, workDate, existing } = equipoModal;
    const gross = minutesGrossWorkDay(workDate, equipoFormIn, equipoFormOut);
    if (gross <= 0) {
      setEquipoFormError("La hora de salida debe ser posterior a la entrada.");
      return;
    }
    if (equipoFormBreak > gross) {
      setEquipoFormError("Los minutos de descanso no pueden superar la jornada bruta.");
      return;
    }
    setEquipoFormError(null);
    const email = user?.email ?? MOCK_RRHH_LAST_MODIFIER;
    const name = user?.email?.split("@")[0] ?? null;
    const now = new Date().toISOString();
    const checkInUtc = dateTimeLocalToUtcIso(workDate, equipoFormIn);
    const checkOutUtc = checkoutLocalIsoAfterCheckin(workDate, checkInUtc, equipoFormOut);
    const hadJornadaReal = Boolean(existing && !isAusenciaRazon(existing.razon));
    let previousCheckInUtc: string | null = null;
    let previousCheckOutUtc: string | null = null;
    if (hadJornadaReal && existing) {
      previousCheckInUtc = existing.checkInUtc;
      previousCheckOutUtc = existing.checkOutUtc;
    } else if (existing && isAusenciaRazon(existing.razon)) {
      previousCheckInUtc = existing.previousCheckInUtc ?? null;
      previousCheckOutUtc = existing.previousCheckOutUtc ?? null;
    }
    const nota = equipoFormNota.trim();
    const tab = equipoTablaScrollRef.current;
    if (tab) {
      equipoRestaurarScroll.current = { top: tab.scrollTop, left: tab.scrollLeft };
      equipoMarcarRestaurarScroll.current = true;
    }
    startTransition(() => {
      setTeamHistorialEntries((prev) => {
        const nextId = prev.reduce((m, e) => Math.max(m, e.id), 0) + 1;
        const newEntry: TimeEntryMock = {
          id: existing?.id ?? nextId,
          workerId,
          workDate,
          checkInUtc,
          checkOutUtc,
          isEdited: true,
          createdAtUtc: existing?.createdAtUtc ?? now,
          createdBy: existing?.createdBy ?? workerId,
          updatedAtUtc: now,
          updatedBy: 1,
          breakMinutes: equipoFormBreak,
          razon: "imputacion_manual_error",
          lastModifiedByEmail: email,
          lastModifiedByName: name,
          previousCheckInUtc,
          previousCheckOutUtc,
          entradaManual: true,
          salidaManual: true,
          edicionNotaAdmin: nota || null,
        };
        const idx = prev.findIndex((e) => e.workerId === workerId && e.workDate === workDate);
        const base = idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
        return [...base, newEntry];
      });
    });
    cerrarEquipoModal();
  };

  return {
    equipoModal,
    equipoModalVista,
    setEquipoModalVista,
    equipoFormIn,
    setEquipoFormIn,
    equipoFormOut,
    setEquipoFormOut,
    equipoFormBreak,
    setEquipoFormBreak,
    equipoFormNota,
    setEquipoFormNota,
    equipoFormError,
    setEquipoFormError,
    openEquipoEditModal,
    cerrarEquipoModal,
    guardarEquipoVacacionesOBaja,
    guardarEquipoHorarioManual,
  };
}
