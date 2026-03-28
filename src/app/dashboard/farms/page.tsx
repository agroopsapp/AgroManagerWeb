"use client";

import { useEffect, useMemo, useState } from "react";
import type { Farm as FarmType } from "@/types";
import { ApiError } from "@/lib/api-client";
import { farmsApi } from "@/services";

type SortKey = "name" | "location";
type SortDir = "asc" | "desc";

export default function FarmsPage() {
  const [farms, setFarms] = useState<FarmType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<FarmType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterSearch, setFilterSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formLocation, setFormLocation] = useState("");

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await farmsApi.getAll({ signal: ac.signal });
        if (ac.signal.aborted) return;
        setFarms(list ?? []);
      } catch (e) {
        if (ac.signal.aborted) return;
        const msg = e instanceof ApiError ? e.message : "No se pudieron cargar las granjas.";
        setError(msg);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  const openCreate = () => {
    setEditingFarm(null);
    setFormName("");
    setFormLocation("");
    setModalOpen(true);
  };

  const openEdit = (farm: FarmType) => {
    setEditingFarm(farm);
    setFormName(farm.name);
    setFormLocation(farm.location);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingFarm(null);
    setFormName("");
    setFormLocation("");
  };

  const toggleSort = (key: SortKey) => {
    setSortKey(key);
    setSortDir((d) => (sortKey === key && d === "asc" ? "desc" : "asc"));
  };

  const filteredAndSortedFarms = useMemo(() => {
    let list = farms.filter((f) => {
      const matchSearch =
        !filterSearch.trim() ||
        f.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
        (f.location ?? "").toLowerCase().includes(filterSearch.toLowerCase());
      return matchSearch;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      if (sortKey === "location") return dir * (a.location || "").localeCompare(b.location || "");
      return 0;
    });
    return list;
  }, [farms, sortKey, sortDir, filterSearch]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    const location = formLocation.trim();
    if (!name) return;

    setSaving(true);
    setError(null);
    try {
      if (editingFarm) {
        const updated = await farmsApi.update(editingFarm.id, {
          name,
          location: location || "",
        });
        setFarms((prev) =>
          prev.map((f) =>
            f.id === editingFarm.id
              ? {
                  ...f,
                  ...updated,
                  // si el backend devuelve id vacío/incorrecto (p.ej. 204 NoContent),
                  // conservamos el id original para que la tabla no "desaparezca"
                  id: updated.id || f.id,
                  name: updated.name || name,
                  location: (updated.location ?? "") || (location || ""),
                }
              : f
          )
        );
      } else {
        const created = await farmsApi.create({
          name,
          location: location || "",
        });
        setFarms((prev) => [created, ...prev]);
      }
      closeModal();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo guardar la granja.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await farmsApi.delete(id);
      setFarms((prev) => prev.filter((f) => f.id !== id));
      setDeleteConfirm(null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo eliminar la granja.";
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Granjas</h1>
          <p className="text-slate-600 dark:text-slate-400">
            CRUD de granjas. Crear, editar y eliminar. Nombre y ubicación.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-agro-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-agro-700"
        >
          Nueva granja
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="search"
          placeholder="Buscar por nombre o ubicación..."
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          disabled={loading}
          className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
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
                    Nombre {sortKey === "name" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("location")}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    Ubicación {sortKey === "location" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
              {filteredAndSortedFarms.map((farm) => (
                <tr key={farm.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {farm.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {farm.location || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {deleteConfirm === farm.id ? (
                      <span className="flex items-center justify-end gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ¿Eliminar?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(farm.id)}
                          disabled={deletingId === farm.id}
                          className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-500 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                        >
                          {deletingId === farm.id ? "Eliminando..." : "Sí"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(null)}
                          disabled={deletingId === farm.id}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(farm)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(farm.id)}
                          className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-500 dark:text-red-300 dark:hover:bg-red-900/40"
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
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">
            Cargando granjas...
          </p>
        )}
        {!loading && filteredAndSortedFarms.length === 0 && (
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">
            {farms.length === 0
              ? "No hay granjas. Pulsa \"Nueva granja\" para crear una."
              : "Ninguna granja coincide con los filtros."}
          </p>
        )}
      </div>

      {/* Modal crear/editar */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="farm-form-title"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800 dark:border dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="farm-form-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {editingFarm ? "Editar granja" : "Nueva granja"}
            </h2>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label htmlFor="farm-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nombre
                </label>
                <input
                  id="farm-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="Ej. Granja Norte"
                />
              </div>
              <div>
                <label htmlFor="farm-location" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Ubicación
                </label>
                <input
                  id="farm-location"
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="Ej. Carretera N-1 km 42, Burgos"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white hover:bg-agro-700"
                >
                  {saving ? "Guardando..." : editingFarm ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
