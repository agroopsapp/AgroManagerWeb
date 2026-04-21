"use client";

import { useEffect, useMemo, useState } from "react";
import { MODAL_BACKDROP_CENTER, modalScrollablePanel } from "@/components/modalShell";
import { UserExcludedFromTimeTrackingControl } from "@/components/UserExcludedFromTimeTrackingControl";
import { useFlashSuccess } from "@/contexts/FlashSuccessContext";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";
import { rolesApi } from "@/services/roles.service";
import { usersApi, type UpdateUserPayload } from "@/services/users.service";
import type { Role, User as UserType } from "@/types";

/** Misma compañía que en el backend de pruebas; luego puede venir de la sesión. */
const COMPANY_ID = "356d0a75-654a-4d07-b65c-25f97f854178";

/** Solo dígitos para el API (quita espacios, +, guiones, paréntesis). Vacío → undefined. */
function telefonoParaApi(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : undefined;
}

/* Listado: GET /api/Users (igual que Postman). COMPANY_ID solo para crear usuario. */

type SortKey = "name" | "email" | "role" | "excluded";
type SortDir = "asc" | "desc";

export default function UsersPage() {
  const { showSuccess } = useFlashSuccess();
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  /** Errores de listado / carga / eliminar (se muestran en la página, no en modales). */
  const [pageError, setPageError] = useState<string | null>(null);
  /** Errores al crear o editar usuario (solo dentro del modal de formulario). */
  const [userModalError, setUserModalError] = useState<string | null>(null);
  /** Errores al cambiar contraseña (solo dentro de ese modal). */
  const [passwordModalError, setPasswordModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserType | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  /** Solo se usa tras pulsar «Sí»; «Eliminar» solo muestra la confirmación, no llama al API. */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterRoleId, setFilterRoleId] = useState<string>("");
  const [roles, setRoles] = useState<Role[]>([]);

  const loadUsers = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setPageError(null);
      const data = await usersApi.getAll({ signal });
      setUsers(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPageError(userVisibleMessageFromUnknown(err, "No se pudieron cargar los trabajadores."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    void loadUsers(ac.signal);
    void rolesApi.getAll({ signal: ac.signal }).then(setRoles).catch(() => setRoles([]));
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyPhone = (userId: string, phone: string) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone).then(() => {
      setCopiedId(userId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRoleId, setFormRoleId] = useState<string>("");
  const [formExcludedFromTimeTracking, setFormExcludedFromTimeTracking] = useState(false);

  useEffect(() => {
    if (!modalOpen || editingUser || !roles.length || formRoleId) return;
    setFormRoleId(roles[0].id);
  }, [modalOpen, editingUser, roles, formRoleId]);

  const openCreate = () => {
    setUserModalError(null);
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormPassword("");
    setFormRoleId(roles[0]?.id ?? "");
    setFormExcludedFromTimeTracking(false);
    setModalOpen(true);
  };

  const openEdit = (user: UserType) => {
    setUserModalError(null);
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPhone(user.phone ?? "");
    setFormPassword("");
    setFormRoleId(user.roleId);
    setFormExcludedFromTimeTracking(user.excludedFromTimeTracking === true);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormPassword("");
    setFormExcludedFromTimeTracking(false);
    setUserModalError(null);
  };

  const roleLabel = (user: UserType) =>
    user.roleName ?? roles.find((r) => r.id === user.roleId)?.name ?? user.roleId;

  const toggleSort = (key: SortKey) => {
    setSortKey(key);
    setSortDir((d) => (sortKey === key && d === "asc" ? "desc" : "asc"));
  };

  const filteredAndSortedUsers = useMemo(() => {
    let list = users.filter((u) => {
      const matchSearch =
        !filterSearch.trim() ||
        u.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(filterSearch.toLowerCase()) ||
        (u.phone ?? "").toLowerCase().includes(filterSearch.toLowerCase());
      const matchRole = !filterRoleId || u.roleId === filterRoleId;
      return matchSearch && matchRole;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      if (sortKey === "email") return dir * a.email.localeCompare(b.email);
      if (sortKey === "role") return dir * roleLabel(a).localeCompare(roleLabel(b));
      if (sortKey === "excluded") {
        const af = a.excludedFromTimeTracking === true ? 1 : 0;
        const bf = b.excludedFromTimeTracking === true ? 1 : 0;
        return dir * (af - bf);
      }
      return 0;
    });
    return list;
  }, [users, sortKey, sortDir, filterSearch, filterRoleId, roles]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    const email = formEmail.trim();
    const telefono = telefonoParaApi(formPhone.trim());
    const password = formPassword.trim();
    if (!name || !email) return;

    if (editingUser) {
      try {
        setSaving(true);
        setUserModalError(null);
        const companyIdPut = editingUser.companyId?.trim() || COMPANY_ID;
        const body: UpdateUserPayload = {
          companyId: companyIdPut,
          name,
          email,
          roleId: formRoleId,
          telefono,
          excludedFromTimeTracking: formExcludedFromTimeTracking,
        };
        await usersApi.update(editingUser.id, body);
        closeModal();
        await loadUsers();
        showSuccess("Usuario actualizado correctamente.");
      } catch (err) {
        setUserModalError(userVisibleMessageFromUnknown(err, "No se pudo guardar el usuario."));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!formRoleId || !password) {
      setUserModalError("Para crear el usuario indica rol y contraseña.");
      return;
    }

    try {
      setSaving(true);
      setUserModalError(null);
      await usersApi.create({
        companyId: COMPANY_ID,
        name,
        email,
        password,
        roleId: formRoleId,
        telefono,
        ...(formExcludedFromTimeTracking ? { excludedFromTimeTracking: true } : {}),
      });
      closeModal();
      await loadUsers();
      showSuccess("Usuario creado correctamente.");
    } catch (err) {
      setUserModalError(userVisibleMessageFromUnknown(err, "No se pudo crear el usuario."));
    } finally {
      setSaving(false);
    }
  };

  const closePasswordModal = () => {
    setPasswordUser(null);
    setNewPassword("");
    setPasswordModalError(null);
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const pw = newPassword.trim();
    if (!passwordUser || !pw) return;
    try {
      setPasswordSaving(true);
      setPasswordModalError(null);
      await usersApi.changePassword(passwordUser.id, { password: pw });
      closePasswordModal();
      await loadUsers();
      showSuccess("Contraseña actualizada correctamente.");
    } catch (err) {
      setPasswordModalError(userVisibleMessageFromUnknown(err, "No se pudo cambiar la contraseña."));
    } finally {
      setPasswordSaving(false);
    }
  };

  /** Llama al DELETE solo cuando el usuario confirma con «Sí». */
  const confirmDeleteUser = async (id: string) => {
    try {
      setDeletingId(id);
      setPageError(null);
      await usersApi.delete(id);
      setDeleteConfirm(null);
      await loadUsers();
      showSuccess("Usuario eliminado correctamente.");
    } catch (err) {
      setPageError(userVisibleMessageFromUnknown(err, "No se pudo eliminar el usuario."));
      setDeleteConfirm(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Trabajadores</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Configuración de usuarios (admin). Crear, editar y eliminar.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-agro-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-agro-700"
        >
          Nuevo usuario
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="search"
          placeholder="Buscar por nombre, email o teléfono..."
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          className="flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
        />
        <select
          value={filterRoleId}
          onChange={(e) => setFilterRoleId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="">Todos los roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Cargando trabajadores...
        </div>
      )}

      {pageError && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-500/40 dark:bg-red-900/20 dark:text-red-300">
          {pageError}
        </div>
      )}

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
                    onClick={() => toggleSort("email")}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    Email {sortKey === "email" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">Teléfono</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("role")}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    Rol {sortKey === "role" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("excluded")}
                    title="Excluido del registro de jornada (fichador)"
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    Excl. jornada {sortKey === "excluded" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
              {!loading &&
                filteredAndSortedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {user.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span className="text-slate-600 dark:text-slate-300">{user.phone || "—"}</span>
                      {user.phone && (
                        <button
                          type="button"
                          onClick={() => copyPhone(user.id, user.phone)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                          title="Copiar teléfono"
                          aria-label="Copiar teléfono"
                        >
                          {copiedId === user.id ? (
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">Copiado</span>
                          ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h2m0 8h8a2 2 0 002-2v-2m0 8V6a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                      {roleLabel(user)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {user.excludedFromTimeTracking === true ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                        Sí
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-600 dark:text-slate-300">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {deleteConfirm === user.id ? (
                      <span className="flex items-center justify-end gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {deletingId === user.id ? "Eliminando…" : "¿Eliminar?"}
                        </span>
                        <button
                          type="button"
                          disabled={deletingId === user.id}
                          onClick={() => confirmDeleteUser(user.id)}
                          className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-500 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === user.id}
                          onClick={() => setDeleteConfirm(null)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <span className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(user)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordUser(user);
                            setNewPassword("");
                            setPasswordModalError(null);
                          }}
                          className="rounded border border-amber-200 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/30"
                        >
                          Contraseña
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteConfirm(user.id);
                          }}
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
        {!loading && filteredAndSortedUsers.length === 0 && (
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">
            {users.length === 0
              ? "No hay usuarios. Pulsa \"Nuevo usuario\" para crear uno."
              : "Ningún usuario coincide con los filtros."}
          </p>
        )}
      </div>

      {/* Modal crear/editar */}
      {modalOpen && (
        <div
          className={`fixed inset-0 z-50 ${MODAL_BACKDROP_CENTER}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-form-title"
        >
          <div className={modalScrollablePanel("md")}>
            <h2 id="user-form-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {editingUser ? "Editar usuario" : "Nuevo usuario"}
            </h2>
            {userModalError ? (
              <div
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                {userModalError}
              </div>
            ) : null}
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label htmlFor="user-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nombre
                </label>
                <input
                  id="user-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div>
                <label htmlFor="user-email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <input
                  id="user-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="usuario@ejemplo.com"
                />
              </div>
              <div>
                <label htmlFor="user-phone" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Teléfono
                </label>
                <input
                  id="user-phone"
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="Ej. +34 612 345 678"
                />
              </div>
              {!editingUser && (
                <div>
                  <label htmlFor="user-password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Contraseña
                  </label>
                  <input
                    id="user-password"
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                    placeholder="••••••••"
                  />
                </div>
              )}
              <div>
                <label htmlFor="user-role" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Rol
                </label>
                <select
                  id="user-role"
                  value={formRoleId}
                  onChange={(e) => setFormRoleId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <UserExcludedFromTimeTrackingControl
                id="user-excluded-time-tracking"
                checked={formExcludedFromTimeTracking}
                onChange={setFormExcludedFromTimeTracking}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white hover:bg-agro-700 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : editingUser ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordUser && (
        <div
          className={`fixed inset-0 z-50 ${MODAL_BACKDROP_CENTER}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-dialog-title"
        >
          <div className={modalScrollablePanel("md")}>
            <h2 id="password-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Cambiar contraseña
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {passwordUser.name} ({passwordUser.email})
            </p>
            {passwordModalError ? (
              <div
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                {passwordModalError}
              </div>
            ) : null}
            <form onSubmit={handlePasswordSave} className="mt-4 space-y-4">
              <div>
                <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nueva contraseña
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white hover:bg-agro-700 disabled:opacity-60"
                >
                  {passwordSaving ? "Guardando..." : "Actualizar contraseña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
