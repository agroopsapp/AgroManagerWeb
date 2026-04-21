"use client";

import { useState } from "react";
import { MODAL_BACKDROP_SCROLL, MODAL_SURFACE, MODAL_SURFACE_PAD } from "@/components/modalShell";
import { useFlashSuccess } from "@/contexts/FlashSuccessContext";
import { SuperadminCompanyUsersModal } from "@/features/superadmin/components/SuperadminCompanyUsersModal";
import { useSuperadminParentCompanies } from "@/features/superadmin/hooks/useSuperadminParentCompanies";
import type {
  SuperadminCreateCompanyBody,
  SuperadminParentCompanyDto,
  SuperadminUpdateCompanyBody,
} from "@/features/superadmin/types";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

function formFromCompany(c: SuperadminParentCompanyDto): SuperadminUpdateCompanyBody {
  return {
    name: c.name,
    fiscalName: c.fiscalName,
    taxId: c.taxId,
    address: c.address,
    email: c.email,
    phone: c.phone,
    website: c.website,
    logoUrl: c.logoUrl,
  };
}

function emptyForm(): SuperadminUpdateCompanyBody {
  return {
    name: "",
    fiscalName: "",
    taxId: "",
    address: "",
    email: "",
    phone: "",
    website: "",
    logoUrl: "",
  };
}

export function SuperadminParentCompaniesPanel({ active }: { active: boolean }) {
  const { showSuccess } = useFlashSuccess();
  const co = useSuperadminParentCompanies(active);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SuperadminUpdateCompanyBody>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [usersModalCompany, setUsersModalCompany] = useState<SuperadminParentCompanyDto | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (c: SuperadminParentCompanyDto) => {
    setEditingId(c.id);
    setForm(formFromCompany(c));
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        const putBody: SuperadminUpdateCompanyBody = {
          name,
          fiscalName: form.fiscalName?.trim() || "",
          taxId: form.taxId?.trim() || "",
          address: form.address?.trim() || "",
          email: form.email?.trim() || "",
          phone: form.phone?.trim() || "",
          website: form.website?.trim() || "",
          logoUrl: form.logoUrl?.trim() || "",
        };
        await co.updateCompany(editingId, putBody);
        showSuccess("Empresa actualizada.");
      } else {
        const postBody: SuperadminCreateCompanyBody = { name };
        const pick = (s: string | undefined) => {
          const v = (s ?? "").trim();
          return v.length ? v : null;
        };
        const fiscalName = pick(form.fiscalName);
        if (fiscalName) postBody.fiscalName = fiscalName;
        const taxId = pick(form.taxId);
        if (taxId) postBody.taxId = taxId;
        const address = pick(form.address);
        if (address) postBody.address = address;
        const email = pick(form.email);
        if (email) postBody.email = email;
        const phone = pick(form.phone);
        if (phone) postBody.phone = phone;
        const website = pick(form.website);
        if (website) postBody.website = website;
        const logoUrl = pick(form.logoUrl);
        if (logoUrl) postBody.logoUrl = logoUrl;
        await co.createCompany(postBody);
        showSuccess("Empresa creada.");
      }
      closeModal();
    } catch (err) {
      setFormError(userVisibleMessageFromUnknown(err, "No se pudo guardar."));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await co.deleteCompany(deleteId);
      showSuccess("Empresa eliminada (baja lógica).");
      setDeleteId(null);
    } catch (err) {
      setDeleteError(userVisibleMessageFromUnknown(err, "No se pudo eliminar."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-md flex-1">
          <label htmlFor="superadmin-co-filter" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
            Filtrar listado
          </label>
          <input
            id="superadmin-co-filter"
            type="search"
            value={co.filterText}
            onChange={(e) => co.setFilterText(e.target.value)}
            placeholder="Nombre, CIF, email, id…"
            className={fieldClass}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void co.reload()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Actualizar
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-agro-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-agro-700"
          >
            Nueva empresa
          </button>
        </div>
      </div>

      {co.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {co.error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
            <tr>
              <th className="px-3 py-3">Nombre</th>
              <th className="px-3 py-3">CIF</th>
              <th className="px-3 py-3 hidden lg:table-cell">Email</th>
              <th className="px-3 py-3 hidden md:table-cell">Alta</th>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {co.loading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!co.loading &&
              co.filteredCompanies.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{c.name}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{c.taxId || "—"}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300 hidden lg:table-cell">
                    {c.email || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-xs hidden md:table-cell whitespace-nowrap">
                    {c.createdAt ? new Date(c.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setUsersModalCompany(c)}
                      className="mr-2 text-slate-700 text-xs font-semibold hover:underline dark:text-slate-300"
                    >
                      Usuarios
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="mr-2 text-agro-600 text-xs font-semibold hover:underline dark:text-agro-400"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(c.id)}
                      className="text-red-600 text-xs font-semibold hover:underline dark:text-red-400"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            {!co.loading && co.filteredCompanies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No hay empresas que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className={`fixed inset-0 z-50 ${MODAL_BACKDROP_SCROLL}`} onClick={closeModal}>
          <div
            className={`my-4 w-full max-w-lg ${MODAL_SURFACE} ${MODAL_SURFACE_PAD}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {editingId ? "Editar empresa padre" : "Nueva empresa padre"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Datos según contrato <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/api/superadmin/companies</code>
            </p>
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Nombre *</label>
                <input
                  className={`mt-1 ${fieldClass}`}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Razón social</label>
                <input
                  className={`mt-1 ${fieldClass}`}
                  value={form.fiscalName}
                  onChange={(e) => setForm((f) => ({ ...f, fiscalName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">CIF / NIF</label>
                <input className={`mt-1 ${fieldClass}`} value={form.taxId} onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Dirección</label>
                <input
                  className={`mt-1 ${fieldClass}`}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Email</label>
                <input
                  className={`mt-1 ${fieldClass}`}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Teléfono</label>
                <input className={`mt-1 ${fieldClass}`} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Web</label>
                <input
                  className={`mt-1 ${fieldClass}`}
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">URL logo</label>
                <input
                  className={`mt-1 ${fieldClass}`}
                  value={form.logoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                />
              </div>
              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SuperadminCompanyUsersModal company={usersModalCompany} onClose={() => setUsersModalCompany(null)} />

      {deleteId && (
        <div
          className={`fixed inset-0 z-50 ${MODAL_BACKDROP_SCROLL}`}
          onClick={() => {
            if (!deleting) {
              setDeleteId(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            className={`my-auto w-full max-w-sm ${MODAL_SURFACE} ${MODAL_SURFACE_PAD}`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">¿Eliminar esta empresa?</p>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Se envía DELETE a la API (baja lógica). Esta acción no se puede deshacer desde aquí.
            </p>
            {deleteError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
