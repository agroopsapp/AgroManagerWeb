"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { MODAL_BACKDROP_CENTER, modalScrollablePanel } from "@/components/modalShell";
import type { Material } from "@/features/materials/types";
import type { MultiDayWorkReportDto, MultiDayWorkReportStatus } from "@/features/multi-day-work-reports/types";
import { companiesApi, getCompaniesFromApi, materialsApi, multiDayWorkReportsApi } from "@/services";
import type { Company } from "@/types";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";
import { localTodayISO } from "@/shared/utils/time";
import { DashboardHoyPageHero, DashboardPageShell, FichajeJornadaMainPanel } from "@/components/dashboard-page";

const labelClass =
  "text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-agro-500 focus:ring-1 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100";

type MaterialDraft = { id: string; name: string; quantity: string; lineId?: string };

/** Fila de tabla: datos del API + materiales resueltos para resumen. */
type ParteObraRow = {
  id: string;
  companyId: string;
  clientCompanyId: string;
  title: string;
  notes: string;
  plannedStartDate: string;
  plannedEndDate: string | null;
  materials: { name: string; quantity: number }[];
  status: MultiDayWorkReportStatus;
  createdAtUtc: string;
};

function mapDtoToReportRow(
  d: MultiDayWorkReportDto,
  materials: { name: string; quantity: number }[],
): ParteObraRow {
  return {
    id: d.id,
    companyId: d.companyId,
    clientCompanyId: d.clientCompanyId,
    title: d.title,
    notes: d.notes,
    plannedStartDate: d.startDate.slice(0, 10),
    plannedEndDate: d.endDate,
    materials,
    status: d.status,
    createdAtUtc: d.createdAt,
  };
}

