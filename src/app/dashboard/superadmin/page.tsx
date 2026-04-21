"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SuperadminApiErrorsPanel } from "@/features/superadmin/components/SuperadminApiErrorsPanel";
import { SuperadminParentCompaniesPanel } from "@/features/superadmin/components/SuperadminParentCompaniesPanel";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE } from "@/types";

type Tab = "companies" | "errors";

export default function SuperadminPage() {
  const { user, isReady } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("companies");

  useEffect(() => {
    if (!isReady) return;
    if (!user || user.role !== USER_ROLE.SuperAdmin) {
      router.replace("/dashboard");
    }
  }, [isReady, user, router]);

  if (!isReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-agro-500 border-t-transparent" />
      </div>
    );
  }

  if (user?.role !== USER_ROLE.SuperAdmin) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        Esta sección solo está disponible para el rol <strong>SuperAdmin</strong>. Redirigiendo al panel…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40 md:p-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Superadministración</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Gestión de empresas padre y consulta de errores registrados por la API. Las peticiones van a{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-900">/api/superadmin/…</code> con el
          JWT de sesión; el backend exige rol Superadmin (403 si no aplica).
        </p>
        <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200/90">
          La interfaz oculta esta ruta a otros roles, pero la seguridad real está en el servidor: nunca confíes solo en
          el frontend.
        </p>
      </div>

      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm dark:border-slate-600 dark:bg-slate-800/80">
        <button
          type="button"
          onClick={() => setTab("companies")}
          className={`rounded-md px-4 py-2 font-semibold transition ${
            tab === "companies"
              ? "bg-agro-600 text-white dark:bg-agro-500"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          Empresas padre
        </button>
        <button
          type="button"
          onClick={() => setTab("errors")}
          className={`rounded-md px-4 py-2 font-semibold transition ${
            tab === "errors"
              ? "bg-agro-600 text-white dark:bg-agro-500"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          Errores API
        </button>
      </div>

      {tab === "companies" && <SuperadminParentCompaniesPanel active />}
      {tab === "errors" && <SuperadminApiErrorsPanel active />}
    </div>
  );
}
