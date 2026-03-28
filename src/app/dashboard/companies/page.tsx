"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { companiesApi, getCompaniesFromApi, postClientCompanyWithAreas } from "@/services";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE, type Company as CompanyType, type CompanyArea } from "@/types";

function newAreaId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `ar-${crypto.randomUUID()}`;
  }
  return `ar-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type SortKey = "name" | "taxId" | "address";
type SortDir = "asc" | "desc";

export default function CompaniesPage() {
  const { user, isReady } = useAuth();
  const isAdminLike =
    user?.role === USER_ROLE.Admin ||
    user?.role === USER_ROLE.SuperAdmin ||
    user?.role === USER_ROLE.Manager;

  const [companies, setCompanies] = useState<CompanyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterSearch, setFilterSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** GUID de la empresa del tenant (GET `/api/Companies`); obligatorio para crear vía `ClientCompanies/with-areas`. */
  const [tenantCompanyId, setTenantCompanyId] = useState<string | null>(null);
  const [tenantIdError, setTenantIdError] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formTaxId, setFormTaxId] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formAreas, setFormAreas] = useState<CompanyArea[]>([]);

  useEffect(() => {
    if (!isReady || !isAdminLike) return;
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await companiesApi.getAll();
        if (ac.signal.aborted) return;
        setCompanies(list ?? []);
      } catch (e) {
        if (ac.signal.aborted) return;
        const msg = e instanceof ApiError ? e.message : "No se pudieron cargar las empresas.";
        setError(msg);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [isReady, isAdminLike]);

  useEffect(() => {
    if (!isReady || !isAdminLike) return;
    const ac = new AbortController();
    setTenantIdError(null);
    getCompaniesFromApi({ signal: ac.signal })
      .then((list) => {
        if (ac.signal.aborted) return;
        const id = list[0]?.id?.trim() ?? "";
        setTenantCompanyId(id || null);
        if (!id) setTenantIdError("No hay empresa en /api/Companies; no se puede rellenar companyId del tenant.");
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setTenantCompanyId(null);
        setTenantIdError("No se pudo obtener la empresa del tenant (GET /api/Companies). Revisa sesión y NEXT_PUBLIC_API_URL.");
      });
    return () => ac.abort();
  }, [isReady, isAdminLike]);

  const openCreate = () => {
    setEditingCompany(null);
    setFormName("");
    setFormTaxId("");
    setFormAddress("");
    setFormAreas([]);
    setModalOpen(true);
  };

  const openEdit = (company: CompanyType) => {
    setEditingCompany(company);
    setFormName(company.name);
    setFormTaxId(company.taxId ?? "");
    setFormAddress(company.address ?? "");
    setFormAreas((company.areas ?? []).map((a) => ({ ...a })));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCompany(null);
    setFormName("");
    setFormTaxId("");
    setFormAddress("");
    setFormAreas([]);
  };

  const addFormArea = () => {
    setFormAreas((prev) => [...prev, { id: newAreaId(), name: "", observations: "" }]);
  };

  const removeFormArea = (id: string) => {
    setFormAreas((prev) => prev.filter((a) => a.id !== id));
  };

  const patchFormArea = (id: string, patch: Partial<Pick<CompanyArea, "name" | "observations">>) => {
    setFormAreas((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
    );
  };

  const sanitizeAreasForSave = (): CompanyArea[] =>
    formAreas
      .map((a) => ({
        id: a.id,
        name: a.name.trim(),
        observations: a.observations.trim(),
      }))
      .filter((a) => a.name.length > 0 || a.observations.length > 0);

  /** Áreas para POST with-areas: solo nombre obligatorio; observaciones vacías → null. */
  const areasForClientCompanyApi = () =>
    formAreas
      .map((a) => ({
        name: a.name.trim(),
        observations: a.observations.trim() ? a.observations.trim() : null,
      }))
      .filter((a) => a.name.length > 0);

  const toggleSort = (key: SortKey) => {
    setSortKey(key);
    setSortDir((d) => (sortKey === key && d === "asc" ? "desc" : "asc"));
  };

  const filteredAndSorted = useMemo(() => {
    let list = companies.filter((c) => {
      if (!filterSearch.trim()) return true;
      const q = filterSearch.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.taxId ?? "").toLowerCase().includes(q) ||
        (c.address ?? "").toLowerCase().includes(q)
      );
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      if (sortKey === "taxId") return dir * (a.taxId || "").localeCompare(b.taxId || "");
      return dir * (a.address || "").localeCompare(b.address || "");
    });
    return list;
  }, [companies, sortKey, sortDir, filterSearch]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    const taxId = formTaxId.trim();
    const address = formAddress.trim();
    if (!name) return;

    setSaving(true);
    setError(null);
    const areasPayload = sanitizeAreasForSave();
    try {
      if (editingCompany) {
        const updated = await companiesApi.update(editingCompany.id, {
          name,
          taxId: taxId || "",
          address: address || "",
          areas: areasPayload,
        });
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === editingCompany.id
              ? {
                  ...c,
                  ...updated,
                  id: updated.id || c.id,
                  name: updated.name || name,
                  taxId: (updated.taxId ?? "") || taxId,
                  address: (updated.address ?? "") || address,
                  areas: updated.areas ?? areasPayload,
                }
              : c
          )
        );
      } else {
        if (!tenantCompanyId) {
          setError(
            "Falta el GUID de tu empresa (tenant). Debe existir al menos una fila en GET /api/Companies."
          );
          setSaving(false);
          return;
        }
        const created = await postClientCompanyWithAreas({
          companyId: tenantCompanyId,
          name,
          taxId: taxId || "",
          address: address || "",
          areas: areasForClientCompanyApi(),
        });
        setCompanies((prev) => [created, ...prev]);
      }
      closeModal();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo guardar la empresa.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await companiesApi.delete(id);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      setDeleteConfirm(null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo eliminar la empresa.";
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-agro-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAdminLike) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Empresas</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Solo administradores y managers pueden gestionar el catálogo de empresas.
        </p>
        <Link
          href="/dashboard/tasks"
          className="inline-flex rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white hover:bg-agro-700"
        >
          Volver al panel
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Empresas</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Empresas con las que se puede trabajar (alta, edición y baja). Los trabajadores se vinculan
            a una empresa al darlos de alta.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-agro-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-agro-700"
        >
          Nueva empresa
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
          placeholder="Buscar por nombre, CIF o dirección…"
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
                    onClick={() => toggleSort("taxId")}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    CIF / NIF {sortKey === "taxId" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("address")}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    Dirección {sortKey === "address" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
              {filteredAndSorted.map((company) => (
                <tr key={company.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {company.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {company.taxId || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {company.address || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {deleteConfirm === company.id ? (
                      <span className="flex items-center justify-end gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">¿Eliminar?</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(company.id)}
                          disabled={deletingId === company.id}
                          className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-500 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                        >
                          {deletingId === company.id ? "Eliminando..." : "Sí"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(null)}
                          disabled={deletingId === company.id}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(company)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(company.id)}
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
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">Cargando empresas…</p>
        )}
        {!loading && filteredAndSorted.length === 0 && (
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">
            {companies.length === 0
              ? "No hay empresas. Pulsa «Nueva empresa» para crear una."
              : "Ninguna empresa coincide con la búsqueda."}
          </p>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="company-form-title"
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:border dark:border-slate-600 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="company-form-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {editingCompany ? "Editar empresa" : "Nueva empresa"}
            </h2>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              {!editingCompany && tenantIdError && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
                  {tenantIdError}
                </p>
              )}
              <div>
                <label
                  htmlFor="company-name"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Nombre comercial / razón social
                </label>
                <input
                  id="company-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="Ej. Agro Demo S.L."
                />
              </div>
              <div>
                <label
                  htmlFor="company-tax"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  CIF / NIF
                </label>
                <input
                  id="company-tax"
                  type="text"
                  value={formTaxId}
                  onChange={(e) => setFormTaxId(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label
                  htmlFor="company-address"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Dirección
                </label>
                <input
                  id="company-address"
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="Opcional"
                />
              </div>

              <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Áreas</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Añade zonas o ubicaciones con nombre y observaciones.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addFormArea}
                    disabled={saving}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-agro-600 text-lg font-semibold text-agro-700 transition hover:bg-agro-50 dark:border-agro-500 dark:text-agro-300 dark:hover:bg-agro-900/30"
                    aria-label="Añadir área"
                  >
                    +
                  </button>
                </div>
                {formAreas.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
                    Pulsa «+» para añadir la primera área.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {formAreas.map((area, idx) => (
                      <li
                        key={area.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-600 dark:bg-slate-900/40"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Área {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFormArea(area.id)}
                            disabled={saving}
                            className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                          >
                            Quitar
                          </button>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label
                              htmlFor={`area-name-${area.id}`}
                              className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
                            >
                              Nombre del área
                            </label>
                            <input
                              id={`area-name-${area.id}`}
                              type="text"
                              value={area.name}
                              onChange={(e) => patchFormArea(area.id, { name: e.target.value })}
                              disabled={saving}
                              placeholder="Ej. Parcela 3, Nave 2…"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`area-obs-${area.id}`}
                              className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
                            >
                              Observaciones
                            </label>
                            <textarea
                              id={`area-obs-${area.id}`}
                              value={area.observations}
                              onChange={(e) =>
                                patchFormArea(area.id, { observations: e.target.value })
                              }
                              disabled={saving}
                              rows={2}
                              placeholder="Acceso, superficie, notas…"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
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
                  disabled={saving || (!editingCompany && !tenantCompanyId)}
                  className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white hover:bg-agro-700 disabled:opacity-50"
                >
                  {saving ? "Guardando…" : editingCompany ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}