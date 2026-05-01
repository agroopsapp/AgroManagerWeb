"use client";

import { useEffect, useMemo, useState } from "react";
import { clearKioskToken, getKioskToken, setKioskToken } from "@/lib/kiosk-api-client";
import { KioskDisabled } from "@/features/kiosk/components/KioskDisabled";

function maskToken(token: string): string {
  if (token.length <= 10) return "•".repeat(token.length);
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

export default function KioskSetupPage() {
  const enableKiosk = process.env.NEXT_PUBLIC_ENABLE_KIOSK === "true";
  if (!enableKiosk) return <KioskDisabled />;

  const [token, setToken] = useState("");
  const [savedToken, setSavedTokenState] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    setSavedTokenState(getKioskToken());
  }, []);

  const savedMasked = useMemo(
    () => (savedToken ? maskToken(savedToken) : "—"),
    [savedToken],
  );

  const save = () => {
    setMessage("");
    const t = token.trim();
    if (!t) {
      setMessage("Pega el token del kiosco.");
      return;
    }
    setKioskToken(t);
    setSavedTokenState(getKioskToken());
    setToken("");
    setMessage("Token guardado en esta tablet.");
  };

  const clear = () => {
    clearKioskToken();
    setSavedTokenState(getKioskToken());
    setMessage("Token borrado. Esta tablet ya no puede fichar hasta configurar otro.");
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Configurar kiosco (tablet)
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Pega aquí el token generado para esta empresa. Se guarda localmente en esta tablet.
        </p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300">
            Token actual
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {savedMasked}
          </p>
        </div>

        {message ? (
          <div className="mt-3 rounded-xl bg-slate-900/5 px-3 py-2 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-100">
            {message}
          </div>
        ) : null}

        <div className="mt-4">
          <label
            htmlFor="kioskToken"
            className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300"
          >
            Nuevo token
          </label>
          <input
            id="kioskToken"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="kiosk_live_..."
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-xl bg-agro-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-agro-700"
          >
            Guardar token
          </button>
          <button
            type="button"
            onClick={clear}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Borrar token
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-300">
          Nota: si cambias de empresa, debes configurar el token nuevo (cada empresa tendrá uno distinto).
        </p>
      </div>
    </div>
  );
}

