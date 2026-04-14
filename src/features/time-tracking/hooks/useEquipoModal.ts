"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkoutLocalIsoAfterCheckin,
  dateTimeLocalToUtcIso,
  minutesGrossWorkDay,
  parseForgotBreakCustom,
  utcToLocalHHMM,
} from "@/shared/utils/time";
import { isSinJornadaImputableRazon } from "@/features/time-tracking/utils/formatters";
import { isApplicationUserGuid } from "@/features/time-tracking/utils/applicationUserId";
import type {
  EquipoWorkerOption,
  ForgotMode,
  ForgotStep,
  TimeEntryMock,
} from "@/features/time-tracking/types";
import { ApiError } from "@/lib/api-client";
import { breakSummaryFromMinutes, timeTrackingApi } from "@/services/time-tracking.service";

type AuthUser = { id?: string; email?: string | null; role?: string; companyId?: string | null } | null | undefined;

interface Params {
  user: AuthUser;
  equipoTablaScrollRef: React.RefObject<HTMLDivElement>;
  equipoRestaurarScroll: React.MutableRefObject<{ top: number; left: number } | null>;
  equipoMarcarRestaurarScroll: React.MutableRefObject<boolean>;
  refetchEquipoRows: () => void;
  equipoWorkersCatalog: EquipoWorkerOption[];
  equipoSuperAdminCompanyId: string | null;
}

function resetHorarioWizardFields(
  setStep: (s: ForgotStep) => void,
  setErr: (e: string | null) => void,
  setBreakOtro: (b: boolean) => void,
  setBreakCustom: (s: string) => void,
) {
  setStep("full_start");
  setErr(null);
  setBreakOtro(false);
  setBreakCustom("");
}

