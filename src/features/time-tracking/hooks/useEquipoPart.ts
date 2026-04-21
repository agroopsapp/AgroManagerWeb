"use client";

import { useCallback, useRef, useState } from "react";
import { useFlashSuccess } from "@/contexts/FlashSuccessContext";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";
import { downloadWorkPartPdf } from "@/lib/workPartPdf";
import type { WorkPartRecord, WorkPartTask } from "@/lib/workPartsStorage";
import { companiesApi, getClientCompanyWithAreas, usersApi, workServicesApi } from "@/services";
import { workReportsApi } from "@/services/work-reports.service";
import {
  effectiveWorkMinutesEntry,
  sessionDisplayNameFromEmail,
} from "@/features/time-tracking/utils/formatters";
import { workerNameById } from "@/mocks/time-tracking.mock";
import type { TimeEntryMock } from "@/features/time-tracking/types";
import type { Company, WorkService } from "@/types";
import { formatTimeLocal } from "@/shared/utils/time";

export type EquipoPartModalState = {
  workerId: number;
  workDate: string;
  entry: TimeEntryMock;
};

interface Params {
  setEquipoPartsVersion: React.Dispatch<React.SetStateAction<number>>;
  /** Tras guardar parte, refrescar filas del grid (workReportId en API). */
  refetchEquipoRows?: () => void;
  /** Si falta timeEntryId, userId, etc. (mismo criterio que Registro de jornada). */
  onValidationError?: (message: string) => void;
}

function splitMinutes(totalMinutes: number, count: number): number[] {
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
}

