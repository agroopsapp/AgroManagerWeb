"use client";

import { useEffect } from "react";

export function PwaProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // Silenciar errores de registro
      }
    };

    register();
  }, []);

  return null;
}

