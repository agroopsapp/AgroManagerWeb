"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { companiesApi, getClientCompanyWithAreas, workServicesApi } from "@/services";
import { workReportsApi } from "@/services/work-reports.service";
import { downloadWorkPartPdf } from "@/lib/workPartPdf";
import type { WorkPartRecord } from "@/lib/workPartsStorage";
import {
  timeTrackingApi,
  type TimeEntryDto,
} from "@/services/time-tracking.service";
import type { TimeEntryMock } from "@/features/time-tracking/types";
import type { Company, WorkService } from "@/types";

type WorkPartTask = {
  companyId: string;
  companyName: string;
  serviceId: string;
  serviceName: string;
  areaId: string;
  areaName: string;
  areaObservations: string;
};

interface Params {
  openEntry: TimeEntryMock | null;
  entries: TimeEntryMock[];
  setEntries: React.Dispatch<React.SetStateAction<TimeEntryMock[]>>;
  miWorkerId: number;
}

export function useBreakModal({ openEntry, entries: _entries, setEntries, miWorkerId }: Params) {
  const SUCCESS_FEEDBACK_MS = 650;
  const splitMinutes = (totalMinutes: number, count: number): number[] => {
    if (count <= 0) return [];
    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
      return Array.from({ length: count }, () => 0);
    }
    const safeTotal = Math.floor(totalMinutes);
    const base = Math.floor(safeTotal / count);
    let remainder = safeTotal % count;
    return Array.from({ length: count }, () => {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      return base + extra;
    });
  };
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
    companyId?: string | null;
    timeEntryId?: string | null;
    userId?: string | null;
    workReportId?: string | null;
    checkInUtc: string;
    checkOutUtc: string;
    breakMinutes: number;
  }>(null);
  const [workPartError, setWorkPartError] = useState<string | null>(null);
  const [workPartSuccessMessage, setWorkPartSuccessMessage] = useState<string | null>(null);
  const [workPartJustSaved, setWorkPartJustSaved] = useState(false);
  const [workPartSignatureDialogOpen, setWorkPartSignatureDialogOpen] = useState(false);
  const [workPartSignatureTemp, setWorkPartSignatureTemp] = useState<string | null>(null);
  const [workPartPdfLoading, setWorkPartPdfLoading] = useState(false);
  const [workPartPdfGeneratedAt, setWorkPartPdfGeneratedAt] = useState<string | null>(null);
  const [workPartDataLoading, setWorkPartDataLoading] = useState(false);
  const [workPartModalMode, setWorkPartModalMode] = useState<"create" | "edit">("create");
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  useEffect(() => {
    if (!workPartSuccessMessage) return;
    const t = window.setTimeout(() => setWorkPartSuccessMessage(null), SUCCESS_FEEDBACK_MS);
    return () => window.clearTimeout(t);
  }, [workPartSuccessMessage, SUCCESS_FEEDBACK_MS]);

  useEffect(() => {
    if (!workPartJustSaved) return;
    const t = window.setTimeout(() => setWorkPartJustSaved(false), SUCCESS_FEEDBACK_MS);
    return () => window.clearTimeout(t);
  }, [workPartJustSaved, SUCCESS_FEEDBACK_MS]);

  useEffect(() => {
    if (restModalStep !== "workPart") return;
    setWorkPartError(null);
    const ac = new AbortController();
    setWorkPartDataLoading(true);
    (async () => {
      try {
        const [companiesList, s] = await Promise.all([
          companiesApi.getAll(),
          workServicesApi.getAll(),
        ]);
        const c = await Promise.all(
          companiesList.map((company) =>
            getClientCompanyWithAreas(company.id).catch(() => company),
          ),
        );
        if (ac.signal.aborted) return;
        setWorkPartCompanies(c);
        setWorkPartServices(s);
      } catch (e) {
        if (ac.signal.aborted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setWorkPartError("No se pudieron cargar empresas o servicios.");
        setWorkPartCompanies([]);
        setWorkPartServices([]);
      } finally {
        if (!ac.signal.aborted) setWorkPartDataLoading(false);
      }
    })();
    return () => ac.abort();
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
      const preferredCompanyId = workPartOverrideEntry?.companyId ?? openEntry?.companyId ?? "";
      const c =
        workPartCompanies.find((x) => x.id === preferredCompanyId) ?? workPartCompanies[0];
      const sid = workPartServices[0]?.id ?? "";
      const aid = c?.areas[0]?.id ?? "";
      return [{ lineId: lid, companyId: c?.id ?? "", serviceId: sid, areaId: aid }];
    });
  }, [
    restModalStep,
    workPartDataLoading,
    workPartCompanies,
    workPartServices,
    workPartOverrideEntry?.companyId,
    openEntry?.companyId,
  ]);

  // ----- Handlers -----

  const openAskRest = useCallback(() => {
    setRestAnswerHadBreak(null);
    setRestMinutes(0);
    setRestClockHour(0);
    setRestClockMinute(30);
    setRestClockPhase("hour");
    setAskAmountError(null);
    setWorkPartModalMode("create");
    setWorkPartSignatureTemp(null);
    setWorkPartSignatureDialogOpen(false);
    setWorkPartPdfGeneratedAt(null);
    setRestModalStep("askRest");
  }, []);

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

  const finalizeCheckOutWithRest = async (opts?: {
    closeOnSuccess?: boolean;
  }): Promise<TimeEntryDto | null> => {
    if (!openEntry) {
      if (opts?.closeOnSuccess !== false) setRestModalStep("closed");
      return null;
    }
    const breakMin = restAnswerHadBreak === false ? 0 : restMinutes;
    setCheckoutSubmitting(true);
    setWorkPartError(null);
    try {
      const finishedEntry = await timeTrackingApi.finish(breakMin);
      setEntries((prev) => {
        const outIso = finishedEntry.checkOutUtc ?? new Date().toISOString();
        return prev.map((e) =>
          (e.timeEntryId && openEntry.timeEntryId
            ? e.timeEntryId === openEntry.timeEntryId
            : e.id === openEntry.id)
            ? {
                ...e,
                timeEntryId: finishedEntry.timeEntryId ?? e.timeEntryId ?? null,
                checkOutUtc: outIso,
                updatedAtUtc: finishedEntry.updatedAtUtc ?? outIso,
                updatedBy: finishedEntry.updatedBy ?? miWorkerId,
                breakMinutes: finishedEntry.breakMinutes ?? breakMin,
                companyId: finishedEntry.companyId ?? e.companyId ?? null,
                workReportId: finishedEntry.workReportId ?? e.workReportId ?? null,
                userId: finishedEntry.userId ?? e.userId ?? null,
                userName: finishedEntry.userName ?? e.userName ?? null,
                userEmail: finishedEntry.userEmail ?? e.userEmail ?? null,
                lastModifiedByEmail:
                  finishedEntry.lastModifiedByEmail ?? e.lastModifiedByEmail ?? null,
                lastModifiedByName:
                  finishedEntry.lastModifiedByName ?? e.lastModifiedByName ?? null,
              }
            : e
        );
      });
      if (opts?.closeOnSuccess !== false) setRestModalStep("closed");
      return finishedEntry;
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "No se pudo finalizar la jornada.";
      setWorkPartError(msg);
      return null;
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const confirmWorkPartAndCheckout = async () => {
    const target =
      workPartOverrideEntry ??
      (openEntry
        ? {
            workDate: openEntry.workDate,
            workerId: miWorkerId,
            companyId: openEntry.companyId ?? null,
            timeEntryId: openEntry.timeEntryId ?? null,
            userId: openEntry.userId ?? null,
            workReportId: openEntry.workReportId ?? null,
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

    setWorkPartError(null);
    // El API a veces devuelve el fichaje sin companyId (p. ej. primera jornada).
    // Las líneas del parte sí obligan a elegir empresa: usamos la primera como respaldo.
    const reportCompanyId =
      typeof target.companyId === "string" && target.companyId.trim().length > 0
        ? target.companyId.trim()
        : tasks[0]?.companyId ?? null;
    if (!reportCompanyId) {
      setWorkPartError("Falta empresa en el parte. Elige empresa (y área) en cada tarea.");
      return;
    }
    const saveWorkReport = async (
      source: typeof target,
      override?: TimeEntryDto | null,
    ): Promise<string | null> => {
      const startMs = Date.parse(source.checkInUtc);
      const endIso =
        source.checkOutUtc ??
        override?.checkOutUtc ??
        override?.updatedAtUtc ??
        new Date().toISOString();
      const endMs = Date.parse(endIso);
      const grossMinutes =
        Number.isFinite(startMs) && Number.isFinite(endMs)
          ? Math.max(0, Math.round((endMs - startMs) / 60000))
          : 0;
      const breakMin = Math.max(0, source.breakMinutes ?? target.breakMinutes ?? 0);
      const workedMinutes = Math.max(0, grossMinutes - breakMin);
      const distributed = splitMinutes(workedMinutes, tasks.length);
      const linesPayload = tasks.map((task, idx) => ({
        clientCompanyId: task.companyId,
        serviceId: task.serviceId,
        workAreaId: task.areaId,
        minutes: distributed[idx] ?? 0,
        clientCompanyNameSnapshot: task.companyName,
        serviceNameSnapshot: task.serviceName,
        workAreaNameSnapshot: task.areaName,
        notes: "",
        workAreaDescriptionSnapshot: task.areaObservations,
      }));

      const sourceReportId =
        source?.workReportId ??
        (override?.workReportId ?? null);
      if (sourceReportId) {
        await workReportsApi.updateWithLines(sourceReportId, {
          status: "Closed",
          notes: "Parte cerrado",
          signatureUrl: workPartSignatureTemp,
          signatureAt: workPartSignatureTemp ? new Date().toISOString() : null,
          signatureUserId: source?.userId ?? override?.userId ?? null,
          pdfGeneratedAt: workPartPdfGeneratedAt,
          lines: linesPayload,
        });
        setWorkPartSuccessMessage("Parte actualizado correctamente.");
        setWorkPartJustSaved(true);
        return sourceReportId;
      }
      const timeEntryId = source?.timeEntryId ?? override?.timeEntryId ?? null;
      const userId = source?.userId ?? override?.userId ?? null;
      const companyId = reportCompanyId;
      if (!timeEntryId || !userId || !companyId) {
        throw new Error("Faltan datos para crear el parte (companyId/timeEntryId/userId).");
      }
      const created = await workReportsApi.createWithLines({
        companyId,
        timeEntryId,
        userId,
        workDate: source.workDate,
        status: "Open",
        notes: "Parte creado desde modal",
        lines: linesPayload,
      });
      setWorkPartSuccessMessage("Parte creado correctamente.");
      setWorkPartJustSaved(true);
      return created.id;
    };

    if (workPartOverrideEntry) {
      try {
        const reportId = await saveWorkReport(target, null);
        if (reportId) {
          setEntries((prev) =>
            prev.map((e) =>
              (e.timeEntryId && target.timeEntryId
                ? e.timeEntryId === target.timeEntryId
                : e.workerId === target.workerId &&
                  e.workDate === target.workDate &&
                  e.checkInUtc === target.checkInUtc)
                ? { ...e, workReportId: reportId }
                : e,
            ),
          );
        }
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "No se pudo guardar el parte.";
        setWorkPartError(msg);
        return;
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, SUCCESS_FEEDBACK_MS));
      setWorkPartSuccessMessage(null);
      setWorkPartJustSaved(false);
      setRestModalStep("closed");
      setWorkPartOverrideEntry(null);
      return;
    }

    const finished = await finalizeCheckOutWithRest({ closeOnSuccess: false });
    if (!finished) return;
    let reportId: string | null = null;
    try {
      reportId = await saveWorkReport(target, finished);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo guardar el parte.";
      setWorkPartError(msg);
      return;
    }
    if (reportId) {
      setEntries((prev) =>
        prev.map((e) =>
          (e.timeEntryId && (finished.timeEntryId || target.timeEntryId)
            ? e.timeEntryId === (finished.timeEntryId || target.timeEntryId)
            : e.workerId === target.workerId &&
              e.workDate === target.workDate &&
              e.checkInUtc === target.checkInUtc)
            ? { ...e, workReportId: reportId }
            : e,
        ),
      );
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, SUCCESS_FEEDBACK_MS));
    setWorkPartSuccessMessage(null);
    setWorkPartJustSaved(false);
    setRestModalStep("closed");
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

  const generateWorkPartPdf = async () => {
    const target =
      workPartOverrideEntry ??
      (openEntry
        ? {
            workDate: openEntry.workDate,
            workerId: miWorkerId,
            companyId: openEntry.companyId ?? null,
            timeEntryId: openEntry.timeEntryId ?? null,
            userId: openEntry.userId ?? null,
            workReportId: openEntry.workReportId ?? null,
            checkInUtc: openEntry.checkInUtc,
            checkOutUtc: openEntry.checkOutUtc ?? new Date().toISOString(),
            breakMinutes: restAnswerHadBreak === false ? 0 : restMinutes,
          }
        : null);
    if (!target) {
      setWorkPartError("No hay un fichaje válido para generar el PDF.");
      return;
    }
    if (workPartLines.length === 0) {
      setWorkPartError("Añade al menos una tarea antes de descargar el PDF.");
      return;
    }

    const tasks: WorkPartTask[] = [];
    for (const line of workPartLines) {
      const company = workPartCompanies.find((c) => c.id === line.companyId);
      const service = workPartServices.find((s) => s.id === line.serviceId);
      const area = company?.areas.find((a) => a.id === line.areaId);
      if (!company || !service || !area) {
        setWorkPartError("Revisa tareas: empresa, servicio y área deben ser válidos.");
        return;
      }
      tasks.push({
        companyId: company.id,
        companyName: company.name,
        serviceId: service.id,
        serviceName: service.name,
        areaId: area.id,
        areaName: area.name,
        areaObservations: area.observations ?? "",
      });
    }

    const checkOutIso = target.checkOutUtc ?? new Date().toISOString();
    const startMs = Date.parse(target.checkInUtc);
    const endMs = Date.parse(checkOutIso);
    const grossMinutes =
      Number.isFinite(startMs) && Number.isFinite(endMs)
        ? Math.max(0, Math.round((endMs - startMs) / 60000))
        : 0;
    const workedMinutes = Math.max(0, grossMinutes - Math.max(0, target.breakMinutes ?? 0));

    const record: WorkPartRecord = {
      id: target.workReportId ?? target.timeEntryId ?? `tmp-${Date.now()}`,
      workDate: target.workDate,
      workerId: target.workerId,
      entradaDisplay: new Date(target.checkInUtc).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid",
      }),
      salidaDisplay: new Date(checkOutIso).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid",
      }),
      breakMinutes: Math.max(0, target.breakMinutes ?? 0),
      workedMinutes,
      companyId: tasks[0]?.companyId ?? "",
      companyName: tasks[0]?.companyName ?? "—",
      tasks,
      savedAtUtc: new Date().toISOString(),
      signaturePngDataUrl: workPartSignatureTemp ?? undefined,
    };

    setWorkPartError(null);
    setWorkPartPdfLoading(true);
    try {
      await downloadWorkPartPdf(record, tasks, { companies: workPartCompanies });
      setWorkPartPdfGeneratedAt(new Date().toISOString());
    } catch {
      setWorkPartError("No se pudo generar el PDF del parte.");
    } finally {
      setWorkPartPdfLoading(false);
    }
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
    workPartSuccessMessage,
    setWorkPartSuccessMessage,
    workPartJustSaved,
    workPartSignatureDialogOpen,
    setWorkPartSignatureDialogOpen,
    workPartSignatureTemp,
    setWorkPartSignatureTemp,
    workPartPdfLoading,
    generateWorkPartPdf,
    workPartDataLoading,
    workPartModalMode,
    setWorkPartModalMode,
    checkoutSubmitting,
    openAskRest,
    confirmRestAmountAndShowSummary,
    finalizeCheckOutWithRest,
    confirmWorkPartAndCheckout,
    addWorkPartLine,
    removeWorkPartLine,
    patchWorkPartLine,
  };
}
