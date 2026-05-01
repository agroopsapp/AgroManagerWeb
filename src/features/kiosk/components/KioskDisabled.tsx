"use client";

import Link from "next/link";

export function KioskDisabled() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Kiosko deshabilitado</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Este modo está bloqueado temporalmente y no se puede utilizar ahora mismo.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/"
            className="flex-1 rounded-xl bg-agro-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-agro-700"
          >
            Ir al inicio
          </Link>
          <Link
            href="/dashboard/time-tracking"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Ir a Jornada
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-300">
          Para reactivarlo, define <code className="font-mono">NEXT_PUBLIC_ENABLE_KIOSK=true</code> en el{" "}
          <code className="font-mono">.env</code>.
        </p>
      </div>
    </div>
  );
}

