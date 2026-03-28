"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api-client";
import { companyApiRowToMyCompanyProfile } from "@/lib/companyProfileFromApi";
import { fileToResizedDataUrl } from "@/lib/imageResize";
import {
  emptyMyCompanyProfile,
  getMyCompanyProfile,
  MY_COMPANY_PROFILE_CHANGED_EVENT,
  saveMyCompanyProfile,
  type MyCompanyProfile,
} from "@/lib/myCompanyProfile";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildMyCompanyPutBody,
  getCompaniesFromApi,
  putCompanyOnApi,
} from "@/services/companies.service";

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return fallback;
}

export default function MyCompanyPage() {
  const { user, isReady } = useAuth();
  const [form, setForm] = useState<MyCompanyProfile>(emptyMyCompanyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    const fn = () => {
      const p = getMyCompanyProfile();
      if (p) setForm(p);
    };
    window.addEventListener(MY_COMPANY_PROFILE_CHANGED_EVENT, fn);
    return () => window.removeEventListener(MY_COMPANY_PROFILE_CHANGED_EVENT, fn);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const ac = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await getCompaniesFromApi({ signal: ac.signal });
        if (ac.signal.aborted) return;
        const local = getMyCompanyProfile();
        const row = list[0];
        if (row) {
          const merged = companyApiRowToMyCompanyProfile(row, local);
          setForm(merged);
          saveMyCompanyProfile(merged);
        } else {
          const fallback = local ?? emptyMyCompanyProfile;
          setForm(fallback);
          if (!local) {
            setError("No hay empresa en el servidor. Comprueba /api/Companies.");
          }
        }
      } catch (e) {
        if (ac.signal.aborted) return;
        setError(errorMessage(e, "Error al cargar la empresa."));
        const local = getMyCompanyProfile();
        setForm(local ?? emptyMyCompanyProfile);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [isReady, user]);

  const onChange = (k: keyof MyCompanyProfile, v: string) =>
    setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/90 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Mi empresa
        </p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
          Datos para partes e informes
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Los datos se cargan con <strong>GET /api/Companies</strong> y puedes guardarlos en el servidor con{" "}
          <strong>PUT /api/Companies/{"{id}"}</strong>. Se usan como cabecera en partes (PDF) e informes.
        </p>

        {loading && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Cargando datos de la empresa…</p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Nombre comercial
            </label>
            <input
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Nombre comercial"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Razón social
            </label>
            <input
              value={form.fiscalName ?? ""}
              onChange={(e) => onChange("fiscalName", e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Sociedad mercantil S.L."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              CIF / NIF
            </label>
            <input
              value={form.taxId}
              onChange={(e) => onChange("taxId", e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="B12345678"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Teléfono
            </label>
            <input
              value={form.phone}
              onChange={(e) => onChange("phone", e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="+34 600 000 000"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Email
            </label>
            <input
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="info@ejemplo.es"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Web
            </label>
            <input
              value={form.website}
              onChange={(e) => onChange("website", e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="https://…"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Dirección
            </label>
            <input
              value={form.address}
              onChange={(e) => onChange("address", e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Calle…, CP…, Ciudad…"
            />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-900/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Logo
              </p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                Logo del servidor (si viene en la API) o imagen subida aquí para cabecera PDF (se
                redimensiona al subir).
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-agro-600 bg-white px-3 py-2 text-xs font-semibold text-agro-800 hover:bg-agro-50 dark:border-agro-500 dark:bg-slate-800 dark:text-agro-200 dark:hover:bg-agro-900/30">
              Subir logo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={loading}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const data = await fileToResizedDataUrl(f);
                    setForm((s) => ({ ...s, logoDataUrl: data }));
                    setError(null);
                    setOkMsg("Logo cargado.");
                  } catch {
                    setError("No se pudo leer el logo.");
                    setOkMsg(null);
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>
          {form.logoDataUrl ? (
            <div className="mt-3">
              <img
                src={form.logoDataUrl}
                alt="Logo de mi empresa"
                className="max-h-20 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-600"
              />
              <button
                type="button"
                onClick={() => setForm((s) => ({ ...s, logoDataUrl: undefined }))}
                className="mt-2 text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
              >
                Quitar logo subido
              </button>
            </div>
          ) : form.logoUrl ? (
            <div className="mt-3">
              <img
                src={form.logoUrl}
                alt="Logo de mi empresa"
                className="max-h-20 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-600"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Logo procedente del servidor.</p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Sin logo.</p>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {okMsg && <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{okMsg}</p>}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={saving || loading || !form.companyId}
            onClick={async () => {
              const id = form.companyId;
              if (!id) {
                setError("No hay empresa cargada. Recarga la página.");
                return;
              }
              setSaving(true);
              setError(null);
              setOkMsg(null);
              try {
                const body = buildMyCompanyPutBody(form);
                const row = await putCompanyOnApi(id, body);
                const merged = companyApiRowToMyCompanyProfile(row, form);
                setForm(merged);
                saveMyCompanyProfile(merged);
                setOkMsg("Datos actualizados en el servidor.");
              } catch (e) {
                setError(errorMessage(e, "Error al actualizar."));
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white hover:bg-agro-700 disabled:opacity-50"
          >
            {saving ? "Actualizando…" : "Actualizar datos"}
          </button>
        </div>
      </div>
    </div>
  );
}
