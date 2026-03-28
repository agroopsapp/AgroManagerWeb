import type { WorkService } from "@/types";

const STORAGE_KEY = "agromanager_work_services_mock_v1";

const DEMO: WorkService[] = [
  {
    id: "svc-pesticida",
    name: "Pesticida",
    description: "Aplicación de tratamientos fitosanitarios conforme a boletín oficial y normativa vigente.",
  },
  {
    id: "svc-picar",
    name: "Picar",
    description: "Laboreo, picado de rastrojos o preparación de suelo con maquinaria adecuada.",
  },
  {
    id: "svc-sembrar",
    name: "Sembrar",
    description: "Siembra mecánica o asistida de cereal, olivar, viñedo u otros cultivos.",
  },
  {
    id: "svc-recolectar",
    name: "Recolectar",
    description: "Recolección mecanizada o manual de cosecha en ventana óptima de madurez.",
  },
];

function coerceRow(raw: unknown): WorkService | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = o.id != null ? String(o.id) : "";
  const name = o.name != null ? String(o.name) : "";
  if (!id || !name) return null;
  return {
    id,
    name,
    description: o.description != null ? String(o.description) : "",
  };
}

function readList(): WorkService[] {
  if (typeof window === "undefined") return DEMO.map((r) => ({ ...r }));
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = DEMO.map((r) => ({ ...r }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEMO.map((r) => ({ ...r }));
    return parsed.map(coerceRow).filter((x): x is WorkService => x !== null);
  } catch {
    return DEMO.map((r) => ({ ...r }));
  }
}

function writeList(list: WorkService[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

export const workServicesMock = {
  getAll(): Promise<WorkService[]> {
    return Promise.resolve(readList());
  },

  getById(id: string): Promise<WorkService> {
    const row = readList().find((x) => x.id === id);
    if (!row) return Promise.reject(new Error("Servicio no encontrado."));
    return Promise.resolve({ ...row });
  },

  create(body: Omit<WorkService, "id">): Promise<WorkService> {
    const list = readList();
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `svc-${crypto.randomUUID()}`
        : `svc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const row: WorkService = {
      id,
      name: body.name,
      description: body.description ?? "",
    };
    writeList([row, ...list]);
    return Promise.resolve({ ...row });
  },

  update(id: string, body: Partial<WorkService>): Promise<WorkService> {
    const list = readList();
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return Promise.reject(new Error("Servicio no encontrado."));
    const next: WorkService = {
      ...list[i],
      ...body,
      id,
    };
    list[i] = next;
    writeList(list);
    return Promise.resolve({ ...next });
  },

  delete(id: string): Promise<void> {
    writeList(readList().filter((x) => x.id !== id));
    return Promise.resolve();
  },
};
