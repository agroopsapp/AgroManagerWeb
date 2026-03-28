"use client";
import { useEffect, useState } from "react";
import { customerCompanyMock } from "@/lib/customerCompanyMock";
import { workServicesMock } from "@/lib/workServicesMock";
import {
  appendWorkPart,
  type WorkPartTask,
} from "@/lib/workPartsStorage";
import { diffDurationMinutes, formatTimeLocal } from "@/shared/utils/time";
import type { TimeEntryMock } from "@/features/time-tracking/types";
import type { Company, WorkService } from "@/types";

type AuthUser = { id?: string; email?: string | null; role?: string } | null | undefined;

interface Params {
  openEntry: TimeEntryMock | null;
  entries: TimeEntryMock[];
  setEntries: React.Dispatch<React.SetStateAction<TimeEntryMock[]>>;
  miWorkerId: number;
  user: AuthUser;
}

export function useBreakModal({ openEntry, entries: _entries, setEntries, miWorkerId, user }: Params) {
  const [restModalStep, setRestModalStep] = useState<
    "closed" | "askRest" | "askAmount" | "summary" | "workPart"
  >("closed");
  const [restAnswerHadBreak, setRestAnswerHadBreak] = useState<boolean | null>(null);
  const [restMinutes, setRestMinutes] = useState<number>(0);
  const [restClockHour, setRestClockHour] = useState(0);
  const [restClockMinute, setRestClockMinute] = useState(30);
  const [restClockPhase, setRestClockPhase] = useState<"hour" | "minute">("hour");
  const [askAmountError, setAskAmountError] = useState<string | null>(null);

  const [workPartCompanies, setWorkPartCompanies] = useState<Company[]>([]);
  const [workPartServices, setWorkPartServices] = useState<WorkService[]>([]);
  const [workPartLines, setWorkPartLines] = useState<
    { lineId: string; companyId: string; serviceId: string; areaId: string }[]
  >([]);
  const [workPartOverrideEntry, setWorkPartOverrideEntry] = useState<null | {
    workDate: string;
    workerId: number;
    checkInUtc: string;
    checkOutUtc: string;
    breakMinutes: number;
  }>(null);
  const [workPartError, setWorkPartError] = useState<string | null>(null);
  const [workPartDataLoading, setWorkPartDataLoading] = useState(false);

  // Load companies/services when entering workPart step
  useEffect(() => {
    if (restModalStep !== "workPart") return;
    setWorkPartError(null);
    let alive = true;
    setWorkPartDataLoading(true);
    (async () => {
      try {
        const [c, s] = await Promise.all([
          customerCompanyMock.getAll(),
          workServicesMock.getAll(),
        ]);
        if (!alive) return;
        setWorkPartCompanies(c);
        setWorkPartServices(s);
      } catch {
        if (!alive) return;
        setWorkPartError("No se pudieron cargar empresas o servicios.");
        setWorkPartCompanies([]);
        setWorkPartServices([]);
      } finally {
        if (alive) setWorkPartDataLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [restModalStep]);

  // Sync company/area selection when companies are loaded
  useEffect(() => {
    if (restModalStep !== "workPart" || workPartCompanies.length === 0) return;
    setWorkPartLines((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((l) => {
        const valid = workPartCompanies.find((x) => x.id === l.companyId);
        const c = valid ?? workPartCompanies[0];
        const areaId =
          l.areaId && c.areas.some((a) => a.id === l.areaId)
            ? l.areaId
            : c.areas[0]?.id ?? "";
        return { ...l, companyId: c.id, areaId };
      });
    });
  }, [restModalStep, workPartCompanies]);

  // Sync service selection
  useEffect(() => {
    if (restModalStep !== "workPart" || workPartServices.length === 0) return;
    setWorkPartLines((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((l) => ({
        ...l,
        serviceId:
          l.serviceId && workPartServices.some((s) => s.id === l.serviceId)
            ? l.serviceId
            : workPartServices[0].id,
      }));
    });
  }, [restModalStep, workPartServices]);

  // Ensure at least one line when data is ready
  useEffect(() => {
    if (restModalStep !== "workPart" || workPartDataLoading) return;
    if (workPartCompanies.length === 0 || workPartServices.length === 0) return;
    setWorkPartLines((prev) => {
      if (prev.length > 0) return prev;
      const lid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `ln-${Date.now()}`;
      const c = workPartCompanies[0];
      const sid = workPartServices[0]?.id ?? "";
      const aid = c?.areas[0]?.id ?? "";
      return [{ lineId: lid, companyId: c?.id ?? "", serviceId: sid, areaId: aid }];
    });
  }, [restModalStep, workPartDataLoading, workPartCompanies, workPartServices]);

  // ----- Handlers -----

  const openAskRest = () => {
    setRestAnswerHadBreak(null);
    setRestMinutes(0);
    setRestClockHour(0);
    setRestClockMinute(30);
    setRestClockPhase("hour");
    setAskAmountError(null);
    setRestModalStep("askRest");
  };

  const confirmRestAmountAndShowSummary = () => {
    const minutes = restClockHour * 60 + restClockMinute;
    if (minutes <= 0) {
      setAskAmountError("Selecciona al menos unos minutos en el reloj.");
      return;
    }
    setAskAmountError(null);
    setRestMinutes(minutes);
    setRestModalStep("summary");
  };

  const finalizeCheckOutWithRest = () => {
    if (!openEntry) {
      setRestModalStep("closed");
      return;
    }
    setEntries((prev) => {
      const nowIso = new Date().toISOString();
      const breakMin = restAnswerHadBreak === false ? 0 : restMinutes;
      return prev.map((e) =>
        e.id === openEntry.id
          ? {
              ...e,
              checkOutUtc: nowIso,
              updatedAtUtc: nowIso,
              updatedBy: miWorkerId,
              breakMinutes: breakMin,
              lastModifiedByEmail: user?.email ?? null,
            }
          : e
      );
    });
    setRestModalStep("closed");
  };

  const confirmWorkPartAndCheckout = () => {
    const target =
      workPartOverrideEntry ??
      (openEntry
        ? {
            workDate: openEntry.workDate,
            workerId: miWorkerId,
            checkInUtc: openEntry.checkInUtc,
            checkOutUtc: new Date().toISOString(),
            breakMinutes: restAnswerHadBreak === false ? 0 : restMinutes,
          }
        : null);

    if (!target) {
      setRestModalStep("closed");
      setWorkPartOverrideEntry(null);
      return;
    }
    if (workPartLines.length === 0) {
      setWorkPartError("Añade al menos una tarea (empresa, servicio y área).");
      return;
    }

    const tasks: WorkPartTask[] = [];
    for (const line of workPartLines) {
      const company = workPartCompanies.find((c) => c.id === line.companyId);
      if (!company) {
        setWorkPartError("Revisa cada tarea: elige una empresa válida.");
        return;
      }
      if (!company.areas.length) {
        setWorkPartError(
          `«${company.name}» no tiene áreas. Configúralas en Empresas → Editar.`
        );
        return;
      }
      const svc = workPartServices.find((s) => s.id === line.serviceId);
      const ar = company.areas.find((a) => a.id === line.areaId);
      if (!svc || !ar) {
        setWorkPartError(
          "Revisa cada tarea: elige servicio y área válidos en todas las filas."
        );
        return;
      }
      tasks.push({
        companyId: company.id,
        companyName: company.name,
        serviceId: svc.id,
        serviceName: svc.name,
        areaId: ar.id,
        areaName: ar.name,
        areaObservations: ar.observations ?? "",
      });
    }

    const companyKeys = Array.from(new Set(tasks.map((t) => t.companyId)));
    const headerCompanyName =
      companyKeys.length === 1
        ? tasks[0].companyName
        : `Varias empresas (${companyKeys.length})`;

    setWorkPartError(null);
    const entradaDisplay = formatTimeLocal(target.checkInUtc);
    const salidaDisplay = formatTimeLocal(target.checkOutUtc);
    const breakMin = target.breakMinutes;
    const totalMinutes = diffDurationMinutes(target.checkInUtc, target.checkOutUtc);
    const workedMinutesCalc =
      totalMinutes === null ? 0 : Math.max(0, totalMinutes - breakMin);

    const partId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `wp-${Date.now()}`;

    appendWorkPart({
      id: partId,
      workDate: target.workDate,
      workerId: target.workerId,
      entradaDisplay,
      salidaDisplay,
      breakMinutes: breakMin,
      workedMinutes: workedMinutesCalc,
      companyId: tasks[0].companyId,
      companyName: headerCompanyName,
      tasks,
      savedAtUtc: new Date().toISOString(),
    });

    if (workPartOverrideEntry) {
      setRestModalStep("closed");
      setWorkPartOverrideEntry(null);
      return;
    }
    finalizeCheckOutWithRest();
  };

  const addWorkPartLine = () => {
    setWorkPartLines((prev) => {
      const last = prev[prev.length - 1];
      const fallback = workPartCompanies[0];
      const cid =
        last && workPartCompanies.some((x) => x.id === last.companyId)
          ? last.companyId
          : fallback?.id ?? "";
      const c = workPartCompanies.find((x) => x.id === cid) ?? fallback;
      const sid = workPartServices[0]?.id ?? "";
      const aid = c?.areas[0]?.id ?? "";
      const lid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `ln-${Date.now()}-${prev.length}`;
      return [...prev, { lineId: lid, companyId: cid, serviceId: sid, areaId: aid }];
    });
  };

  const removeWorkPartLine = (lineId: string) => {
    setWorkPartLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((l) => l.lineId !== lineId)
    );
  };

  const patchWorkPartLine = (
    lineId: string,
    patch: Partial<{ companyId: string; serviceId: string; areaId: string }>
  ) => {
    setWorkPartLines((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l))
    );
  };

  return {
    restModalStep,
    setRestModalStep,
    restAnswerHadBreak,
    setRestAnswerHadBreak,
    restMinutes,
    setRestMinutes,
    restClockHour,
    setRestClockHour,
    restClockMinute,
    setRestClockMinute,
    restClockPhase,
    setRestClockPhase,
    askAmountError,
    setAskAmountError,
    workPartCompanies,
    workPartServices,
    workPartLines,
    setWorkPartLines,
    workPartOverrideEntry,
    setWorkPartOverrideEntry,
    workPartError,
    setWorkPartError,
    workPartDataLoading,
    openAskRest,
    confirmRestAmountAndShowSummary,
    finalizeCheckOutWithRest,
    confirmWorkPartAndCheckout,
    addWorkPartLine,
    removeWorkPartLine,
    patchWorkPartLine,
  };
}