export function useEquipoPart({
  setEquipoPartsVersion,
  refetchEquipoRows,
  onValidationError,
}: Params) {
  const { showSuccess } = useFlashSuccess();
  const cancelledRef = useRef(false);

  const [equipoPartModal, setEquipoPartModal] = useState<EquipoPartModalState | null>(null);
  const [equipoPartCompanies, setEquipoPartCompanies] = useState<Company[]>([]);
  const [equipoPartServices, setEquipoPartServices] = useState<WorkService[]>([]);
  const [equipoPartLines, setEquipoPartLines] = useState<
    { lineId: string; companyId: string; serviceId: string; areaId: string; notes: string }[]
  >([]);
  const [equipoPartLoading, setEquipoPartLoading] = useState(false);
  const [equipoPartSaving, setEquipoPartSaving] = useState(false);
  const [equipoPartError, setEquipoPartError] = useState<string | null>(null);
  const [equipoPartSignatureDialogOpen, setEquipoPartSignatureDialogOpen] = useState(false);
  const [equipoPartSignatureTemp, setEquipoPartSignatureTemp] = useState<string | null>(null);
  const [equipoPartPdfLoading, setEquipoPartPdfLoading] = useState(false);
  const [equipoPartPdfGeneratedAt, setEquipoPartPdfGeneratedAt] = useState<string | null>(null);

  const closeEquipoPartEditor = useCallback(() => {
    cancelledRef.current = true;
    setEquipoPartModal(null);
    setEquipoPartLines([]);
    setEquipoPartCompanies([]);
    setEquipoPartServices([]);
    setEquipoPartLoading(false);
    setEquipoPartSaving(false);
    setEquipoPartError(null);
    setEquipoPartSignatureDialogOpen(false);
    setEquipoPartSignatureTemp(null);
    setEquipoPartPdfGeneratedAt(null);
  }, []);

  const openEquipoPartEditor = useCallback(
    async (entry: TimeEntryMock) => {
      const fail = (msg: string) => {
        onValidationError?.(msg);
      };

      if (!entry.checkOutUtc) {
        fail("Para crear o editar parte, la jornada debe tener salida.");
        return;
      }
      if (!entry.timeEntryId) {
        fail("Falta timeEntryId en el fichaje. No se puede crear/cargar el parte.");
        return;
      }
      if (!entry.userId) {
        fail("Falta userId en el fichaje. No se puede crear/cargar el parte.");
        return;
      }
      if (!entry.companyId) {
        fail("Falta companyId en el fichaje. No se puede crear/cargar el parte.");
        return;
      }

      cancelledRef.current = false;
      setEquipoPartModal({
        workerId: entry.workerId,
        workDate: entry.workDate,
        entry,
      });
      setEquipoPartError(null);
      setEquipoPartSignatureTemp(null);
      setEquipoPartSignatureDialogOpen(false);
      setEquipoPartPdfGeneratedAt(null);
      setEquipoPartLines([]);
      setEquipoPartCompanies([]);
      setEquipoPartServices([]);
      setEquipoPartLoading(true);

      try {
        const [companiesList, s] = await Promise.all([
          companiesApi.getAll(),
          workServicesApi.getAll(),
        ]);
        if (cancelledRef.current) return;

        const c = await Promise.all(
          companiesList.map((company) =>
            getClientCompanyWithAreas(company.id).catch(() => company),
          ),
        );
        if (cancelledRef.current) return;

        setEquipoPartCompanies(c);
        setEquipoPartServices(s);

        const newLineId = () =>
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `ln-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        if (entry.workReportId) {
          try {
            const report = await workReportsApi.getByIdWithLines(entry.workReportId);
            if (cancelledRef.current) return;
            const reportLines = report.lines.map((line, idx) => ({
              lineId:
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `ln-${Date.now()}-${idx}`,
              companyId: line.clientCompanyId,
              serviceId: line.serviceId,
              areaId: line.workAreaId,
              notes: typeof line.notes === "string" ? line.notes : "",
            }));
            setEquipoPartLines(
              reportLines.length > 0
                ? reportLines
                : [
                    {
                      lineId: newLineId(),
                      companyId: report.companyId,
                      serviceId: s[0]?.id ?? "",
                      areaId: c.find((x) => x.id === report.companyId)?.areas[0]?.id ?? "",
                      notes: "",
                    },
                  ],
            );
            setEquipoPartSignatureTemp(report.signatureUrl ?? null);
          } catch {
            if (cancelledRef.current) return;
            setEquipoPartError(
              "No se pudieron cargar las líneas del parte. Puedes revisarlo y guardarlo manualmente.",
            );
            const preferred = entry.companyId ?? "";
            const co = c.find((x) => x.id === preferred) ?? c[0];
            setEquipoPartLines([
              {
                lineId: newLineId(),
                companyId: co?.id ?? "",
                serviceId: s[0]?.id ?? "",
                areaId: co?.areas[0]?.id ?? "",
                notes: "",
              },
            ]);
          }
        } else {
          // Creación: lista vacía hasta que el usuario pulse «+ Añadir tarea».
          setEquipoPartLines([]);
        }
      } catch (e) {
        if (cancelledRef.current) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setEquipoPartCompanies([]);
        setEquipoPartServices([]);
        setEquipoPartError("No se pudieron cargar empresas o servicios.");
      } finally {
        if (!cancelledRef.current) setEquipoPartLoading(false);
      }
    },
    [onValidationError],
  );

  const addEquipoPartLine = useCallback(() => {
    setEquipoPartLines((prev) => {
      const last = prev[prev.length - 1];
      const fallback = equipoPartCompanies[0];
      const cid =
        last && equipoPartCompanies.some((x) => x.id === last.companyId)
          ? last.companyId
          : fallback?.id ?? "";
      const co = equipoPartCompanies.find((x) => x.id === cid) ?? fallback;
      const sid = equipoPartServices[0]?.id ?? "";
      const aid = co?.areas[0]?.id ?? "";
      const lid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `ln-${Date.now()}-${prev.length}`;
      return [...prev, { lineId: lid, companyId: cid, serviceId: sid, areaId: aid, notes: "" }];
    });
  }, [equipoPartCompanies, equipoPartServices]);

  const removeEquipoPartLine = useCallback((lineId: string) => {
    setEquipoPartLines((prev) => {
      const esEdicion = Boolean(equipoPartModal?.entry.workReportId?.trim());
      if (esEdicion && prev.length <= 1) return prev;
      return prev.filter((l) => l.lineId !== lineId);
    });
  }, [equipoPartModal?.entry.workReportId]);

  const patchEquipoPartLine = useCallback(
    (
      lineId: string,
      patch: Partial<{ companyId: string; serviceId: string; areaId: string; notes: string }>,
    ) => {
      setEquipoPartLines((prev) =>
        prev.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)),
      );
    },
    [],
  );

  const buildEquipoPartTasks = useCallback((): WorkPartTask[] | null => {
    if (!equipoPartModal) return null;
    const tasks: WorkPartTask[] = [];
    for (const line of equipoPartLines) {
      const company = equipoPartCompanies.find((c) => c.id === line.companyId);
      if (!company) return null;
      if (!company.areas.length) return null;
      const svc = equipoPartServices.find((s) => s.id === line.serviceId);
      const ar = company.areas.find((a) => a.id === line.areaId);
      if (!svc || !ar) return null;
      tasks.push({
        companyId: company.id,
        companyName: company.name,
        serviceId: svc.id,
        serviceName: svc.name,
        areaId: ar.id,
        areaName: ar.name,
        areaObservations: ar.observations ?? "",
        lineNotes: (line.notes ?? "").trim(),
      });
    }
    return tasks;
  }, [equipoPartModal, equipoPartLines, equipoPartCompanies, equipoPartServices]);

  const saveEquipoPart = useCallback(async () => {
    if (!equipoPartModal) return;
    const entry = equipoPartModal.entry;
    const tasks = buildEquipoPartTasks();
    if (!tasks || tasks.length === 0) {
      setEquipoPartError("Revisa las tareas: empresa con área, servicio y área en todas las filas.");
      return;
    }

    const reportCompanyId =
      typeof entry.companyId === "string" && entry.companyId.trim().length > 0
        ? entry.companyId.trim()
        : tasks[0]?.companyId ?? null;
    if (!reportCompanyId) {
      setEquipoPartError("Falta empresa en el parte. Elige empresa (y área) en cada tarea.");
      return;
    }

    const workedMinutes = Math.max(0, effectiveWorkMinutesEntry(entry));
    const distributed = splitMinutes(workedMinutes, tasks.length);
    const linesPayload = tasks.map((task, idx) => ({
      clientCompanyId: task.companyId,
      serviceId: task.serviceId,
      workAreaId: task.areaId,
      minutes: distributed[idx] ?? 0,
      clientCompanyNameSnapshot: task.companyName,
      serviceNameSnapshot: task.serviceName,
      workAreaNameSnapshot: task.areaName,
      notes: (task.lineNotes ?? "").trim(),
      workAreaDescriptionSnapshot: task.areaObservations,
    }));

    setEquipoPartError(null);
    setEquipoPartSaving(true);
    try {
      const timeEntryId = entry.timeEntryId ?? null;
      const userId = entry.userId ?? null;
      if (!timeEntryId || !userId) {
        setEquipoPartError("Faltan datos para guardar el parte (timeEntryId/userId).");
        return;
      }

      if (entry.workReportId) {
        await workReportsApi.updateWithLines(entry.workReportId, {
          status: "Closed",
          notes: "Parte cerrado",
          signatureUrl: equipoPartSignatureTemp,
          signatureAt: equipoPartSignatureTemp ? new Date().toISOString() : null,
          signatureUserId: userId,
          pdfGeneratedAt: equipoPartPdfGeneratedAt,
          lines: linesPayload,
        });
      } else {
        await workReportsApi.createWithLines({
          companyId: reportCompanyId,
          timeEntryId,
          userId,
          workDate: entry.workDate,
          status: "Open",
          notes: "Parte creado desde equipo",
          lines: linesPayload,
        });
      }

      setEquipoPartsVersion((v) => v + 1);
      refetchEquipoRows?.();
      closeEquipoPartEditor();
      showSuccess("Parte de trabajo guardado correctamente.");
    } catch (e) {
      setEquipoPartError(userVisibleMessageFromUnknown(e, "No se pudo guardar el parte."));
    } finally {
      setEquipoPartSaving(false);
    }
  }, [
    equipoPartModal,
    buildEquipoPartTasks,
    equipoPartSignatureTemp,
    equipoPartPdfGeneratedAt,
    setEquipoPartsVersion,
    refetchEquipoRows,
    closeEquipoPartEditor,
    showSuccess,
  ]);

  const handleGenerateEquipoPartPdf = useCallback(async (): Promise<void> => {
    if (!equipoPartModal) return;
    setEquipoPartPdfLoading(true);
    try {
      const tasks = buildEquipoPartTasks();
      if (!tasks || tasks.length === 0) {
        setEquipoPartError("No hay tareas válidas para incluir en el PDF.");
        return;
      }
      const nEmp = Array.from(new Set(tasks.map((t) => t.companyId))).length;
      const recordForPdf: WorkPartRecord = {
        id: equipoPartModal.entry.workReportId ?? equipoPartModal.entry.timeEntryId ?? `tmp-${Date.now()}`,
        workDate: equipoPartModal.workDate,
        workerId: equipoPartModal.workerId,
        entradaDisplay: formatTimeLocal(equipoPartModal.entry.checkInUtc),
        salidaDisplay: formatTimeLocal(equipoPartModal.entry.checkOutUtc),
        breakMinutes: equipoPartModal.entry.breakMinutes ?? 0,
        workedMinutes: Math.max(0, effectiveWorkMinutesEntry(equipoPartModal.entry) ?? 0),
        companyId: tasks[0].companyId,
        companyName: nEmp === 1 ? tasks[0].companyName : `Varias empresas (${nEmp})`,
        tasks,
        savedAtUtc: new Date().toISOString(),
        ...(equipoPartSignatureTemp ? { signaturePngDataUrl: equipoPartSignatureTemp } : {}),
      };
      let workerDisplayName = workerNameById(equipoPartModal.workerId);
      const uid = equipoPartModal.entry.userId?.trim();
      if (uid) {
        try {
          const u = await usersApi.getById(uid);
          workerDisplayName = (u.name ?? "").trim() || sessionDisplayNameFromEmail(u.email);
        } catch {
          /* mantener fallback numérico / mock */
        }
      }

      await downloadWorkPartPdf(recordForPdf, tasks, {
        workerDisplayName,
        companies: equipoPartCompanies,
      });
      setEquipoPartPdfGeneratedAt(new Date().toISOString());
      setEquipoPartError(null);
    } catch {
      setEquipoPartError("No se pudo generar el PDF. Inténtalo de nuevo.");
    } finally {
      setEquipoPartPdfLoading(false);
    }
  }, [equipoPartModal, buildEquipoPartTasks, equipoPartSignatureTemp, equipoPartCompanies]);

  return {
    equipoPartModal,
    equipoPartCompanies,
    equipoPartServices,
    equipoPartLines,
    equipoPartLoading,
    equipoPartSaving,
    equipoPartError,
    setEquipoPartError,
    equipoPartSignatureDialogOpen,
    setEquipoPartSignatureDialogOpen,
    equipoPartSignatureTemp,
    setEquipoPartSignatureTemp,
    equipoPartPdfLoading,
    openEquipoPartEditor,
    closeEquipoPartEditor,
    addEquipoPartLine,
    removeEquipoPartLine,
    patchEquipoPartLine,
    saveEquipoPart,
    handleGenerateEquipoPartPdf,
  };
}