export function useEquipoModal({
  user,
  equipoTablaScrollRef,
  equipoRestaurarScroll,
  equipoMarcarRestaurarScroll,
  refetchEquipoRows,
  equipoWorkersCatalog,
  equipoSuperAdminCompanyId,
}: Params) {
  const [equipoModal, setEquipoModal] = useState<null | {
    workerId: number;
    workDate: string;
    existing: TimeEntryMock | null;
    isWeekendFila: boolean;
    personaLabel?: string | null;
    targetUserId: string | null;
  }>(null);
  const [equipoModalVista, setEquipoModalVista] = useState<"menu" | "wizard">("menu");
  const [equipoFormError, setEquipoFormError] = useState<string | null>(null);
  const [equipoAbsenceSaving, setEquipoAbsenceSaving] = useState(false);

  const [horarioWizardStep, setHorarioWizardStep] = useState<ForgotStep>("full_start");
  const [horarioWizardTargetDate, setHorarioWizardTargetDate] = useState<string | null>(null);
  const [horarioFullStart, setHorarioFullStart] = useState("09:00");
  const [horarioFullEnd, setHorarioFullEnd] = useState("18:00");
  const [horarioFullBreakMins, setHorarioFullBreakMins] = useState(30);
  const [horarioFullBreakCustom, setHorarioFullBreakCustom] = useState("");
  const [horarioBreakOtro, setHorarioBreakOtro] = useState(false);
  const [horarioWizardError, setHorarioWizardError] = useState<string | null>(null);
  const [horarioWizardForgotMode, setHorarioWizardForgotMode] = useState<ForgotMode>("full_ayer");
  const [horarioWizardSaving, setHorarioWizardSaving] = useState(false);

  const equipoModalScrollY = useRef(0);

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

  const resolveCompanyIdForAbsence = useCallback((): string | null => {
    if (!equipoModal) return null;
    const { existing, targetUserId } = equipoModal;
    const exC = existing?.companyId?.trim();
    if (exC) return exC;
    const uid = targetUserId?.trim();
    if (uid && isApplicationUserGuid(uid)) {
      const w = equipoWorkersCatalog.find((x) => x.id === uid);
      const wc = w?.companyId?.trim();
      if (wc) return wc;
    }
    const sess = typeof user?.companyId === "string" ? user.companyId.trim() : "";
    if (sess) return sess;
    const filterCo = equipoSuperAdminCompanyId?.trim();
    if (filterCo) return filterCo;
    return null;
  }, [equipoModal, equipoWorkersCatalog, user?.companyId, equipoSuperAdminCompanyId]);

  const openEquipoEditModal = (opts: {
    workerId: number;
    workDate: string;
    existing: TimeEntryMock | null;
    isWeekendFila: boolean;
    personaLabel?: string | null;
    targetUserId?: string | null;
  }) => {
    setEquipoModalVista("menu");
    setEquipoFormError(null);
    resetHorarioWizardFields(
      setHorarioWizardStep,
      setHorarioWizardError,
      setHorarioBreakOtro,
      setHorarioFullBreakCustom,
    );
    setHorarioWizardTargetDate(opts.workDate);
    const ex = opts.existing;
    const targetUserId =
      (typeof opts.targetUserId === "string" && opts.targetUserId.trim()
        ? opts.targetUserId.trim()
        : null) ??
      (typeof ex?.userId === "string" && ex.userId.trim() ? ex.userId.trim() : null);
    setEquipoModal({
      workerId: opts.workerId,
      workDate: opts.workDate,
      existing: opts.existing,
      isWeekendFila: opts.isWeekendFila,
      personaLabel: opts.personaLabel,
      targetUserId,
    });
  };

  const cerrarEquipoModal = () => {
    setEquipoModal(null);
    setEquipoFormError(null);
    setEquipoAbsenceSaving(false);
    setEquipoModalVista("menu");
    resetHorarioWizardFields(
      setHorarioWizardStep,
      setHorarioWizardError,
      setHorarioBreakOtro,
      setHorarioFullBreakCustom,
    );
    setHorarioWizardTargetDate(null);
    setHorarioWizardSaving(false);
  };

  const enterEquipoHorarioWizard = useCallback(() => {
    if (!equipoModal) return;
    setEquipoFormError(null);
    setHorarioWizardError(null);
    setHorarioBreakOtro(false);
    setHorarioFullBreakCustom("");
    setHorarioWizardStep("full_start");
    setHorarioWizardTargetDate(equipoModal.workDate);
    setHorarioWizardForgotMode("full_ayer");
    const ex = equipoModal.existing;
    if (ex && !isSinJornadaImputableRazon(ex.razon) && ex.checkOutUtc) {
      setHorarioFullStart(utcToLocalHHMM(ex.checkInUtc));
      setHorarioFullEnd(utcToLocalHHMM(ex.checkOutUtc));
      setHorarioFullBreakMins(ex.breakMinutes ?? 30);
    } else {
      setHorarioFullStart("09:00");
      setHorarioFullEnd("18:00");
      setHorarioFullBreakMins(30);
    }
    setEquipoModalVista("wizard");
  }, [equipoModal]);

  const volverEquipoHorarioWizardAMenu = useCallback(() => {
    setHorarioWizardError(null);
    setEquipoModalVista("menu");
    resetHorarioWizardFields(
      setHorarioWizardStep,
      setHorarioWizardError,
      setHorarioBreakOtro,
      setHorarioFullBreakCustom,
    );
  }, []);

  const absencePlaceholderRangeUtc = useCallback((workDate: string) => {
    const startAt = dateTimeLocalToUtcIso(workDate, "08:00");
    const endAt = checkoutLocalIsoAfterCheckin(workDate, startAt, "08:01");
    return { startAt, endAt };
  }, []);

  const guardarEquipoVacacionesOBaja = async (
    tipo: "vacaciones" | "baja" | "dia_no_laboral",
  ) => {
    if (!equipoModal) return;
    const { workDate, existing, targetUserId } = equipoModal;

    if (!isApplicationUserGuid(targetUserId)) {
      setEquipoFormError(
        "No hay userId (GUID) de aplicación para este trabajador. " +
          "Carga el equipo desde el API o elige una persona del listado de usuarios.",
      );
      return;
    }

    const companyId = resolveCompanyIdForAbsence();
    if (!companyId) {
      setEquipoFormError(
        "Falta companyId para crear la ausencia. Revisa la empresa del trabajador, " +
          "el filtro de empresa o tu sesión (login).",
      );
      return;
    }

    const apiStatus =
      tipo === "vacaciones" ? "Vacation" : tipo === "baja" ? "SickLeave" : "NonWorkingDay";
    const { startAt, endAt } = absencePlaceholderRangeUtc(workDate);

    const tab = equipoTablaScrollRef.current;
    if (tab) {
      equipoRestaurarScroll.current = { top: tab.scrollTop, left: tab.scrollLeft };
      equipoMarcarRestaurarScroll.current = true;
    }

    setEquipoFormError(null);
    setEquipoAbsenceSaving(true);
    try {
      const timeEntryId =
        typeof existing?.timeEntryId === "string" && existing.timeEntryId.trim().length > 0
          ? existing.timeEntryId.trim()
          : null;

      if (timeEntryId) {
        await timeTrackingApi.updateTimeEntry(timeEntryId, {
          workDate,
          startAt,
          endAt,
          status: apiStatus,
          breakMinutes: 0,
          breakSummary: breakSummaryFromMinutes(0),
          isManuallyCompleted: true,
        });
      } else {
        await timeTrackingApi.createTimeEntry({
          companyId,
          userId: targetUserId!,
          workDate,
          startAt,
          endAt,
          status: apiStatus,
          breakMinutes: 0,
          breakSummary: breakSummaryFromMinutes(0),
        });
      }

      refetchEquipoRows();
      cerrarEquipoModal();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : "No se pudo guardar la ausencia. Revisa permisos y datos.";
      setEquipoFormError(msg);
    } finally {
      setEquipoAbsenceSaving(false);
    }
  };

  const submitEquipoHorarioJornadaCompleta = async (forcedBreakMinutes?: number) => {
    if (!equipoModal || horarioWizardSaving) return;
    const { workDate, existing, targetUserId } = equipoModal;

    const gross = minutesGrossWorkDay(workDate, horarioFullStart, horarioFullEnd);
    if (gross <= 0) {
      setHorarioWizardError("La hora de salida debe ser posterior a la entrada.");
      return;
    }

    let breakMin = 0;
    if (typeof forcedBreakMinutes === "number") {
      breakMin = forcedBreakMinutes;
    } else {
      breakMin = horarioBreakOtro
        ? parseForgotBreakCustom(horarioFullBreakCustom)
        : horarioFullBreakMins;
      if (breakMin <= 0) {
        setHorarioWizardError(
          horarioBreakOtro
            ? "Escribe el tiempo de descanso (ej. 45 min, 1h30)."
            : "Elige cuánto tiempo has parado.",
        );
        return;
      }
    }

    if (breakMin > gross) {
      setHorarioWizardError("Los minutos de descanso no pueden superar la jornada bruta.");
      return;
    }

    if (!isApplicationUserGuid(targetUserId)) {
      setHorarioWizardError(
        "No hay userId (GUID) de aplicación para este trabajador. " +
          "Carga el equipo desde el API o elige persona del listado.",
      );
      return;
    }

    const checkInUtc = dateTimeLocalToUtcIso(workDate, horarioFullStart);
    const checkOutUtc = checkoutLocalIsoAfterCheckin(workDate, checkInUtc, horarioFullEnd);

    const tab = equipoTablaScrollRef.current;
    if (tab) {
      equipoRestaurarScroll.current = { top: tab.scrollTop, left: tab.scrollLeft };
      equipoMarcarRestaurarScroll.current = true;
    }

    setHorarioWizardError(null);
    setHorarioWizardSaving(true);
    try {
      const companyId = resolveCompanyIdForAbsence();
      const timeEntryId =
        typeof existing?.timeEntryId === "string" && existing.timeEntryId.trim().length > 0
          ? existing.timeEntryId.trim()
          : null;

      const breakSummary = breakSummaryFromMinutes(breakMin);
      if (timeEntryId) {
        await timeTrackingApi.updateTimeEntry(timeEntryId, {
          workDate,
          startAt: checkInUtc,
          endAt: checkOutUtc,
          status: "Closed",
          breakMinutes: breakMin,
          breakSummary,
          isManuallyCompleted: true,
        });
      } else {
        if (!companyId) {
          setHorarioWizardError(
            "Falta companyId para crear el fichaje. Revisa empresa del trabajador o sesión.",
          );
          return;
        }
        await timeTrackingApi.createTimeEntry({
          companyId,
          userId: targetUserId!,
          workDate,
          startAt: checkInUtc,
          endAt: checkOutUtc,
          status: "Closed",
          breakMinutes: breakMin,
          breakSummary,
        });
      }

      refetchEquipoRows();
      cerrarEquipoModal();
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "No se pudo guardar el horario. Revisa permisos.";
      setHorarioWizardError(msg);
    } finally {
      setHorarioWizardSaving(false);
    }
  };

  return {
    equipoModal,
    equipoModalVista,
    equipoFormError,
    setEquipoFormError,
    equipoAbsenceSaving,
    openEquipoEditModal,
    cerrarEquipoModal,
    guardarEquipoVacacionesOBaja,
    enterEquipoHorarioWizard,
    volverEquipoHorarioWizardAMenu,
    horarioWizardStep,
    setHorarioWizardStep,
    horarioWizardTargetDate,
    setHorarioWizardTargetDate,
    horarioFullStart,
    setHorarioFullStart,
    horarioFullEnd,
    setHorarioFullEnd,
    horarioFullBreakMins,
    setHorarioFullBreakMins,
    horarioFullBreakCustom,
    setHorarioFullBreakCustom,
    horarioBreakOtro,
    setHorarioBreakOtro,
    horarioWizardError,
    setHorarioWizardError,
    horarioWizardForgotMode,
    setHorarioWizardForgotMode,
    horarioWizardSaving,
    submitEquipoHorarioJornadaCompleta,
  };
}
