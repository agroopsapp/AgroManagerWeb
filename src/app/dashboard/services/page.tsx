"use client";

import { useEffect, useMemo, useState } from "react";
import { workServicesMock } from "@/lib/workServicesMock";
import type { WorkService } from "@/types";

type SortKey = "name" | "description";
type SortDir = "asc" | "desc";

export default function ServicesPage() {
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
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await workServicesMock.getAll();
        if (!alive) return;
        setRows(list ?? []);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "No se pudieron cargar los servicios.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormDescription("");
    setModalOpen(true);
  };

  const openEdit = (row: WorkService) => {
    setEditing(row);
    setFormName(row.name);
    setFormDescription(row.description ?? "");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormName("");
    setFormDescription("");
  };

  const toggleSort = (key: SortKey) => {
    setSortKey(key);
    setSortDir((d) => (sortKey === key && d === "asc" ? "desc" : "asc"));
  };

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      if (!filterSearch.trim()) return true;
      const q = filterSearch.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
      );
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      return dir * (a.description || "").localeCompare(b.description || "");
    });
    return list;
  }, [rows, sortKey, sortDir, filterSearch]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    const description = formDescription.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const updated = await workServicesMock.update(editing.id, { name, description });
        setRows((prev) =>
          prev.map((r) => (r.id === editing.id ? { ...r, ...updated } : r))
        );
      } else {
        const created = await workServicesMock.create({ name, description });
        setRows((prev) => [created, ...prev]);
      }
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await workServicesMock.delete(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Servicios</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Servicios que puede ofrecer una empresa (mock en este navegador). Cuando exista API, se
            enlazará al backend.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-agro-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-agro-700"
        >
          Nuevo servicio
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800">
        <input
          type="search"
          placeholder="Buscar por nombre o descripción…"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          disabled={loading}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    Servicio {sortKey === "name" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("description")}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    Descripción {sortKey === "description" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
              {filteredSorted.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {row.description || "—"}
                  </td>
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
              ? "No hay servicios. Pulsa «Nuevo servicio»."
              : "Nada coincide con la búsqueda."}
          </p>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="svc-form-title"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:border dark:border-slate-600 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="svc-form-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {editing ? "Editar servicio" : "Nuevo servicio"}
            </h2>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
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
              <div>
                <label
                  htmlFor="svc-desc"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Descripción
                </label>
                <textarea
                  id="svc-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  disabled={saving}
                  rows={3}
                  placeholder="Detalle breve del servicio…"
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
                  disabled={saving}
                  className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white hover:bg-agro-700"
                >
                  {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
