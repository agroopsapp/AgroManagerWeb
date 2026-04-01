"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFeatures } from "@/contexts/FeaturesContext";

export default function TimeTrackingLayout({ children }: { children: React.ReactNode }) {
  const { enableTimeTracking } = useFeatures();
  const router = useRouter();

  useEffect(() => {
    if (!enableTimeTracking) {
      router.replace("/dashboard");
    }
  }, [enableTimeTracking, router]);

  if (!enableTimeTracking) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center text-slate-600 dark:text-slate-400">
        <p className="text-sm font-medium">El registro de jornada no está activo.</p>
        <p className="text-xs text-slate-500 dark:text-slate-500">Redirigiendo al panel…</p>
      </div>
    );
  }

  return children;
}
