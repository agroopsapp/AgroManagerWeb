"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { workerIdForLoggedUser } from "@/lib/fichajeWorker";
import { USER_ROLE } from "@/types";
import type { UserRole } from "@/types";

type AuthUser = { id: string; email: string; role: UserRole } | null;

interface Params {
  user: AuthUser;
  isReady: boolean;
}

export function useFichadorPanel({ user, isReady }: Params) {
  // useRouter no requiere Suspense; useSearchParams sí — lo evitamos leyendo
  // directamente desde window.location.search en el efecto (solo cliente).
  const router = useRouter();

  const miWorkerId = useMemo(
    () => workerIdForLoggedUser(user),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, user?.email]
  );

  const canVerEquipo =
    user?.role === USER_ROLE.Admin ||
    user?.role === USER_ROLE.SuperAdmin ||
    user?.role === USER_ROLE.Manager;

  const [fichadorPanel, setFichadorPanel] = useState<"personal" | "equipo">("personal");

  const setFichadorPanelWithUrl = useCallback(
    (panel: "personal" | "equipo") => {
      setFichadorPanel(panel);
      if (panel === "equipo" && canVerEquipo) {
        router.replace("/dashboard/time-tracking?panel=equipo", { scroll: false });
      } else {
        router.replace("/dashboard/time-tracking", { scroll: false });
      }
    },
    [router, canVerEquipo]
  );

  // Leer el parámetro ?panel= directamente desde window.location.search
  // evita llamar a useSearchParams() en page.tsx, que obliga a Next.js a
  // suspender toda la ruta antes del primer paint.
  useEffect(() => {
    if (!isReady || !user) return;
    const params = new URLSearchParams(window.location.search);
    const p = params.get("panel");
    setFichadorPanel(p === "equipo" && canVerEquipo ? "equipo" : "personal");
  }, [isReady, user, canVerEquipo]);

  return { fichadorPanel, setFichadorPanelWithUrl, miWorkerId, canVerEquipo };
}
