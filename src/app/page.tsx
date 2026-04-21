"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatures } from "@/contexts/FeaturesContext";
import { appHomePath } from "@/lib/dashboardNavGating";

export default function Home() {
  const { user, isReady } = useAuth();
  const { enableTimeTracking, enableOperativaYAnalisisMenu } = useFeatures();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (user) {
      router.replace(appHomePath(user.role, enableTimeTracking, enableOperativaYAnalisisMenu));
    } else {
      router.replace("/login");
    }
  }, [user, isReady, router, enableTimeTracking, enableOperativaYAnalisisMenu]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center dark:bg-slate-900">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-agro-500 border-t-transparent" aria-hidden />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Cargando aplicación…</p>
    </div>
  );
}
