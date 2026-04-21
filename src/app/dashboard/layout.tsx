"use client";

import { Suspense } from "react";
import DashboardPathnameShell from "./DashboardPathnameShell";

/** Suspense: el shell que llama a `usePathname` es un módulo aparte (`DashboardPathnameShell`);
 *  sin boundary, en dev (Turbopack) a veces falla el SSR con `useContext` nulo. */
function DashboardShellFallback() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-agro-500 border-t-transparent" />
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardShellFallback />}>
      <DashboardPathnameShell>{children}</DashboardPathnameShell>
    </Suspense>
  );
}
