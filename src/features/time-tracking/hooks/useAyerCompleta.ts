"use client";
import { useCallback, useMemo, useState } from "react";
import {
  checkoutLocalIsoAfterCheckin,
  dateTimeLocalToUtcIso,
  localCalendarISO,
  localTodayISO,
  localYesterdayISO,
  minutesGrossWorkDay,
  utcToLocalHHMM,
  workDateIsWeekend,
  yesterdayISO,
} from "@/shared/utils/time";
import type { AyerCompletaStep, TimeEntryMock } from "@/features/time-tracking/types";

type AuthUser = { id?: string; email?: string | null; role?: string } | null | undefined;

interface Params {
  miWorkerId: number;
  user: AuthUser;
  entries: TimeEntryMock[];
  setEntries: React.Dispatch<React.SetStateAction<TimeEntryMock[]>>;
}

/** Primer día laborable (lun–vie) pendiente (sin fichaje o sin cerrar bien) en los últimos N días. */
function primeraPendienteLaboralEnVentana(
  entries: TimeEntryMock[],
  workerId: number,
  maxDiasAtras = 14,
  ref: Date = new Date()
): {
  workDate: string;
  sinFichaje: boolean;
  entrada: TimeEntryMock | null;
} | null {
  let candidato: {
    workDate: string;
    sinFichaje: boolean;
    entrada: TimeEntryMock | null;
  } | null = null;
  for (let i = 1; i <= maxDiasAtras; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - i, 12, 0, 0, 0);
    const wd = localCalendarISO(d);
    if (workDateIsWeekend(wd)) continue;
    const list = entries.filter((e) => e.workerId === workerId && e.workDate === wd);
    const e =
      list.length === 0
        ? null
        : [...list].sort(
            (a, b) => new Date(b.checkInUtc).getTime() - new Date(a.checkInUtc).getTime()
          )[0];
    const sinFichaje = e === null;
    const sinCerrar =
      e !== null &&
      (e.checkOutUtc == null || e.cierreAutomaticoMedianoche === true);
    if (!sinFichaje && !sinCerrar) continue;
    if (candidato === null || wd < candidato.workDate) {
      candidato = {
        workDate: wd,
        sinFichaje,
        entrada: sinCerrar ? e : null,
      };
    }
  }
  return candidato;
}

