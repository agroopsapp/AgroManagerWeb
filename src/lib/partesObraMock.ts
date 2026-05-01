/**
 * Partes de obra (mock en localStorage). Sustituir por API.
 * Misma clave y formato que el antiguo `multiDayWorkReportsMock` para no perder datos.
 */

export type ParteObraEstado = "Open" | "Closed";

export type ParteObraMaterial = {
  name: string;
  /** Cantidad usada; número positivo (puede ser decimal). */
  quantity: number;
};

export interface ParteObra {
  id: string;
  title: string;
  notes: string;
  /** YYYY-MM-DD */
  plannedStartDate: string;
  /** YYYY-MM-DD o null = sin fecha fin hasta cierre manual. */
  plannedEndDate: string | null;
  /** Empresa cliente (`GET /api/ClientCompanies`), una sola. */
  clientCompanyId: string;
  materials: ParteObraMaterial[];
  status: ParteObraEstado;
  createdAtUtc: string;
  createdByEmail: string;
}

const STORAGE_KEY = "agromanager_multi_day_work_reports_v1";

function notifyChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("agromanager-partes-obra-changed"));
  window.dispatchEvent(new CustomEvent("agromanager-multiday-reports-changed"));
}

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

function parseMaterials(o: Record<string, unknown>): ParteObraMaterial[] {
  const raw = o.materials ?? o.Materials;
  if (!Array.isArray(raw)) return [];
  const out: ParteObraMaterial[] = [];
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

function parseStoredRow(x: unknown): ParteObra | null {
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

function readAll(): ParteObra[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.map(parseStoredRow).filter((x): x is ParteObra => x !== null);
  } catch {
    return [];
  }
}

function writeAll(list: ParteObra[]) {
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
  return `obra-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeMaterials(input: ParteObraMaterial[]): ParteObraMaterial[] {
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

/** Lista ordenada por fecha de creación (más reciente primero). */
export function readPartesObraMock(): ParteObra[] {
  return readAll().sort((a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime());
}

export function createParteObraMock(input: {
  title: string;
  notes: string;
  plannedStartDate: string;
  plannedEndDate: string | null;
  createdByEmail: string;
  clientCompanyId: string;
  materials: ParteObraMaterial[];
}): ParteObra {
  const cid = input.clientCompanyId.trim();
  const materials = normalizeMaterials(input.materials);
  const rec: ParteObra = {
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

export function closeParteObraMock(id: string): boolean {
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

export type ParteObraUpdatePatch = Partial<
  Pick<ParteObra, "title" | "notes" | "plannedStartDate" | "plannedEndDate" | "clientCompanyId" | "materials">
>;

export function updateParteObraMock(id: string, patch: ParteObraUpdatePatch): ParteObra | null {
  const list = readAll();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const prev = list[idx];
  const materials = patch.materials !== undefined ? normalizeMaterials(patch.materials) : prev.materials;
  let plannedEndDate = patch.plannedEndDate !== undefined ? patch.plannedEndDate : prev.plannedEndDate;
  if (plannedEndDate) plannedEndDate = plannedEndDate.slice(0, 10);
  const plannedStartDate =
    patch.plannedStartDate !== undefined ? patch.plannedStartDate.slice(0, 10) : prev.plannedStartDate;
  const title = patch.title !== undefined ? patch.title.trim() : prev.title;
  const notes = patch.notes !== undefined ? patch.notes.trim() : prev.notes;
  const clientCompanyId =
    patch.clientCompanyId !== undefined ? patch.clientCompanyId.trim() : prev.clientCompanyId;

  const next = [...list];
  next[idx] = {
    ...prev,
    title,
    notes,
    plannedStartDate,
    plannedEndDate,
    clientCompanyId,
    materials,
  };
  writeAll(next);
  notifyChanged();
  return next[idx];
}

export function deleteParteObraMock(id: string): boolean {
  const list = readAll();
  const next = list.filter((r) => r.id !== id);
  if (next.length === list.length) return false;
  writeAll(next);
  notifyChanged();
  return true;
}
