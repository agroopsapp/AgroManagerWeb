"use client";
import { useState } from "react";
import {
  checkoutLocalIsoAfterCheckin,
  dateTimeLocalToUtcIso,
  localTodayISO,
  parseForgotBreakCustom,
} from "@/shared/utils/time";
import type { ForgotMode, ForgotStep, TimeEntryMock } from "@/features/time-tracking/types";

type AuthUser = { id?: string; email?: string | null; role?: string } | null | undefined;

interface Params {
  miWorkerId: number;
  user: AuthUser;
  entries: TimeEntryMock[];
  setEntries: React.Dispatch<React.SetStateAction<TimeEntryMock[]>>;
  setWorkPartOverrideEntry: React.Dispatch<
    React.SetStateAction<null | {
      workDate: string;
      workerId: number;
      checkInUtc: string;
      checkOutUtc: string;
      breakMinutes: number;
    }>
  >;
  setWorkPartLines: React.Dispatch<
    React.SetStateAction<
      { lineId: string; companyId: string; serviceId: string; areaId: string }[]
    >
  >;
  setRestModalStep: React.Dispatch<
    React.SetStateAction<"closed" | "askRest" | "askAmount" | "summary" | "workPart">
  >;
}

export function useForgotModal({
  miWorkerId,
  user,
  entries,
  setEntries,
  setWorkPartOverrideEntry,
  setWorkPartLines,
  setRestModalStep,
}: Params) {
  const [forgotStep, setForgotStep] = useState<ForgotStep>("closed");
  const [forgotTargetDate, setForgotTargetDate] = useState<string | null>(null);
  const [forgotSoloTime, setForgotSoloTime] = useState("09:00");
  const [forgotFullStart, setForgotFullStart] = useState("09:00");
  const [forgotFullEnd, setForgotFullEnd] = useState("18:00");
  const [forgotFullHadBreak, setForgotFullHadBreak] = useState<boolean | null>(null);
  const [forgotFullBreakMins, setForgotFullBreakMins] = useState(30);
  const [forgotFullBreakCustom, setForgotFullBreakCustom] = useState("");
  const [forgotBreakOtro, setForgotBreakOtro] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState<ForgotMode>(null);

  const hasEntryForDate = (workDate: string) =>
    entries.some((e) => e.workDate === workDate && e.workerId === miWorkerId);

  const resetForgotModal = () => {
    setForgotStep("closed");
    setForgotTargetDate(null);
    setForgotSoloTime("09:00");
    setForgotFullStart("09:00");
    setForgotFullEnd("18:00");
    setForgotFullHadBreak(null);
    setForgotFullBreakMins(30);
    setForgotFullBreakCustom("");
    setForgotBreakOtro(false);
    setForgotError(null);
    setForgotMode(null);
  };

  const openForgotModal = () => {
    setForgotError(null);
    setForgotTargetDate(null);
    setForgotStep("pick_day");
  };

  const submitForgotSoloEntrada = () => {
    const today = localTodayISO();
    if (!forgotTargetDate) return;
    if (forgotTargetDate !== today) {
      setForgotError("Solo puedes registrar solo la entrada para el día de hoy.");
      return;
    }
    if (hasEntryForDate(forgotTargetDate)) {
      setForgotError("Ya existe un fichaje para ese día.");
      return;
    }
    const checkInUtc = dateTimeLocalToUtcIso(forgotTargetDate, forgotSoloTime);
    setEntries((prev) => {
      const maxId = prev.reduce((max, e) => (e.id > max ? e.id : max), 0);
      const nowIso = new Date().toISOString();
      return [
        ...prev,
        {
          id: maxId + 1,
          workerId: miWorkerId,
          workDate: forgotTargetDate,
          checkInUtc,
          checkOutUtc: null,
          isEdited: true,
          createdAtUtc: nowIso,
          createdBy: miWorkerId,
          updatedAtUtc: null,
          updatedBy: null,
          razon: "imputacion_manual_error",
          entradaManual: true,
          breakMinutes: 0,
          lastModifiedByEmail: user?.email ?? null,
        },
      ];
    });
    resetForgotModal();
  };

  const submitForgotJornadaCompleta = (forcedBreakMinutes?: number) => {
    if (!forgotTargetDate) return;
    if (hasEntryForDate(forgotTargetDate)) {
      setForgotError("Ya existe un fichaje para ese día.");
      return;
    }
    const checkInUtc = dateTimeLocalToUtcIso(forgotTargetDate, forgotFullStart);
    const checkOutUtc = checkoutLocalIsoAfterCheckin(forgotTargetDate, checkInUtc, forgotFullEnd);
    let breakMin = 0;
    if (typeof forcedBreakMinutes === "number") {
      breakMin = forcedBreakMinutes;
    } else if (forgotFullHadBreak === true) {
      breakMin = forgotBreakOtro
        ? parseForgotBreakCustom(forgotFullBreakCustom)
        : forgotFullBreakMins;
      if (breakMin <= 0) {
        setForgotError(
          forgotBreakOtro
            ? "Escribe el tiempo de descanso (ej. 45 min, 1h30)."
            : "Elige cuánto tiempo has parado."
        );
        return;
      }
    }
    setEntries((prev) => {
      const maxId = prev.reduce((max, e) => (e.id > max ? e.id : max), 0);
      const nowIso = new Date().toISOString();
      return [
        ...prev,
        {
          id: maxId + 1,
          workerId: miWorkerId,
          workDate: forgotTargetDate,
          checkInUtc,
          checkOutUtc,
          isEdited: true,
          createdAtUtc: nowIso,
          createdBy: miWorkerId,
          updatedAtUtc: nowIso,
          updatedBy: miWorkerId,
          razon: "imputacion_manual_error",
          entradaManual: false,
          breakMinutes: breakMin,
          lastModifiedByEmail: user?.email ?? null,
        },
      ];
    });
    setWorkPartOverrideEntry({
      workDate: forgotTargetDate,
      workerId: miWorkerId,
      checkInUtc,
      checkOutUtc,
      breakMinutes: breakMin,
    });
    const lid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ln-${Date.now()}`;
    setWorkPartLines([{ lineId: lid, companyId: "", serviceId: "", areaId: "" }]);
    resetForgotModal();
    setRestModalStep("workPart");
  };

  return {
    forgotStep,
    setForgotStep,
    forgotTargetDate,
    setForgotTargetDate,
    forgotSoloTime,
    setForgotSoloTime,
    forgotFullStart,
    setForgotFullStart,
    forgotFullEnd,
    setForgotFullEnd,
    forgotFullHadBreak,
    setForgotFullHadBreak,
    forgotFullBreakMins,
    setForgotFullBreakMins,
    forgotFullBreakCustom,
    setForgotFullBreakCustom,
    forgotBreakOtro,
    setForgotBreakOtro,
    forgotError,
    setForgotError,
    forgotMode,
    setForgotMode,
    resetForgotModal,
    openForgotModal,
    submitForgotSoloEntrada,
    submitForgotJornadaCompleta,
  };
}
