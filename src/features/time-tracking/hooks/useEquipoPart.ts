"use client";
import { useState } from "react";
import { customerCompanyMock } from "@/lib/customerCompanyMock";
import { workServicesMock } from "@/lib/workServicesMock";
import { downloadWorkPartPdf } from "@/lib/workPartPdf";
import {
  appendWorkPart,
  getTasksFromRecord,
  getWorkPartsForWorker,
  updateWorkPartSignature,
  updateWorkPartTasks,
  type WorkPartRecord,
  type WorkPartTask,
} from "@/lib/workPartsStorage";
import { diffDurationMinutes, formatTimeLocal } from "@/shared/utils/time";
import {
  effectiveWorkMinutesEntry,
} from "@/features/time-tracking/utils/formatters";
import { workerNameById } from "@/mocks/time-tracking.mock";
import type { TimeEntryMock } from "@/features/time-tracking/types";
import type { Company, WorkService } from "@/types";

interface Params {
  setEquipoPartsVersion: React.Dispatch<React.SetStateAction<number>>;
}

export function useEquipoPart({ setEquipoPartsVersion }: Params) {
  const [equipoPartModal, setEquipoPartModal] = useState<null | {
    workerId: number;
    workDate: string;
    entry: TimeEntryMock;
    existing: WorkPartRecord | null;
  }>(null);
  const [equipoPartCompanies, setEquipoPartCompanies] = useState<Company[]>([]);
  const [equipoPartServices, setEquipoPartServices] = useState<WorkService[]>([]);
  const [equipoPartLines, setEquipoPartLines] = useState<
    { lineId: string; companyId: string; serviceId: string; areaId: string }[]
  >([]);
  const [equipoPartLoading, setEquipoPartLoading] = useState(false);
  const [equipoPartSaving, setEquipoPartSaving] = useState(false);
  const [equipoPartError, setEquipoPartError] = useState<string | null>(null);
  const [equipoPartSignatureDialogOpen, setEquipoPartSignatureDialogOpen] = useState(false);
  const [equipoPartSignatureTemp, setEquipoPartSignatureTemp] = useState<string | null>(null);
  const [equipoPartPdfLoading, setEquipoPartPdfLoading] = useState(false);

  const openEquipoPartEditor = async (entry: TimeEntryMock) => {
    const existing =
      getWorkPartsForWorker(entry.workerId).find((p) => p.workDate === entry.workDate) ?? null;
    setEquipoPartModal({
      workerId: entry.workerId,
      workDate: entry.workDate,
      entry,
      existing,
    });
    setEquipoPartError(null);
    setEquipoPartSignatureTemp(existing?.signaturePngDataUrl ?? null);

    const tasks = existing ? getTasksFromRecord(existing) : [];
    const lid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ln-${Date.now()}`;
    setEquipoPartLines(
      tasks.length
        ? tasks.map((t, idx) => ({
            lineId: `ln-${idx}-${lid}`,
            companyId: t.companyId,
            serviceId: t.serviceId,
            areaId: t.areaId,
          }))
        : [{ lineId: lid, companyId: "", serviceId: "", areaId: "" }]
    );

    setEquipoPartLoading(true);
    try {
      const [c, s] = await Promise.all([customerCompanyMock.getAll(), workServicesMock.getAll()]);
      setEquipoPartCompanies(c);
      setEquipoPartServices(s);
    } catch {
      setEquipoPartCompanies([]);
      setEquipoPartServices([]);
      setEquipoPartError("No se pudieron cargar empresas o servicios.");
    } finally {
      setEquipoPartLoading(false);
    }
  };

  const closeEquipoPartEditor = () => {
    setEquipoPartModal(null);
    setEquipoPartLines([]);
    setEquipoPartCompanies([]);
    setEquipoPartServices([]);
    setEquipoPartLoading(false);
    setEquipoPartSaving(false);
    setEquipoPartError(null);
    setEquipoPartSignatureDialogOpen(false);
    setEquipoPartSignatureTemp(null);
  };

  const addEquipoPartLine = () => {
    setEquipoPartLines((prev) => {
      const last = prev[prev.length - 1];
      const fallback = equipoPartCompanies[0];
      const cid =
        last && equipoPartCompanies.some((x) => x.id === last.companyId)
          ? last.companyId
          : fallback?.id ?? "";
      const c = equipoPartCompanies.find((x) => x.id === cid) ?? fallback;
      const sid = equipoPartServices[0]?.id ?? "";
      const aid = c?.areas[0]?.id ?? "";
      const lid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `ln-${Date.now()}-${prev.length}`;
      return [...prev, { lineId: lid, companyId: cid, serviceId: sid, areaId: aid }];
    });
  };

  const removeEquipoPartLine = (lineId: string) => {
    setEquipoPartLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((l) => l.lineId !== lineId)
    );
  };

  const patchEquipoPartLine = (
    lineId: string,
    patch: Partial<{ companyId: string; serviceId: string; areaId: string }>
  ) => {
    setEquipoPartLines((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l))
    );
  };

  const buildEquipoPartTasks = (): WorkPartTask[] | null => {
    if (!equipoPartModal) return null;
    const tasks: WorkPartTask[] = [];
    for (const line of equipoPartLines) {
      const company = equipoPartCompanies.find((c) => c.id === line.companyId);
      if (!company || company.areas.length === 0) return null;
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
      });
    }
    return tasks;
  };

  const saveEquipoPart = () => {
    if (!equipoPartModal) return;
    const tasks = buildEquipoPartTasks();
    if (!tasks || tasks.length === 0) {
      setEquipoPartError("Revisa las tareas: empresa con área, servicio y área en todas las filas.");
      return;
    }
    setEquipoPartError(null);
    setEquipoPartSaving(true);
    try {
      const existing = equipoPartModal.existing;
      if (existing) {
        const ok = updateWorkPartTasks(existing.id, tasks);
        if (!ok) {
          setEquipoPartError("No se pudo guardar el parte.");
          return;
        }
        if (equipoPartSignatureTemp !== existing.signaturePngDataUrl) {
          updateWorkPartSignature(existing.id, equipoPartSignatureTemp);
        }
        closeEquipoPartEditor();
        return;
      }
      const companyKeys = Array.from(new Set(tasks.map((t) => t.companyId)));
      const headerCompanyName =
        companyKeys.length === 1
          ? tasks[0].companyName
          : `Varias empresas (${companyKeys.length})`;
      const nowIso = new Date().toISOString();
      const entradaDisplay = formatTimeLocal(equipoPartModal.entry.checkInUtc);
      const salidaDisplay = formatTimeLocal(equipoPartModal.entry.checkOutUtc);
      const breakMin = equipoPartModal.entry.breakMinutes ?? 0;
      const totalMinutes = diffDurationMinutes(
        equipoPartModal.entry.checkInUtc,
        equipoPartModal.entry.checkOutUtc
      );
      const workedMinutesCalc =
        totalMinutes === null ? 0 : Math.max(0, totalMinutes - breakMin);
      const partId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `wp-${Date.now()}`;
      appendWorkPart({
        id: partId,
        workDate: equipoPartModal.workDate,
        workerId: equipoPartModal.workerId,
        entradaDisplay,
        salidaDisplay,
        breakMinutes: breakMin,
        workedMinutes: workedMinutesCalc,
        companyId: tasks[0].companyId,
        companyName: headerCompanyName,
        tasks,
        savedAtUtc: nowIso,
        ...(equipoPartSignatureTemp ? { signaturePngDataUrl: equipoPartSignatureTemp } : {}),
      });
      setEquipoPartsVersion((v) => v + 1);
      closeEquipoPartEditor();
    } finally {
      setEquipoPartSaving(false);
    }
  };

  const handleGenerateEquipoPartPdf = async (): Promise<void> => {
    if (!equipoPartModal) return;
    setEquipoPartPdfLoading(true);
    try {
      const tasks =
        buildEquipoPartTasks() ??
        (equipoPartModal.existing
          ? getTasksFromRecord(equipoPartModal.existing)
          : null);
      if (!tasks || tasks.length === 0) {
        setEquipoPartError("No hay tareas válidas para incluir en el PDF.");
        return;
      }
      const nEmp = Array.from(new Set(tasks.map((t) => t.companyId))).length;
      const recordForPdf: WorkPartRecord = {
        id: equipoPartModal.existing?.id ?? `tmp-${Date.now()}`,
        workDate: equipoPartModal.workDate,
        workerId: equipoPartModal.workerId,
        entradaDisplay: formatTimeLocal(equipoPartModal.entry.checkInUtc),
        salidaDisplay: formatTimeLocal(equipoPartModal.entry.checkOutUtc),
        breakMinutes: equipoPartModal.entry.breakMinutes ?? 0,
        workedMinutes: Math.max(0, effectiveWorkMinutesEntry(equipoPartModal.entry) ?? 0),
        companyId: tasks[0].companyId,
        companyName: nEmp === 1 ? tasks[0].companyName : `Varias empresas (${nEmp})`,
        tasks,
        savedAtUtc: equipoPartModal.existing?.savedAtUtc ?? new Date().toISOString(),
        ...(equipoPartSignatureTemp ? { signaturePngDataUrl: equipoPartSignatureTemp } : {}),
      };
      await downloadWorkPartPdf(recordForPdf, tasks, {
        workerDisplayName: workerNameById(equipoPartModal.workerId),
        companies: equipoPartCompanies,
      });
      setEquipoPartError(null);
    } catch {
      setEquipoPartError("No se pudo generar el PDF. Inténtalo de nuevo.");
    } finally {
      setEquipoPartPdfLoading(false);
    }
  };

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
