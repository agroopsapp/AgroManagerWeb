"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface FeaturesContextType {
  enableAnimals: boolean;
  setEnableAnimals: (value: boolean) => void;
}

const STORAGE_KEY = "agromanager_features";

const FeaturesContext = createContext<FeaturesContextType | undefined>(undefined);

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const [enableAnimals, setEnableAnimalsState] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as { enableAnimals?: boolean } | null;
      if (typeof parsed?.enableAnimals === "boolean") {
        setEnableAnimalsState(parsed.enableAnimals);
      }
    } catch {
      // ignorar errores de parseo
    }
  }, []);

  const setEnableAnimals = (value: boolean) => {
    setEnableAnimalsState(value);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ enableAnimals: value }));
      } catch {
        // ignorar errores de escritura
      }
    }
  };

  return (
    <FeaturesContext.Provider value={{ enableAnimals, setEnableAnimals }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures() {
  const ctx = useContext(FeaturesContext);
  if (ctx === undefined) {
    throw new Error("useFeatures must be used within FeaturesProvider");
  }
  return ctx;
}

