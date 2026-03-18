"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

type FeaturesState = {
  enableAnimals: boolean;
  /** Fichador / registro de jornada (premium); lo activa solo SuperAdmin en Ajustes. */
  enableTimeTracking: boolean;
};

interface FeaturesContextType extends FeaturesState {
  setEnableAnimals: (value: boolean) => void;
  setEnableTimeTracking: (value: boolean) => void;
}

const STORAGE_KEY = "agromanager_features";

const DEFAULT_FEATURES: FeaturesState = {
  enableAnimals: true,
  enableTimeTracking: true,
};

const FeaturesContext = createContext<FeaturesContextType | undefined>(undefined);

function readStored(): FeaturesState {
  if (typeof window === "undefined") return DEFAULT_FEATURES;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_FEATURES;
    const parsed = JSON.parse(stored) as Partial<FeaturesState> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_FEATURES;
    return {
      enableAnimals:
        typeof parsed.enableAnimals === "boolean"
          ? parsed.enableAnimals
          : DEFAULT_FEATURES.enableAnimals,
      enableTimeTracking:
        typeof parsed.enableTimeTracking === "boolean"
          ? parsed.enableTimeTracking
          : DEFAULT_FEATURES.enableTimeTracking,
    };
  } catch {
    return DEFAULT_FEATURES;
  }
}

function persist(state: FeaturesState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FeaturesState>(DEFAULT_FEATURES);

  useEffect(() => {
    setState(readStored());
  }, []);

  const setEnableAnimals = useCallback((value: boolean) => {
    setState((s) => {
      const next = { ...s, enableAnimals: value };
      persist(next);
      return next;
    });
  }, []);

  const setEnableTimeTracking = useCallback((value: boolean) => {
    setState((s) => {
      const next = { ...s, enableTimeTracking: value };
      persist(next);
      return next;
    });
  }, []);

  return (
    <FeaturesContext.Provider
      value={{
        enableAnimals: state.enableAnimals,
        enableTimeTracking: state.enableTimeTracking,
        setEnableAnimals,
        setEnableTimeTracking,
      }}
    >
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
