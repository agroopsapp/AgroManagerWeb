"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { MockBadge } from "@/components/MockBadge";
import {
  closeParteObraMock,
  createParteObraMock,
  deleteParteObraMock,
  readPartesObraMock,
  updateParteObraMock,
  type ParteObra,
} from "@/lib/partesObraMock";
import { MODAL_BACKDROP_CENTER, modalScrollablePanel } from "@/components/modalShell";
import { companiesApi } from "@/services";
import type { Company } from "@/types";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";

const cardSurfaceClass =
  "rounded-2xl border border-slate-200/65 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-700/75 dark:bg-slate-900/45 dark:shadow-none";

const labelClass =
  "text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-agro-500 focus:ring-1 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100";

type MaterialDraft = { id: string; name: string; quantity: string };

type AvailableMaterial = { id: string; name: string };

const AVAILABLE_MATERIALS_MOCK: AvailableMaterial[] = [
  { id: "mat-1", name: "Cemento" },
  { id: "mat-2", name: "Arena" },
  { id: "mat-3", name: "Grava" },
  { id: "mat-4", name: "Tornillos" },
  { id: "mat-5", name: "Clavos" },
  { id: "mat-6", name: "Gasóleo" },
  { id: "mat-7", name: "Pintura" },
  { id: "mat-8", name: "Madera" },
] as const;