/** Alinea líneas del API con el borrador del formulario (POST / PUT / DELETE). */
async function syncMultiDayReportMaterials(
  reportId: string,
  drafts: MaterialDraft[],
  signal: AbortSignal,
): Promise<void> {
  const parsed = drafts
    .map((d) => ({
      materialId: d.id.trim(),
      lineId: d.lineId,
      quantity: Number.parseFloat(String(d.quantity).replace(",", ".")),
    }))
    .filter((x) => x.materialId && Number.isFinite(x.quantity) && x.quantity > 0);

  const existing = await multiDayWorkReportsApi.getMaterials(reportId, { signal });
  const usedLineIds = new Set<string>();

  for (const d of parsed) {
    const ex = d.lineId
      ? existing.find((e) => e.id === d.lineId)
      : existing.find((e) => e.materialId === d.materialId && !usedLineIds.has(e.id));
    if (ex) {
      usedLineIds.add(ex.id);
      if (Math.abs(ex.quantity - d.quantity) > 1e-9) {
        await multiDayWorkReportsApi.updateMaterialQuantity(
          reportId,
          ex.id,
          { quantity: d.quantity },
          { signal },
        );
      }
    } else {
      await multiDayWorkReportsApi.addMaterial(
        reportId,
        { materialId: d.materialId, quantity: d.quantity },
        { signal },
      );
    }
  }
  for (const ex of existing) {
    if (!usedLineIds.has(ex.id)) {
      await multiDayWorkReportsApi.deleteMaterialLine(reportId, ex.id, { signal });
    }
  }
}

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
  const [rows, setRows] = useState<ParteObraRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editFetchError, setEditFetchError] = useState<string | null>(null);
  /** Incrementar para volver a cargar la tabla tras crear/editar/borrar/cerrar. */
  const [listRevision, setListRevision] = useState(0);
  const bumpList = useCallback(() => setListRevision((n) => n + 1), []);
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
  const [tenantCompanyId, setTenantCompanyId] = useState<string | null>(null);
  const [materialsCatalog, setMaterialsCatalog] = useState<Material[]>([]);
  const [materialsCatalogLoading, setMaterialsCatalogLoading] = useState(false);
  const [materialsCatalogError, setMaterialsCatalogError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [filterStatus, setFilterStatus] = useState<"" | MultiDayWorkReportStatus>("");
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

  useEffect(() => {
    if (!isReady || !user || !tenantCompanyId?.trim()) {
      setRows([]);
      setRowsLoading(false);
      setRowsError(null);
      return;
    }
    const ac = new AbortController();
    const cid = tenantCompanyId.trim();
    setRowsLoading(true);
    setRowsError(null);
    (async () => {
      try {
        const [reports, catalog] = await Promise.all([
          multiDayWorkReportsApi.getAll({ signal: ac.signal, companyId: cid }),
          materialsApi.getAll({ signal: ac.signal, companyId: cid }),
        ]);
        if (ac.signal.aborted) return;
        const matName = new Map(catalog.map((m) => [m.id, m.name]));
        const withMaterials = await Promise.all(
          reports.map(async (r) => {
            const lines = await multiDayWorkReportsApi.getMaterials(r.id, { signal: ac.signal });
            if (ac.signal.aborted) {
              return mapDtoToReportRow(r, []);
            }
            const materials = lines.map((l) => ({
              name: (matName.get(l.materialId) ?? l.materialId).trim() || l.materialId,
              quantity: l.quantity,
            }));
            return mapDtoToReportRow(r, materials);
          }),
        );
        if (ac.signal.aborted) return;
        withMaterials.sort(
          (a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime(),
        );
        setRows(withMaterials);
      } catch (e) {
        if (ac.signal.aborted) return;
        setRows([]);
        setRowsError(userVisibleMessageFromUnknown(e, "No se pudieron cargar los partes de obra."));
      } finally {
        if (!ac.signal.aborted) setRowsLoading(false);
      }
    })();
    return () => ac.abort();
  }, [isReady, user, tenantCompanyId, listRevision]);

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

  useEffect(() => {
    if (!isReady || !user) return;
    const ac = new AbortController();
    getCompaniesFromApi({ signal: ac.signal })
      .then((list) => {
        if (ac.signal.aborted) return;
        const id = list[0]?.id?.trim() ?? "";
        setTenantCompanyId(id || null);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setTenantCompanyId(null);
      });
    return () => ac.abort();
  }, [isReady, user]);

  useEffect(() => {
    if (!materialsModalOpen || !isReady || !user) return;
    const ac = new AbortController();
    setMaterialsCatalogLoading(true);
    setMaterialsCatalogError(null);
    materialsApi
      .getAll({
        signal: ac.signal,
        companyId: tenantCompanyId?.trim() || undefined,
      })
      .then((list) => {
        if (ac.signal.aborted) return;
        setMaterialsCatalog(list ?? []);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setMaterialsCatalog([]);
        setMaterialsCatalogError(
          userVisibleMessageFromUnknown(e, "No se pudieron cargar los materiales."),
        );
      })
      .finally(() => {
        if (!ac.signal.aborted) setMaterialsCatalogLoading(false);
      });
    return () => ac.abort();
  }, [materialsModalOpen, tenantCompanyId, isReady, user]);

  const openCount = useMemo(() => rows.filter((r) => r.status === "Abierto").length, [rows]);

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
    setEditFetchError(null);
    setModalMode("create");
    setEditingId(null);
    resetFormDraft();
    setCreateEditModalOpen(true);
  };

  const openEditModal = async (row: ParteObraRow) => {
    if (!tenantCompanyId?.trim()) {
      setFormError("Falta la empresa del tenant para cargar el parte.");
      return;
    }
    setEditFetchError(null);
    setLoadingEdit(true);
    setFormError(null);
    const ac = new AbortController();
    const cid = tenantCompanyId.trim();
    try {
      const [dto, lines, catalog] = await Promise.all([
        multiDayWorkReportsApi.getById(row.id, { signal: ac.signal }),
        multiDayWorkReportsApi.getMaterials(row.id, { signal: ac.signal }),
        materialsApi.getAll({ signal: ac.signal, companyId: cid }),
      ]);
      const nameById = new Map(catalog.map((m) => [m.id, m.name]));
      setModalMode("edit");
      setEditingId(dto.id);
      setTitle(dto.title);
      setNotes(dto.notes);
      setStart(dto.startDate.slice(0, 10));
      setEnd(dto.endDate ? dto.endDate.slice(0, 10) : "");
      setSelectedClientCompanyId(dto.clientCompanyId);
      setMaterials(
        lines.map((l) => ({
          id: l.materialId,
          lineId: l.id,
          name: (nameById.get(l.materialId) ?? "").trim() || l.materialId,
          quantity: String(l.quantity),
        })),
      );
      setCreateEditModalOpen(true);
    } catch (e) {
      const msg = userVisibleMessageFromUnknown(e, "No se pudo cargar el parte para editar.");
      setEditFetchError(msg);
      setFormError(msg);
    } finally {
      setLoadingEdit(false);
    }
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

  const addFromAvailable = (m: Material) => {
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
    return materialsCatalog.filter((m) => {
      if (selected.has(m.id)) return false;
      if (!q) return true;
      const unit = (m.unitOfMeasure ?? "").toLowerCase();
      return m.name.toLowerCase().includes(q) || unit.includes(q);
    });
  }, [materialsModalQuery, materialsModalSelected, materialsCatalog]);

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

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!user?.email) {
      setFormError("No hay usuario en sesión.");
      return;
    }
    const body = validateAndParseBody();
    if (!body) return;

    const cid = tenantCompanyId?.trim();
    if (!cid) {
      setFormError("No se pudo resolver la empresa del tenant (companyId). Revisa la sesión o el API de empresas.");
      return;
    }

    setSaving(true);
    const ac = new AbortController();
    try {
      if (modalMode === "create") {
        let createdId: string | null = null;
        try {
          const created = await multiDayWorkReportsApi.create(
            {
              companyId: cid,
              clientCompanyId: body.clientCompanyId,
              title: body.title,
              notes: body.notes,
              startDate: body.startIso,
              endDate: body.endVal,
            },
            { signal: ac.signal },
          );
          createdId = created.id;
          await syncMultiDayReportMaterials(created.id, materials, ac.signal);
        } catch (inner) {
          if (createdId) {
            try {
              await multiDayWorkReportsApi.delete(createdId, { signal: ac.signal });
            } catch {
              /* evitar parte huérfano sin materiales si el borrado falla */
            }
          }
          throw inner;
        }
        resetFormDraft();
        closeCreateEditModal();
        bumpList();
      } else if (modalMode === "edit" && editingId) {
        const row = rows.find((r) => r.id === editingId);
        if (!row) {
          setFormError("No se encontró el parte en la lista actual. Recarga la página.");
          return;
        }
        await multiDayWorkReportsApi.update(
          editingId,
          {
            title: body.title,
            notes: body.notes,
            startDate: body.startIso,
            endDate: body.endVal,
            status: row.status,
          },
          { signal: ac.signal },
        );
        await syncMultiDayReportMaterials(editingId, materials, ac.signal);
        closeCreateEditModal();
        bumpList();
      }
    } catch (err) {
      setFormError(userVisibleMessageFromUnknown(err, "No se pudo guardar el parte."));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const ac = new AbortController();
    const closedOn = localTodayISO();
    /** La fecha fin queda como el día del cierre (calendario local), no antes del inicio del parte. */
    const endDate =
      closedOn < row.plannedStartDate.slice(0, 10) ? row.plannedStartDate.slice(0, 10) : closedOn;
    try {
      await multiDayWorkReportsApi.update(
        id,
        {
          title: row.title,
          notes: row.notes,
          startDate: row.plannedStartDate,
          endDate,
          status: "Cerrado",
        },
        { signal: ac.signal },
      );
      bumpList();
    } catch (e) {
      setRowsError(userVisibleMessageFromUnknown(e, "No se pudo cerrar el parte."));
    }
  };

  const handleReopen = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const ac = new AbortController();
    try {
      await multiDayWorkReportsApi.update(
        id,
        {
          title: row.title,
          notes: row.notes,
          startDate: row.plannedStartDate,
          endDate: null,
          status: "Abierto",
        },
        { signal: ac.signal },
      );
      bumpList();
    } catch (e) {
      setRowsError(userVisibleMessageFromUnknown(e, "No se pudo reabrir el parte."));
    }
  };

  const handleDeleteRow = async (id: string, titleRow: string) => {
    const ok = window.confirm(
      `¿Eliminar el parte de obra «${titleRow}»? Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    const ac = new AbortController();
    try {
      await multiDayWorkReportsApi.delete(id, { signal: ac.signal });
      bumpList();
    } catch (e) {
      setRowsError(userVisibleMessageFromUnknown(e, "No se pudo eliminar el parte."));
    }
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
    <DashboardPageShell width="full" className="min-w-0">
      <DashboardHoyPageHero
        sectionLabel="Partes de obra"
        title="Partes de obra"
        description={
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Partes de obra multidía: datos desde{" "}
            <span className="font-mono text-xs">GET /api/MultiDayWorkReports</span>, materiales por parte en{" "}
            <span className="font-mono text-xs">…/materials</span>. Empresas cliente desde{" "}
            <span className="font-mono text-xs">GET /api/ClientCompanies</span>.
          </p>
        }
        extraBelow={
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Abiertos: <span className="font-semibold text-slate-700 dark:text-slate-300">{openCount}</span>
            {" · "}
            Mostrando <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredRows.length}</span>{" "}
            de <span className="font-semibold text-slate-700 dark:text-slate-300">{rows.length}</span>
          </p>
        }
        trailing={
          <div className="flex w-full flex-wrap items-stretch gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              disabled={!tenantCompanyId?.trim()}
              title={!tenantCompanyId?.trim() ? "Falta companyId del tenant para crear partes en el API." : undefined}
              onClick={openCreateModal}
              className="rounded-xl bg-agro-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-agro-700 disabled:opacity-50"
            >
              Crear parte de obra
            </button>
            <Link
              href="/dashboard/time-tracking"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Volver al fichador
            </Link>
          </div>
        }
      />

      <FichajeJornadaMainPanel clipOverflow={false}>
      {!tenantCompanyId?.trim() && isReady && user ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100 md:px-6">
          No se pudo obtener la empresa del tenant (necesaria para listar y crear partes). Comprueba{" "}
          <span className="font-mono text-xs">GET /api/Companies</span> o tu rol.
        </div>
      ) : null}
      {editFetchError ? (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100 md:px-6">
          {editFetchError}
        </div>
      ) : null}
      <div className="border-b border-slate-100 p-4 md:p-6 dark:border-slate-700/80">
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
              <option value="Abierto">Abierto</option>
              <option value="Cerrado">Cerrado</option>
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
                  {modalMode === "edit" ? (
                    <span className="block text-amber-700 dark:text-amber-300/90">
                      En edición no se puede cambiar la empresa cliente (contrato del API).
                    </span>
                  ) : null}
                </p>
                <select
                  id="md-client-company"
                  className={inputClass}
                  value={selectedClientCompanyId}
                  onChange={(e) => setSelectedClientCompanyId(e.target.value)}
                  disabled={modalMode === "edit"}
                  title={
                    modalMode === "edit"
                      ? "La API no permite cambiar la empresa cliente al editar."
                      : undefined
                  }
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
            <p className={labelClass}>Materiales</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Catálogo desde GET /api/Materials. Ajusta cantidad en el modal y se guardará en este parte de obra.
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
                    !selectedClientCompanyId.trim() ||
                    !tenantCompanyId?.trim()
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
                    disabled={materialsCatalogLoading}
                  />
                </div>
                {materialsCatalogLoading ? (
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Cargando materiales…</p>
                ) : materialsCatalogError ? (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-400">{materialsCatalogError}</p>
                ) : availableFiltered.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    {materialsCatalog.length === 0
                      ? "No hay materiales en el catálogo (GET /api/Materials). Puedes darlos de alta en Gestión → Materiales."
                      : "No hay materiales con ese filtro (o ya están seleccionados)."}
                  </p>
                ) : (
                  <div className="mt-3 max-h-80 overflow-y-auto pr-1">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="py-2 pr-3">Material</th>
                          <th className="py-2 pr-3 hidden sm:table-cell">Unidad</th>
                          <th className="py-2 w-24 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                        {availableFiltered.map((m) => (
                          <tr key={m.id}>
                            <td className="py-2 pr-3">
                              <span className="text-slate-800 dark:text-slate-100">{m.name}</span>
                            </td>
                            <td className="hidden py-2 pr-3 text-xs text-slate-500 sm:table-cell dark:text-slate-400">
                              {m.unitOfMeasure ?? "—"}
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

      <div className="min-w-0">
        <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-700/80">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Registro de partes</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Editar o eliminar filas; «Cerrar» marca el parte como cerrado sin borrarlo.
          </p>
        </div>
        {rowsError ? (
          <p className="px-5 py-6 text-center text-sm text-red-600 dark:text-red-400">{rowsError}</p>
        ) : rowsLoading ? (
          <div className="flex justify-center px-5 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-agro-500 border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
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
                      r.status === "Cerrado"
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
                          r.status === "Abierto"
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : "rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        }
                      >
                        {r.status === "Abierto" ? "Abierto" : "Cerrado"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell whitespace-nowrap">
                      {formatDateTimeEs(r.createdAtUtc)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          disabled={loadingEdit}
                          onClick={() => void openEditModal(r)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRow(r.id, r.title)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/55"
                        >
                          Eliminar
                        </button>
                        {r.status === "Abierto" ? (
                          <button
                            type="button"
                            onClick={() => void handleClose(r.id)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            Cerrar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleReopen(r.id)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            Reabrir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </FichajeJornadaMainPanel>
    </DashboardPageShell>
  );
}
