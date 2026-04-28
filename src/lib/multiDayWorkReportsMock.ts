/**
 * Partes de trabajo multi-día (mock en localStorage).
 * Sustituir por API cuando exista el contenedor en backend.
 */

export type MultiDayWorkReportStatus = "Open" | "Closed";

export type MultiDayWorkReportMaterialMock = {
  name: string;
  /** Cantidad usada; número positivo (puede ser decimal). */
  quantity: number;
};

export interface MultiDayWorkReportMock {
  id: string;
  title: string;
  notes: string;
  /** YYYY-MM-DD */
  plannedStartDate: string;
  /** YYYY-MM-DD o null = sin fecha fin (sigue abierto en el tiempo hasta cierre manual). */
  plannedEndDate: string | null;
  /** Empresa cliente del tenant (`GET /api/ClientCompanies`), una sola. */
  clientCompanyId: string;
  /** Materiales usados a lo largo del trabajo (mock). */
  materials: MultiDayWorkReportMaterialMock[];
  status: MultiDayWorkReportStatus;
  createdAtUtc: string;
  createdByEmail: string;
}

const STORAGE_KEY = "agromanager_multi_day_work_reports_v1";

function notifyChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("agromanager-multiday-reports-changed"));
}

/** Compat: `clientCompanyId` nuevo; legado `clientCompanyIds[]` → primera id. */
function parseClientCompanyId(o: Record<string, unknown>): string {
  const single = o.clientCompanyId ?? o.ClientCompanyId;
  if (typeof single === "string" && single.trim()) return single.trim();
  const raw = o.clientCompanyIds ?? o.ClientCompanyIds;
  if (Array.isArray(raw)) {
    const first = raw.find((i): i is string => typeof i === "string" && i.trim() !== "");
    return first ? String(first).trim() : "";
  }
  return "";
}

function parseMaterials(o: Record<string, unknown>): MultiDayWorkReportMaterialMock[] {
  const raw = o.materials ?? o.Materials;
  if (!Array.isArray(raw)) return [];
  const out: MultiDayWorkReportMaterialMock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const name = typeof m.name === "string" ? m.name.trim() : "";
    const qtyRaw = m.quantity;
    const qty = typeof qtyRaw === "number" ? qtyRaw : Number.parseFloat(String(qtyRaw ?? ""));
    if (!name) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    out.push({ name, quantity: qty });
  }
  return out;
}

function parseStoredRow(x: unknown): MultiDayWorkReportMock | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  if (typeof o.title !== "string") return null;
  if (typeof o.notes !== "string") return null;
  if (typeof o.plannedStartDate !== "string") return null;
  if (o.plannedEndDate !== null && typeof o.plannedEndDate !== "string") return null;
  if (o.status !== "Open" && o.status !== "Closed") return null;
  if (typeof o.createdAtUtc !== "string") return null;
  if (typeof o.createdByEmail !== "string") return null;

  return {
    id: o.id.trim(),
    title: o.title,
    notes: o.notes,
    plannedStartDate: o.plannedStartDate,
    plannedEndDate: o.plannedEndDate === null || o.plannedEndDate === undefined ? null : String(o.plannedEndDate),
    clientCompanyId: parseClientCompanyId(o),
    materials: parseMaterials(o),
    status: o.status,
    createdAtUtc: o.createdAtUtc,
    createdByEmail: o.createdByEmail,
  };
}

function readAll(): MultiDayWorkReportMock[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.map(parseStoredRow).filter((x): x is MultiDayWorkReportMock => x !== null);
  } catch {
    return [];
  }
}

function writeAll(list: MultiDayWorkReportMock[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `md-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function readMultiDayWorkReportsMock(): MultiDayWorkReportMock[] {
  return readAll().sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());
}

export function createMultiDayWorkReportMock(input: {
  title: string;
  notes: string;
  plannedStartDate: string;
  plannedEndDate: string | null;
  createdByEmail: string;
  clientCompanyId: string;
  materials: MultiDayWorkReportMaterialMock[];
}): MultiDayWorkReportMock {
  const cid = input.clientCompanyId.trim();
  const materials = normalizeMaterials(input.materials);
  const rec: MultiDayWorkReportMock = {
    id: newId(),
    title: input.title.trim(),
    notes: input.notes.trim(),
    plannedStartDate: input.plannedStartDate.slice(0, 10),
    plannedEndDate: input.plannedEndDate ? input.plannedEndDate.slice(0, 10) : null,
    clientCompanyId: cid,
    materials,
    status: "Open",
    createdAtUtc: new Date().toISOString(),
    createdByEmail: input.createdByEmail.trim(),
  };
  const list = readAll();
  writeAll([rec, ...list]);
  notifyChanged();
  return rec;
}

function normalizeMaterials(input: MultiDayWorkReportMaterialMock[]): MultiDayWorkReportMaterialMock[] {
  const byName = new Map<string, number>();
  for (const m of input ?? []) {
    const name = (m?.name ?? "").trim();
    const qty = Number(m?.quantity ?? 0);
    if (!name) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    byName.set(name, (byName.get(name) ?? 0) + qty);
  }
  return Array.from(byName.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}

export function closeMultiDayWorkReportMock(id: string): boolean {
  const list = readAll();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return false;
  if (list[idx].status === "Closed") return false;
  const next = [...list];
  next[idx] = { ...next[idx], status: "Closed" };
  writeAll(next);
  notifyChanged();
  return true;
}
