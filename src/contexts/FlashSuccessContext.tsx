"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const DEFAULT_MESSAGE = "Cambios guardados correctamente.";

type FlashSuccessContextValue = {
  /** Muestra un aviso verde fijo (p. ej. tras guardar en API). Texto por defecto si omites el mensaje. */
  showSuccess: (message?: string) => void;
};

const FlashSuccessContext = createContext<FlashSuccessContextValue | null>(null);

export function useFlashSuccess(): FlashSuccessContextValue {
  const ctx = useContext(FlashSuccessContext);
  if (!ctx) {
    return {
      showSuccess: () => {
        /* sin provider (tests / páginas fuera del dashboard): no-op */
      },
    };
  }
  return ctx;
}

const AUTO_HIDE_MS = 3200;

export function FlashSuccessProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<{ message: string; id: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const showSuccess = useCallback((message?: string) => {
    const text = (message?.trim() || DEFAULT_MESSAGE).trim() || DEFAULT_MESSAGE;
    clearTimer();
    setPayload((p) => ({ message: text, id: (p?.id ?? 0) + 1 }));
    timerRef.current = setTimeout(() => {
      setPayload(null);
      timerRef.current = null;
    }, AUTO_HIDE_MS);
  }, []);

  useEffect(() => () => clearTimer(), []);

  const value = useMemo(() => ({ showSuccess }), [showSuccess]);

  return (
    <FlashSuccessContext.Provider value={value}>
      {children}
      {payload ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-3 z-[200] flex justify-center px-3 sm:top-4"
          aria-live="polite"
          aria-atomic="true"
        >
          <div
            key={payload.id}
            role="status"
            className="pointer-events-auto max-w-[min(100%,28rem)] rounded-lg border border-emerald-300/90 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-900/10 dark:border-emerald-700/80 dark:bg-emerald-950/90 dark:text-emerald-50 dark:shadow-black/40"
          >
            {payload.message}
          </div>
        </div>
      ) : null}
    </FlashSuccessContext.Provider>
  );
}