export function useAyerCompleta({ miWorkerId, user, entries, setEntries }: Params) {
  const [ayerCompStep, setAyerCompStep] = useState<AyerCompletaStep>("closed");
  const [ayerManStart, setAyerManStart] = useState("09:00");
  const [ayerManEnd, setAyerManEnd] = useState("18:00");
  const [ayerCompHadBreak, setAyerCompHadBreak] = useState<boolean | null>(null);
  const [ayerCompOtroH, setAyerCompOtroH] = useState(0);
  const [ayerCompOtroM, setAyerCompOtroM] = useState(30);
  const [ayerCompError, setAyerCompError] = useState<string | null>(null);

  // ----- Derived from entries -----

  const pendienteLaboral = useMemo(
    () => primeraPendienteLaboralEnVentana(entries, miWorkerId, 14),
    [entries, miWorkerId]
  );

  const ayerUtc = yesterdayISO();
  const ayerLocal = localYesterdayISO();

  const fechaUltimoLaboral = pendienteLaboral?.workDate ?? ayerLocal;
  const ultimoLaboralSinFichaje = pendienteLaboral?.sinFichaje === true;
  const ultimoLaboralSinCerrar =
    pendienteLaboral !== null && pendienteLaboral.sinFichaje === false;
  const entradaUltimoLaboral = pendienteLaboral?.entrada ?? null;
  const hayDiasSinCuadrarEnHistorico = pendienteLaboral !== null;
  const registroAyerParcial = ultimoLaboralSinCerrar ? entradaUltimoLaboral : null;
  const fechaAyerEtiqueta = fechaUltimoLaboral;

  const esFechaAyer = (wd: string) => wd === ayerUtc || wd === ayerLocal;

  const ayerMinutosBrutos = useMemo(() => {
    const m = minutesGrossWorkDay(fechaAyerEtiqueta, ayerManStart, ayerManEnd);
    return Number.isFinite(m) && m > 0 ? m : 0;
  }, [fechaAyerEtiqueta, ayerManStart, ayerManEnd]);

  // ----- Handlers -----

  const resetAyerCompletaModal = useCallback(() => {
    setAyerCompStep("closed");
    setAyerManStart("09:00");
    setAyerManEnd("18:00");
    setAyerCompHadBreak(null);
    setAyerCompOtroH(0);
    setAyerCompOtroM(30);
    setAyerCompError(null);
  }, []);

  const abrirCompletarAyer = () => {
    setAyerCompError(null);
    if (registroAyerParcial) {
      setAyerManStart(utcToLocalHHMM(registroAyerParcial.checkInUtc));
      setAyerManEnd("18:00");
    } else {
      setAyerManStart("09:00");
      setAyerManEnd("18:00");
    }
    setAyerCompStep("inicio");
  };

  const submitCompletarAyer = (forcedBreak?: number) => {
    const wdTarget = fechaUltimoLaboral;
    const pendienteAyer = entries.find(
      (e) =>
        e.workerId === miWorkerId &&
        e.workDate === wdTarget &&
        (e.checkOutUtc == null || e.cierreAutomaticoMedianoche === true)
    );
    const diaYaConfirmado = entries.some(
      (e) =>
        e.workerId === miWorkerId &&
        e.workDate === wdTarget &&
        e.checkOutUtc != null &&
        e.checkOutUtc !== "" &&
        e.cierreAutomaticoMedianoche !== true
    );
    if (!pendienteAyer) {
      if (diaYaConfirmado) resetAyerCompletaModal();
      return;
    }
    const wd = pendienteAyer.workDate;
    const checkInUtc = dateTimeLocalToUtcIso(wd, ayerManStart);
    const checkOutUtc = checkoutLocalIsoAfterCheckin(wd, checkInUtc, ayerManEnd);
    let breakMin = 0;
    if (typeof forcedBreak === "number") {
      breakMin = forcedBreak;
    } else if (ayerCompHadBreak === true) {
      breakMin = ayerCompOtroH * 60 + ayerCompOtroM;
      if (breakMin <= 0) {
        setAyerCompError("Indica el descanso con horas y minutos (debe ser mayor que 0).");
        return;
      }
    }
    const nowIso = new Date().toISOString();
    const today = localTodayISO();
    setEntries((prev) => {
      const idsPendienteAyer = prev
        .filter(
          (e) =>
            e.workerId === miWorkerId &&
            e.workDate === wdTarget &&
            (e.checkOutUtc == null || e.cierreAutomaticoMedianoche === true)
        )
        .map((e) => e.id);
      if (idsPendienteAyer.length > 0) {
        return prev.map((x) =>
          idsPendienteAyer.includes(x.id)
            ? {
                ...x,
                previousCheckInUtc: x.checkInUtc,
                previousCheckOutUtc: x.checkOutUtc,
                workDate: wd,
                checkInUtc,
                checkOutUtc,
                breakMinutes: breakMin,
                razon: "imputacion_manual_error",
                entradaManual: false,
                salidaManual: true,
                isEdited: true,
                updatedAtUtc: nowIso,
                updatedBy: miWorkerId,
                lastModifiedByEmail: user?.email ?? null,
                cierreAutomaticoMedianoche: false,
              }
            : x
        );
      }
      const maxId = prev.reduce((max, e) => (e.id > max ? e.id : max), 0);
      return [
        ...prev,
        {
          id: maxId + 1,
          workerId: miWorkerId,
          workDate: wd,
          checkInUtc,
          checkOutUtc,
          isEdited: true,
          createdAtUtc: nowIso,
          createdBy: miWorkerId,
          updatedAtUtc: nowIso,
          updatedBy: miWorkerId,
          razon: "imputacion_manual_error",
          salidaManual: true,
          breakMinutes: breakMin,
          lastModifiedByEmail: user?.email ?? null,
        },
      ];
    });
    resetAyerCompletaModal();
  };

  return {
    // modal state
    ayerCompStep,
    setAyerCompStep,
    ayerManStart,
    setAyerManStart,
    ayerManEnd,
    setAyerManEnd,
    ayerCompHadBreak,
    setAyerCompHadBreak,
    ayerCompOtroH,
    setAyerCompOtroH,
    ayerCompOtroM,
    setAyerCompOtroM,
    ayerCompError,
    setAyerCompError,
    // derived
    pendienteLaboral,
    fechaUltimoLaboral,
    ultimoLaboralSinFichaje,
    ultimoLaboralSinCerrar,
    entradaUltimoLaboral,
    hayDiasSinCuadrarEnHistorico,
    registroAyerParcial,
    fechaAyerEtiqueta,
    esFechaAyer,
    ayerMinutosBrutos,
    // handlers
    resetAyerCompletaModal,
    abrirCompletarAyer,
    submitCompletarAyer,
  };
}
