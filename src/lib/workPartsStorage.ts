/**
 * Partes de trabajo declarados al fichar la salida (mock en localStorage).
 */

export type WorkPartTask = {
  companyId: string;
  companyName: string;
  serviceId: string;
  serviceName: string;
  areaId: string;
  areaName: string;
  areaObservations: string;
};

export type WorkPartRecord = {
  id: string;
  workDate: string;
  workerId: number;
  /** HH:mm hora local mostrada */
  entradaDisplay: string;
  salidaDisplay: string;
  breakMinutes: number;
  workedMinutes: number;
  companyId: string;
  companyName: string;
  /** Una o varias tareas (servicio + área) en la misma jornada. */
  tasks: WorkPartTask[];
  savedAtUtc: string;
  /** Registros antiguos (una sola tarea en campos planos). */
  serviceId?: string;
  serviceName?: string;
  areaId?: string;
  areaName?: string;
  areaObservations?: string;
  /** Firma en PNG (data URL) capturada en el detalle del parte. */
  signaturePngDataUrl?: string;
};

const KEY = "agromanager_work_parts_v1";

/** Normaliza registros guardados antes de `tasks[]`. */
export function getTasksFromRecord(r: WorkPartRecord): WorkPartTask[] {
  if (Array.isArray(r.tasks) && r.tasks.length > 0) {
    return r.tasks.map((t) => ({
      companyId: t.companyId ?? r.companyId,
      companyName: t.companyName ?? r.companyName,
      serviceId: t.serviceId,
      serviceName: t.serviceName ?? "",
      areaId: t.areaId,
      areaName: t.areaName ?? "",
      areaObservations: t.areaObservations ?? "",
    }));
  }
  if (r.serviceId && r.areaId) {
    return [
      {
        companyId: r.companyId,
        companyName: r.companyName,
        serviceId: r.serviceId,
        serviceName: r.serviceName ?? "",
        areaId: r.areaId,
        areaName: r.areaName ?? "",
        areaObservations: r.areaObservations ?? "",
      },
    ];
  }
  return [];
}

function readAll(): WorkPartRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter(
      (x) =>
        x &&
        typeof x === "object" &&
        typeof (x as WorkPartRecord).id === "string" &&
        typeof (x as WorkPartRecord).workDate === "string"
    ) as WorkPartRecord[];
  } catch {
    return [];
  }
}

function writeAll(list: WorkPartRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

function notifyWorkPartsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("agromanager-workparts-changed"));
}

export function appendWorkPart(record: WorkPartRecord): void {
  const list = readAll();
  writeAll([record, ...list]);
  notifyWorkPartsChanged();
}

/** Partes de un trabajador, más recientes primero. */
export function getWorkPartsForWorker(workerId: number): WorkPartRecord[] {
  return readAll()
    .filter((r) => r.workerId === workerId)
    .sort(
      (a, b) =>
        new Date(b.savedAtUtc).getTime() - new Date(a.savedAtUtc).getTime()
    );
}

/**
 * Actualiza solo las tareas de un parte. No modifica horas ni fecha del fichaje.
 * Devuelve false si no existe el parte o si `tasks` está vacío.
 */
export function updateWorkPartTasks(
  recordId: string,
  tasks: WorkPartTask[]
): boolean {
  if (tasks.length === 0) return false;
  const list = readAll();
  const idx = list.findIndex((r) => r.id === recordId);
  if (idx < 0) return false;
  const prev = list[idx];
  const companyKeys = Array.from(new Set(tasks.map((t) => t.companyId)));
  const headerCompanyName =
    companyKeys.length === 1
      ? tasks[0].companyName
      : `Varias empresas (${companyKeys.length})`;
  const next: WorkPartRecord = {
    id: prev.id,
    workDate: prev.workDate,
    workerId: prev.workerId,
    entradaDisplay: prev.entradaDisplay,
    salidaDisplay: prev.salidaDisplay,
    breakMinutes: prev.breakMinutes,
    workedMinutes: prev.workedMinutes,
    companyId: tasks[0].companyId,
    companyName: headerCompanyName,
    tasks,
    savedAtUtc: prev.savedAtUtc,
  };
  if (prev.signaturePngDataUrl) {
    next.signaturePngDataUrl = prev.signaturePngDataUrl;
  }
  const copy = [...list];
  copy[idx] = next;
  writeAll(copy);
  notifyWorkPartsChanged();
  return true;
}

/**
 * Guarda o borra la firma (PNG data URL) de un parte. No modifica tareas ni horas.
 */
export function updateWorkPartSignature(
  recordId: string,
  signaturePngDataUrl: string | null
): boolean {
  const list = readAll();
  const idx = list.findIndex((r) => r.id === recordId);
  if (idx < 0) return false;
  const prev = list[idx];
  const next: WorkPartRecord = { ...prev };
  if (signaturePngDataUrl && signaturePngDataUrl.length > 0) {
    next.signaturePngDataUrl = signaturePngDataUrl;
  } else {
    delete next.signaturePngDataUrl;
  }
  const copy = [...list];
  copy[idx] = next;
  writeAll(copy);
  notifyWorkPartsChanged();
  return true;
}

export function getWorkPartsForDemo(): WorkPartRecord[] {
  return readAll();
}
