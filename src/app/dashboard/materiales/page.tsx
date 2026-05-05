"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Acceso directo histórico a "Materiales".
 * Hoy los materiales viven dentro de Partes de obra (mock), así que redirigimos allí.
 */
export default function MaterialesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/time-tracking/partes-de-obra");
  }, [router]);

  return null;
}