function formatDateEs(iso: string) {
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTimeEs(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function companyDisplayName(id: string, nameById: Map<string, string>): string {
  if (!id.trim()) return "—";
  return nameById.get(id) ?? id;
}

function materialSummary(materials: { name: string; quantity: number }[]): string {
  if (!Array.isArray(materials) || materials.length === 0) return "—";
  const parts = materials.slice(0, 3).map((m) => `${m.name} (${m.quantity})`);
  const suffix = materials.length > 3 ? ` +${materials.length - 3}` : "";
  return `${parts.join(", ")}${suffix}`;
}

/** Solape entre filtro [from,to] y fila; si la fila no tiene fin, se considera abierta hasta fecha lejana. */
function rowOverlapsFilter(
  rowStart: string,
  rowEnd: string | null,
  filterFrom: string,
  filterTo: string,
): boolean {
  const rs = rowStart.slice(0, 10);
  const re = rowEnd ? rowEnd.slice(0, 10) : "2099-12-31";
  const ff = filterFrom.slice(0, 10);
  const ft = filterTo.slice(0, 10);
  return rs <= ft && re >= ff;
}

export default function PartesObraPage() {
  const { user, isReady } = useAuth();
  const [rows, setRows] = useState<ParteObra[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState("");
  const [selectedClientCompanyId, setSelectedClientCompanyId] = useState("");
  const [clientCompanies, setClientCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialDraft[]>([]);
  const [materialsModalOpen, setMaterialsModalOpen] = useState(false);
  const [materialsModalSelected, setMaterialsModalSelected] = useState<MaterialDraft[]>([]);
  const [materialsModalQuery, setMaterialsModalQuery] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [filterStatus, setFilterStatus] = useState<"" | ParteObra["status"]>("");
  const [filterCompanyId, setFilterCompanyId] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [createEditModalOpen, setCreateEditModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientCompanies) {
      if (c.id) m.set(c.id, (c.name ?? "").trim() || c.id);
    }
    return m;
  }, [clientCompanies]);

  const sync = useCallback(() => {
    setRows(readPartesObraMock());
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("agromanager-partes-obra-changed", sync);
    window.addEventListener("agromanager-multiday-reports-changed", sync);
    return () => {
      window.removeEventListener("agromanager-partes-obra-changed", sync);
      window.removeEventListener("agromanager-multiday-reports-changed", sync);
    };
  }, [sync]);

  useEffect(() => {
    if (!isReady || !user) return;
    const ac = new AbortController();
    setCompaniesLoading(true);
    setCompaniesError(null);
    companiesApi
      .getAll()
      .then((list) => {
        if (ac.signal.aborted) return;
        const sorted = [...list].sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? "", "es", { sensitivity: "base" }),
        );
        setClientCompanies(sorted);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setCompaniesError(userVisibleMessageFromUnknown(e, "No se pudieron cargar las empresas cliente."));
        setClientCompanies([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setCompaniesLoading(false);
      });
    return () => ac.abort();
  }, [isReady, user]);

  const openCount = useMemo(() => rows.filter((r) => r.status === "Open").length, [rows]);

  const filteredRows = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    let from = filterDateFrom.trim().slice(0, 10);
    let to = filterDateTo.trim().slice(0, 10);
    if (from && to && from > to) [from, to] = [to, from];
    const useDates = Boolean(from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to));

    return rows.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterCompanyId.trim() && r.clientCompanyId !== filterCompanyId.trim()) return false;
      if (q) {
        const hay = `${r.title}\n${r.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (useDates && !rowOverlapsFilter(r.plannedStartDate, r.plannedEndDate, from, to)) return false;
      return true;
    });
  }, [rows, filterStatus, filterCompanyId, filterSearch, filterDateFrom, filterDateTo]);

  const resetFormDraft = useCallback(() => {
    setTitle("");
    setNotes("");
    setStart(new Date().toISOString().slice(0, 10));
    setEnd("");
    setSelectedClientCompanyId("");
    setMaterials([]);
    setFormError(null);
  }, []);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    resetFormDraft();
    setCreateEditModalOpen(true);
  };

  const openEditModal = (row: ParteObra) => {
    setModalMode("edit");
    setEditingId(row.id);
    setTitle(row.title);
    setNotes(row.notes);
    setStart(row.plannedStartDate.slice(0, 10));
    setEnd(row.plannedEndDate ? row.plannedEndDate.slice(0, 10) : "");
    setSelectedClientCompanyId(row.clientCompanyId);
    setMaterials(
      row.materials.map((m, i) => ({
        id: `edit-mat-${i}-${m.name}`,
        name: m.name,
        quantity: String(m.quantity),
      })),
    );
    setFormError(null);
    setCreateEditModalOpen(true);
  };

  const closeCreateEditModal = () => {
    setCreateEditModalOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  const openMaterialsModal = () => {
    setMaterialsModalSelected(materials);
    setMaterialsModalQuery("");
    setMaterialsModalOpen(true);
  };

  const closeMaterialsModal = () => {
    setMaterialsModalOpen(false);
    setMaterialsModalQuery("");
  };

  const acceptMaterialsModal = () => {
    setMaterials(materialsModalSelected);
    setMaterialsModalOpen(false);
    setMaterialsModalQuery("");
  };

  const addFromAvailable = (m: AvailableMaterial) => {
    setMaterialsModalSelected((prev) => {
      const existing = prev.find((x) => x.id === m.id);
      if (existing) return prev;
      return [...prev, { id: m.id, name: m.name, quantity: "1" }];
    });
  };

  const removeFromSelected = (id: string) => {
    setMaterialsModalSelected((prev) => prev.filter((m) => m.id !== id));
  };

  const updateSelectedQty = (id: string, qty: string) => {
    setMaterialsModalSelected((prev) =>
      prev.map((m) => (m.id === id ? { ...m, quantity: qty } : m)),
    );
  };

  const availableFiltered = useMemo(() => {
    const q = materialsModalQuery.trim().toLowerCase();
    const selected = new Set(materialsModalSelected.map((m) => m.id));
    return AVAILABLE_MATERIALS_MOCK.filter((m) => {
      if (selected.has(m.id)) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q);
    });
  }, [materialsModalQuery, materialsModalSelected]);

  const validateAndParseBody = (): {
    title: string;
    notes: string;
    startIso: string;
    endVal: string | null;
    clientCompanyId: string;
    mats: { name: string; quantity: number }[];
  } | null => {
    const t = title.trim();
    if (!t) {
      setFormError("El título es obligatorio.");
      return null;
    }
    if (!selectedClientCompanyId.trim()) {
      setFormError("Selecciona una empresa cliente.");
      return null;
    }
    const startIso = start.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso)) {
      setFormError("Fecha de inicio no válida.");
      return null;
    }
    let endVal: string | null = null;
    if (end.trim()) {
      const eIso = end.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eIso)) {
        setFormError("Fecha de fin no válida.");
        return null;
      }
      if (eIso < startIso) {
        setFormError("La fecha de fin no puede ser anterior al inicio.");
        return null;
      }
      endVal = eIso;
    }
    const mats = materials
      .map((m) => ({
        name: m.name.trim(),
        quantity: Number.parseFloat(String(m.quantity).replace(",", ".")),
      }))
      .filter((m) => m.name && Number.isFinite(m.quantity) && m.quantity > 0);
    return {
      title: t,
      notes: notes.trim(),
      startIso,
      endVal,
      clientCompanyId: selectedClientCompanyId.trim(),
      mats,
    };
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!user?.email) {
      setFormError("No hay usuario en sesión.");
      return;
    }
    const body = validateAndParseBody();
    if (!body) return;

    setSaving(true);
    try {
      if (modalMode === "create") {
        createParteObraMock({
          title: body.title,
          notes: body.notes,
          plannedStartDate: body.startIso,
          plannedEndDate: body.endVal,
          createdByEmail: user.email,
          clientCompanyId: body.clientCompanyId,
          materials: body.mats,
        });
        resetFormDraft();
        closeCreateEditModal();
      } else if (modalMode === "edit" && editingId) {
        updateParteObraMock(editingId, {
          title: body.title,
          notes: body.notes,
          plannedStartDate: body.startIso,
          plannedEndDate: body.endVal,
          clientCompanyId: body.clientCompanyId,
          materials: body.mats,
        });
        closeCreateEditModal();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = (id: string) => {
    closeParteObraMock(id);
  };

  const handleDeleteRow = (id: string, titleRow: string) => {
    const ok = window.confirm(
      `¿Eliminar el parte de obra «${titleRow}»? Esta acción no se puede deshacer (demo local).`,
    );
    if (!ok) return;
    deleteParteObraMock(id);
  };

  if (!isReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-agro-500 border-t-transparent" />
      </div>
    );
  }

  const compactSelectClass =
    "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm outline-none focus:border-agro-500 focus:ring-1 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-agro-600 dark:text-agro-400">
              Jornada
            </p>
            <MockBadge />
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Partes de obra</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Partes de obra en rejilla con filtros; pueden abarcar varios días. Crear abre el formulario en una ventana.
            Persistencia demo en <span className="font-mono text-xs">localStorage</span>; empresas desde{" "}
            <span className="font-mono text-xs">GET /api/ClientCompanies</span>.
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
            Abiertos: <span className="font-semibold text-slate-700 dark:text-slate-300">{openCount}</span>
            {" · "}
            Mostrando <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredRows.length}</span> de{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{rows.length}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl bg-agro-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-agro-700"
          >
            Crear parte de obra
          </button>
          <Link
            href="/dashboard/time-tracking"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Volver al fichador
          </Link>
        </div>
      </div>

      <div className={`${cardSurfaceClass} p-4 md:p-5`}>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Filtros</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Estado</span>
            <select
              className={compactSelectClass}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            >
              <option value="">Todos</option>
              <option value="Open">Abierto</option>
              <option value="Closed">Cerrado</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelClass}>Empresa cliente</span>
            <select
              className={compactSelectClass}
              value={filterCompanyId}
              onChange={(e) => setFilterCompanyId(e.target.value)}
              disabled={companiesLoading || clientCompanies.length === 0}
            >
              <option value="">Todas</option>
              {clientCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.name ?? "").trim() || c.id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
            <span className={labelClass}>Buscar</span>
            <input
              className={compactSelectClass}
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Título o notas…"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Solapan desde</span>
            <input
              type="date"
              className={compactSelectClass}
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Solapan hasta</span>
            <input
              type="date"
              className={compactSelectClass}
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          El filtro de fechas muestra partes cuyo periodo solapa el rango (inicio–fin o abierto hasta el cierre).
        </p>
      </div>

      {createEditModalOpen ? (
        <div
          className={`fixed inset-0 z-50 ${MODAL_BACKDROP_CENTER}`}
          onClick={() => !saving && closeCreateEditModal()}
        >
          <div
            className={modalScrollablePanel("lg")}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={modalMode === "create" ? "Crear parte de obra" : "Editar parte de obra"}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-700/80">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Parte de obra
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {modalMode === "create" ? "Nuevo parte de obra" : "Editar parte de obra"}
                </h2>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={closeCreateEditModal}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleModalSubmit}>
          <div>
            <label htmlFor="md-title" className={labelClass}>
              Título
            </label>
            <input
              id="md-title"
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Obra cubierta nave 2"
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="md-client-company" className={labelClass}>
              Empresa cliente
            </label>
            {companiesLoading ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Cargando empresas…</p>
            ) : companiesError ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{companiesError}</p>
            ) : clientCompanies.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                No hay empresas cliente en el tenant. Comprueba el API o da de alta clientes en Empresas.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Una empresa cliente por parte de obra (lista del tenant vía API).
                </p>
                <select
                  id="md-client-company"
                  className={inputClass}
                  value={selectedClientCompanyId}
                  onChange={(e) => setSelectedClientCompanyId(e.target.value)}
                >
                  <option value="">— Elige empresa —</option>
                  {clientCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.name ?? "").trim() || c.id}
                      {c.taxId ? ` · ${c.taxId}` : ""}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
          <div>
            <label htmlFor="md-notes" className={labelClass}>
              Notas (opcional)
            </label>
            <textarea
              id="md-notes"
              className={`${inputClass} min-h-[88px] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descripción breve del alcance…"
              maxLength={2000}
            />
          </div>
          <div>
            <p className={labelClass}>Materiales (mock)</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Selecciona materiales disponibles y ajusta cantidad usada. Se guardará en este parte de obra.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openMaterialsModal}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Seleccionar materiales
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Seleccionados: <span className="font-semibold">{materials.length}</span>
              </p>
            </div>
            {materials.length > 0 ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-600 dark:bg-slate-800/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Materiales añadidos
                </p>
                <ul className="mt-2 space-y-2">
                  {materials.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {m.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Cantidad: <span className="font-semibold">{m.quantity}</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="md-start" className={labelClass}>
                Fecha inicio
              </label>
              <input
                id="md-start"
                type="date"
                className={inputClass}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="md-end" className={labelClass}>
                Fecha fin (opcional)
              </label>
              <input
                id="md-end"
                type="date"
                className={inputClass}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                Vacío = sin fecha fin hasta que cierres el parte desde la tabla.
              </p>
            </div>
          </div>
              {formError ? <p className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-700/80">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeCreateEditModal}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    saving ||
                    companiesLoading ||
                    !!companiesError ||
                    clientCompanies.length === 0 ||
                    !selectedClientCompanyId.trim()
                  }
                  className="rounded-xl bg-agro-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-agro-700 disabled:opacity-60"
                >
                  {saving
                    ? "Guardando…"
                    : modalMode === "create"
                      ? "Crear parte de obra"
                      : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {materialsModalOpen && (
        <div className={`fixed inset-0 z-[60] ${MODAL_BACKDROP_CENTER}`} onClick={closeMaterialsModal}>
          <div
            className={modalScrollablePanel("xl")}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Seleccionar materiales"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Materiales
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Seleccionar materiales
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Abajo tienes los materiales disponibles. Al pulsar uno, sube a la lista de seleccionados (arriba).
                </p>
              </div>
              <button
                type="button"
                onClick={closeMaterialsModal}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Cerrar"
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-slate-600 dark:bg-slate-950/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Seleccionados
                </p>
                {materialsModalSelected.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Aún no has seleccionado materiales.
                  </p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="py-2 pr-3">Material</th>
                          <th className="py-2 pr-3 w-28">Cantidad</th>
                          <th className="py-2 w-10 text-right">—</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                        {materialsModalSelected.map((m) => (
                          <tr key={m.id}>
                            <td className="py-2 pr-3">
                              <span className="font-medium text-slate-800 dark:text-slate-100">
                                {m.name}
                              </span>
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                inputMode="decimal"
                                className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-agro-500 focus:ring-1 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                value={m.quantity}
                                onChange={(e) => updateSelectedQty(m.id, e.target.value)}
                                aria-label={`Cantidad de ${m.name}`}
                              />
                            </td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeFromSelected(m.id)}
                                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                aria-label={`Quitar ${m.name}`}
                                title="Quitar"
                              >
                                Quitar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-slate-600 dark:bg-slate-950/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Disponibles
                </p>
                <div className="mt-2">
                  <label className="sr-only" htmlFor="md-mat-search">
                    Buscar material
                  </label>
                  <input
                    id="md-mat-search"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-agro-500 focus:ring-1 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    value={materialsModalQuery}
                    onChange={(e) => setMaterialsModalQuery(e.target.value)}
                    placeholder="Buscar…"
                  />
                </div>
                {availableFiltered.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    No hay materiales disponibles con ese filtro (o ya están seleccionados).
                  </p>
                ) : (
                  <div className="mt-3 max-h-80 overflow-y-auto pr-1">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="py-2 pr-3">Material</th>
                          <th className="py-2 w-24 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                        {availableFiltered.map((m) => (
                          <tr key={m.id}>
                            <td className="py-2 pr-3">
                              <span className="text-slate-800 dark:text-slate-100">{m.name}</span>
                            </td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={() => addFromAvailable(m)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                Añadir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeMaterialsModal}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={acceptMaterialsModal}
                className="rounded-xl bg-agro-600 px-4 py-2 text-sm font-semibold text-white hover:bg-agro-700"
              >
                Aceptar materiales
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`${cardSurfaceClass} overflow-hidden`}>
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-700/80">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Registro de partes</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Editar o eliminar filas; «Cerrar» marca el parte como cerrado sin borrarlo.
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Aún no hay partes. Pulsa <span className="font-semibold">Crear parte de obra</span> para abrir el
            formulario.
          </p>
        ) : filteredRows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Ningún parte coincide con los filtros. Ajusta estado, empresa o fechas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3 hidden md:table-cell max-w-[14rem]">Empresa cliente</th>
                  <th className="px-4 py-3 hidden lg:table-cell max-w-[18rem]">Materiales</th>
                  <th className="px-4 py-3">Inicio</th>
                  <th className="px-4 py-3">Fin</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Creado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/80">
                {filteredRows.map((r) => (
                  <tr
                    key={r.id}
                    className={
                      r.status === "Closed"
                        ? "bg-slate-50/80 text-slate-500 dark:bg-slate-900/30 dark:text-slate-500"
                        : "text-slate-800 dark:text-slate-100"
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.title}</div>
                      {r.notes ? (
                        <div className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{r.notes}</div>
                      ) : null}
                      <div className="mt-1 font-mono text-[10px] text-slate-400 dark:text-slate-500">{r.id}</div>
                      <div className="mt-2 text-xs text-slate-600 md:hidden dark:text-slate-300">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">Empresa: </span>
                        <span title={companyDisplayName(r.clientCompanyId, nameById)}>
                          {companyDisplayName(r.clientCompanyId, nameById)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600 lg:hidden dark:text-slate-300">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">Materiales: </span>
                        <span title={materialSummary(r.materials ?? [])}>
                          {materialSummary(r.materials ?? [])}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-xs text-slate-600 hidden md:table-cell max-w-[14rem] dark:text-slate-300"
                      title={companyDisplayName(r.clientCompanyId, nameById)}
                    >
                      {companyDisplayName(r.clientCompanyId, nameById)}
                    </td>
                    <td
                      className="px-4 py-3 text-xs text-slate-600 hidden lg:table-cell max-w-[18rem] dark:text-slate-300"
                      title={materialSummary(r.materials ?? [])}
                    >
                      {materialSummary(r.materials ?? [])}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateEs(r.plannedStartDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.plannedEndDate ? formatDateEs(r.plannedEndDate) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={
                          r.status === "Open"
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : "rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        }
                      >
                        {r.status === "Open" ? "Abierto" : "Cerrado"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell whitespace-nowrap">
                      {formatDateTimeEs(r.createdAtUtc)}
                      <div className="mt-0.5 truncate max-w-[10rem]" title={r.createdByEmail}>
                        {r.createdByEmail}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(r)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(r.id, r.title)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/55"
                        >
                          Eliminar
                        </button>
                        {r.status === "Open" ? (
                          <button
                            type="button"
                            onClick={() => handleClose(r.id)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            Cerrar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
