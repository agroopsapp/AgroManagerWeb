"use client";

import { useEffect, useMemo, useState } from "react";
import { MODAL_BACKDROP_CENTER, modalScrollablePanel } from "@/components/modalShell";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";
import { useAuth } from "@/contexts/AuthContext";
import { useFlashSuccess } from "@/contexts/FlashSuccessContext";
import { getCompaniesFromApi, workServicesApi } from "@/services";
import { USER_ROLE, type WorkService } from "@/types";
import {
  DashboardHoyPageHero,
  DashboardPageShell,
  PageCalloutError,
  PageSurface,
} from "@/components/dashboard-page";

type SortKey = "name";
type SortDir = "asc" | "desc";

export default function ServicesPage() {
  const { showSuccess } = useFlashSuccess();
  const { user, isReady } = useAuth();
  const isWorker = user?.role === USER_ROLE.Worker;
  const [rows, setRows] = useState<WorkService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkService | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterSearch, setFilterSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tenantCompanyId, setTenantCompanyId] = useState<string | null>(null);
  const [tenantIdError, setTenantIdError] = useState<string | null>(null);
  const [formName, setFormName] = useState("");

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await workServicesApi.getAll({ signal: ac.signal });
        if (ac.signal.aborted) return;
        setRows(list ?? []);
      } catch (e) {
        if (ac.signal.aborted) return;
        setError(userVisibleMessageFromUnknown(e, "No se pudieron cargar los servicios."));
      } finally {
        if (ac.signal.aborted) return;
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    setTenantIdError(null);
    getCompaniesFromApi({ signal: ac.signal })
      .then((list) => {
        if (ac.signal.aborted) return;
        const id = list[0]?.id?.trim() ?? "";
        setTenantCompanyId(id || null);
        if (!id) {
          setTenantIdError(
            "No hay empresa registrada; no se puede crear servicio.",
          );
        }
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setTenantCompanyId(null);
        setTenantIdError(
          "No se pudo obtener la empresa del tenant.",
        );
      });
    return () => ac.abort();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setModalOpen(true);
  };

  const openEdit = (row: WorkService) => {
    setEditing(row);
    setFormName(row.name);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormName("");
  };

  const toggleSort = (key: SortKey) => {
    setSortKey(key);
    setSortDir((d) => (sortKey === key && d === "asc" ? "desc" : "asc"));
  };

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      if (!filterSearch.trim()) return true;
      const q = filterSearch.toLowerCase();
      return r.name.toLowerCase().includes(q);
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => dir * a.name.localeCompare(b.name));
    return list;
  }, [rows, sortKey, sortDir, filterSearch]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await workServicesApi.update(editing.id, { name });
        setRows((prev) =>
          prev.map((r) => (r.id === editing.id ? { ...r, name } : r))
        );
      } else {
        if (!tenantCompanyId) {
          setError(
            "Falta la empresa del tenant. Configura «Mi empresa» o contacta con administración.",
          );
          setSaving(false);
          return;
        }
        const created = await workServicesApi.create({ companyId: tenantCompanyId, name });
        setRows((prev) => [created, ...prev]);
      }
      closeModal();
      showSuccess(
        editing ? "Servicio actualizado correctamente." : "Servicio creado correctamente.",
      );
    } catch (err) {
      setError(userVisibleMessageFromUnknown(err, "No se pudo guardar."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await workServicesApi.delete(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirm(null);
      showSuccess("Servicio eliminado correctamente.");
    } catch (err) {
      setError(userVisibleMessageFromUnknown(err, "No se pudo eliminar."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <DashboardPageShell width="full" className="min-w-0">
      <DashboardHoyPageHero
        sectionLabel="Administración"
        title="Servicios"
        description={
          <div className="max-w-2xl space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400 [&_strong]:font-semibold">
            <p>Servicios que puede ofrecer una empresa.</p>
            {isReady && isWorker ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
                Como trabajador/a, esta pantalla es <strong className="font-semibold">solo consulta</strong>
                : no puedes crear, editar ni eliminar servicios.
              </p>
            ) : null}
          </div>
        }
        trailing={
          !isWorker ? (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
            >
              Nuevo servicio
            </button>
          ) : null
        }
      />

      {error ? <PageCalloutError>{error}</PageCalloutError> : null}

      <PageSurface>
        <input
          type="search"
          placeholder="Buscar por nombre…"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          disabled={loading}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
        />
      </PageSurface>

      <PageSurface padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700">
              <tr>
                <th
                  scope="col"
                  className="w-12 px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  N.º
                </th>
                <th className="px-4 py-3">
                  {isWorker ? (
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Servicio</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 font-semibold text-slate-800 hover:text-emerald-600 dark:text-slate-200 dark:hover:text-emerald-400"
                    >
                      Servicio {sortKey === "name" && (sortDir === "asc" ? "↑" : "↓")}
                    </button>
                  )}
                </th>
                {!isWorker ? (
                  <th className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                    Acciones
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
              {filteredSorted.map((row, lineIndex) => (
                <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                  <td className="px-2 py-3 text-center tabular-nums text-slate-500 dark:text-slate-400">
                    {lineIndex + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {row.name}
                  </td>
                  {!isWorker ? (
                    <td className="px-4 py-3 text-right">
                      {deleteConfirm === row.id ? (
                        <span className="flex items-center justify-end gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">¿Eliminar?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id)}
                            disabled={deletingId === row.id}
                            className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-500 dark:bg-red-900/40 dark:text-red-300"
                          >
                            {deletingId === row.id ? "…" : "Sí"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(null)}
                            disabled={deletingId === row.id}
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 dark:border-slate-500 dark:text-slate-300"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <span className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(row.id)}
                            className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 dark:border-red-500 dark:text-red-300"
                          >
                            Eliminar
                          </button>
                        </span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && (
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">Cargando…</p>
        )}
        {!loading && filteredSorted.length === 0 && (
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">
            {rows.length === 0
              ? isWorker
                ? "No hay servicios."
                : "No hay servicios. Pulsa «Nuevo servicio»."
              : "Nada coincide con la búsqueda."}
          </p>
        )}
      </PageSurface>

      {modalOpen && !isWorker && (
        <div
          className={`fixed inset-0 z-50 ${MODAL_BACKDROP_CENTER}`}
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="svc-form-title"
        >
          <div
            className={modalScrollablePanel("md")}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="svc-form-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {editing ? "Editar servicio" : "Nuevo servicio"}
            </h2>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              {!editing && tenantIdError && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
                  {tenantIdError}
                </p>
              )}
              <div>
                <label htmlFor="svc-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nombre
                </label>
                <input
                  id="svc-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  disabled={saving}
                  placeholder="Ej. Pesticida, Sembrar…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-500 dark:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || (!editing && !tenantCompanyId)}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                >
                  {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardPageShell>
  );
}
