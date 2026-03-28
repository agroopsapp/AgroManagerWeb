"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLE } from "@/types";

export default function TeamHoursPage() {
  const { user, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!user) router.replace("/login");
    if (user?.role === USER_ROLE.Worker) router.replace("/dashboard/tasks");
  }, [user, isReady, router]);

  if (!isReady || !user) return null;

  return (
    <div className="min-w-0 max-w-full space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-agro-600 dark:text-agro-400">
          Horas del equipo
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
          Horas del equipo
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Próximamente: historial de horas imputadas por trabajadores.
        </p>
      </div>
    </div>
  );
}
