"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MODAL_BACKDROP_SCROLL, MODAL_SURFACE, MODAL_SURFACE_PAD, modalScrollablePanel } from "@/components/modalShell";
import { UserExcludedFromTimeTrackingControl } from "@/components/UserExcludedFromTimeTrackingControl";
import { useFlashSuccess } from "@/contexts/FlashSuccessContext";
import type { SuperadminParentCompanyDto } from "@/features/superadmin/types";
import { rolesApi } from "@/services/roles.service";
import { superadminApi, usersApi } from "@/services";
import type { UpdateUserPayload } from "@/services/users.service";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";
import type { Role, User as UserType } from "@/types";

/** Igual que en trabajadores: dígitos para el API. */
function telefonoParaApi(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : undefined;
}

type SortKey = "name" | "email" | "role" | "excluded";
type SortDir = "asc" | "desc";

type Props = {
  company: SuperadminParentCompanyDto | null;
  onClose: () => void;
};

export function SuperadminCompanyUsersModal({ company, onClose }: Props) {
  const { showSuccess } = useFlashSuccess();
  const companyId = company?.id ?? "";

  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [userModalError, setUserModalError] = useState<string | null>(null);
  const [passwordModalError, setPasswordModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserType | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterRoleId, setFilterRoleId] = useState<string>("");
  const [roles, setRoles] = useState<Role[]>([]);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPasswordConfirm, setFormPasswordConfirm] = useState("");
  const [formRoleId, setFormRoleId] = useState<string>("");
  const [formExcludedFromTimeTracking, setFormExcludedFromTimeTracking] = useState(false);

  const loadUsers = useCallback(async (signal?: AbortSignal) => {
    if (!companyId) return;
    try {
      setLoading(true);
      setPageError(null);
      const data = await superadminApi.listCompanyUsers(companyId, { signal });
      setUsers(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPageError(userVisibleMessageFromUnknown(err, "No se pudieron cargar los usuarios de esta empresa."));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!company) return;
    const ac = new AbortController();
    void loadUsers(ac.signal);
    void rolesApi.getAll({ signal: ac.signal }).then(setRoles).catch(() => setRoles([]));
    setFilterSearch("");
    setFilterRoleId("");
    setDeleteConfirm(null);
    setModalOpen(false);
    setPasswordUser(null);
    setNewPassword("");
    setNewPasswordConfirm("");
    setPasswordModalError(null);
    return () => ac.abort();
  }, [company, loadUsers]);

  const copyPhone = (userId: string, phone: string) => {
    if (!phone) return;
    void navigator.clipboard.writeText(phone).then(() => {
      setCopiedId(userId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

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
    setFormPasswordConfirm("");
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
    setFormPasswordConfirm("");
    setFormRoleId(user.roleId);
    setFormExcludedFromTimeTracking(user.excludedFromTimeTracking === true);
    setModalOpen(true);
  };

  const closeUserFormModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormPassword("");
    setFormPasswordConfirm("");
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
    const label = (u: UserType) =>
      u.roleName ?? roles.find((r) => r.id === u.roleId)?.name ?? u.roleId;
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
      if (sortKey === "role") return dir * label(a).localeCompare(label(b));
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
    const passwordConfirm = formPasswordConfirm.trim();
    if (!name || !email || !company) return;

    if (editingUser) {
      try {
        setSaving(true);
        setUserModalError(null);
        const body: UpdateUserPayload = {
          companyId: company.id,
          name,
          email,
          roleId: formRoleId,
          telefono,
          excludedFromTimeTracking: formExcludedFromTimeTracking,
        };
        await usersApi.update(editingUser.id, body);
        closeUserFormModal();
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
    if (password !== passwordConfirm) {
      setUserModalError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setSaving(true);
      setUserModalError(null);
      await usersApi.create({
        companyId: company.id,
        name,
        email,
        password,
        roleId: formRoleId,
        telefono,
        ...(formExcludedFromTimeTracking ? { excludedFromTimeTracking: true } : {}),
      });
      closeUserFormModal();
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
    setNewPasswordConfirm("");
    setPasswordModalError(null);
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const pw = newPassword.trim();
    const pwConfirm = newPasswordConfirm.trim();
    if (!passwordUser || !pw) return;
    if (pw !== pwConfirm) {
      setPasswordModalError("Las contraseñas no coinciden.");
      return;
    }
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

  if (!company) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-50 ${MODAL_BACKDROP_SCROLL}`}
        role="presentation"
        onClick={onClose}
      >
        <div
          className={`my-4 w-full max-w-6xl max-h-[min(92vh,900px)] overflow-y-auto ${MODAL_SURFACE} ${MODAL_SURFACE_PAD}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="superadmin-users-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-600 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="superadmin-users-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Usuarios de la empresa
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{company.name}</span>
                <span className="ml-2 font-mono text-xs text-slate-500">{company.id}</span>
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Listado:{" "}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /api/superadmin/companies/{"{id}"}/users</code>
                . Alta: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">POST /api/Users</code> con{" "}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">companyId</code> de esta fila.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadUsers()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                Actualizar
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="rounded-lg bg-agro-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-agro-700"
              >
                Nuevo usuario
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/40 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              type="search"
              placeholder="Buscar por nombre, email o teléfono…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
            />
            <select
              value={filterRoleId}
              onChange={(e) => setFilterRoleId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Todos los roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {loading && (
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Cargando usuarios…</p>
          )}

          {pageError && !loading && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {pageError}
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800/80">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/80">
                  <tr>
                    <th className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSort("name")}
                        className="font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200"
                      >
                        Nombre {sortKey === "name" && (sortDir === "asc" ? "↑" : "↓")}
                      </button>
                    </th>
                    <th className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSort("email")}
                        className="font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200"
                      >
                        Email {sortKey === "email" && (sortDir === "asc" ? "↑" : "↓")}
                      </button>
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200">Teléfono</th>
                    <th className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSort("role")}
                        className="font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200"
                      >
                        Rol {sortKey === "role" && (sortDir === "asc" ? "↑" : "↓")}
                      </button>
                    </th>
                    <th className="px-3 py-2.5">
                      <button
                        type="button"
                        title="Excluido del registro de jornada"
                        onClick={() => toggleSort("excluded")}
                        className="font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200"
                      >
                        Excl. jornada {sortKey === "excluded" && (sortDir === "asc" ? "↑" : "↓")}
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-200">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
                  {!loading &&
                    filteredAndSortedUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/40">
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{user.name}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{user.email}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <span className="text-slate-600 dark:text-slate-300">{user.phone || "—"}</span>
                            {user.phone ? (
                              <button
                                type="button"
                                onClick={() => copyPhone(user.id, user.phone)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                                title="Copiar teléfono"
                                aria-label="Copiar teléfono"
                              >
                                {copiedId === user.id ? (
                                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Copiado</span>
                                ) : (
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h2m0 8h8a2 2 0 002-2v-2m0 8V6a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                  </svg>
                                )}
                              </button>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                            {roleLabel(user)}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
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
                        <td className="px-3 py-2 text-right">
                          {deleteConfirm === user.id ? (
                            <span className="flex flex-wrap items-center justify-end gap-2">
                              <span className="text-xs text-slate-500">
                                {deletingId === user.id ? "Eliminando…" : "¿Eliminar?"}
                              </span>
                              <button
                                type="button"
                                disabled={deletingId === user.id}
                                onClick={() => void confirmDeleteUser(user.id)}
                                className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-500 dark:bg-red-900/40 dark:text-red-200"
                              >
                                Sí
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === user.id}
                                onClick={() => setDeleteConfirm(null)}
                                className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300"
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <span className="flex flex-wrap items-center justify-end gap-1.5">
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
                                  setNewPasswordConfirm("");
                                  setPasswordModalError(null);
                                }}
                                className="rounded border border-amber-200 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/30"
                              >
                                Contraseña
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm(user.id)}
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
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {users.length === 0
                  ? "No hay usuarios. Pulsa «Nuevo usuario» para crear uno en esta empresa."
                  : "Ningún usuario coincide con los filtros."}
              </p>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-[4px] sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="superadmin-user-form-title"
        >
          <div className={modalScrollablePanel("md")}>
            <h2 id="superadmin-user-form-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {editingUser ? "Editar usuario" : "Nuevo usuario"}
            </h2>
            {userModalError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                {userModalError}
              </div>
            ) : null}
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label htmlFor="sa-user-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nombre
                </label>
                <input
                  id="sa-user-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="sa-user-email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <input
                  id="sa-user-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="sa-user-phone" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Teléfono
                </label>
                <input
                  id="sa-user-phone"
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              {!editingUser && (
                <>
                  <div>
                    <label htmlFor="sa-user-password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Contraseña
                    </label>
                    <input
                      id="sa-user-password"
                      type="password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="sa-user-password-confirm" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Repetir contraseña
                    </label>
                    <input
                      id="sa-user-password-confirm"
                      type="password"
                      value={formPasswordConfirm}
                      onChange={(e) => setFormPasswordConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                </>
              )}
              <div>
                <label htmlFor="sa-user-role" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Rol
                </label>
                <select
                  id="sa-user-role"
                  value={formRoleId}
                  onChange={(e) => setFormRoleId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <UserExcludedFromTimeTrackingControl
                id="sa-user-excluded-time-tracking"
                checked={formExcludedFromTimeTracking}
                onChange={setFormExcludedFromTimeTracking}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeUserFormModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-500 dark:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Guardando…" : editingUser ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordUser && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="superadmin-password-title"
        >
          <div className={modalScrollablePanel("md")}>
            <h2 id="superadmin-password-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Cambiar contraseña
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {passwordUser.name} ({passwordUser.email})
            </p>
            {passwordModalError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                {passwordModalError}
              </div>
            ) : null}
            <form onSubmit={handlePasswordSave} className="mt-4 space-y-4">
              <div>
                <label htmlFor="sa-new-password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nueva contraseña
                </label>
                <input
                  id="sa-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="sa-new-password-confirm" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Repetir contraseña
                </label>
                <input
                  id="sa-new-password-confirm"
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-500 dark:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {passwordSaving ? "Guardando…" : "Actualizar contraseña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
