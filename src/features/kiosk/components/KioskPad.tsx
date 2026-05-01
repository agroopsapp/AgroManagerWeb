"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KioskPunchResult } from "../types";

function actionLabel(action: KioskPunchResult["action"]): string {
  return action === "checkIn" ? "Entrada" : "Salida";
}

function formatLocalTimeFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function KioskPad({
  title,
  status,
  error,
  lastResult,
  onSubmitCode,
  onReset,
}: {
  title?: string;
  status: "idle" | "loading" | "success" | "error";
  error: string;
  lastResult: KioskPunchResult | null;
  onSubmitCode: (code: string) => Promise<void>;
  onReset: () => void;
}) {
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (status !== "success") return;
    const t = setTimeout(() => {
      setCode("");
      onReset();
      inputRef.current?.focus();
    }, 2200);
    return () => clearTimeout(t);
  }, [status, onReset]);

  const masked = useMemo(() => "•".repeat(code.length), [code.length]);

  const canInteract = status !== "loading" && status !== "success";

  const submit = async () => {
    if (!canInteract) return;
    await onSubmitCode(code);
  };

  const pushDigit = (d: string) => {
    if (!canInteract) return;
    if (code.length >= 8) return;
    setCode((prev) => `${prev}${d}`);
    inputRef.current?.focus();
  };

  const backspace = () => {
    if (!canInteract) return;
    setCode((prev) => prev.slice(0, -1));
    inputRef.current?.focus();
  };

  const clear = () => {
    if (!canInteract) return;
    setCode("");
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title ?? "Fichador"}
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
              Introduce tu código y pulsa OK.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-500 dark:text-slate-300">Estado</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
              {status === "idle" && "Listo"}
              {status === "loading" && "Procesando…"}
              {status === "success" && "Registrado"}
              {status === "error" && "Error"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            className="sr-only"
            aria-label="Código"
          />
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold tracking-widest text-slate-900 dark:text-slate-100">
              {masked || "—"}
            </p>
            <button
              type="button"
              onClick={backspace}
              disabled={!canInteract || code.length === 0}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Borrar
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {status === "success" && lastResult ? (
          <div className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-200">
            <p className="font-semibold">
              {actionLabel(lastResult.action)} registrada · {lastResult.displayName}
              {lastResult.atUtc ? ` · ${formatLocalTimeFromIso(lastResult.atUtc)}` : ""}
            </p>
            {lastResult.message ? <p className="mt-0.5 opacity-90">{lastResult.message}</p> : null}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => pushDigit(d)}
              disabled={!canInteract}
              className="h-14 rounded-xl border border-slate-200 bg-white text-lg font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={clear}
            disabled={!canInteract || code.length === 0}
            className="h-14 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => pushDigit("0")}
            disabled={!canInteract}
            className="h-14 rounded-xl border border-slate-200 bg-white text-lg font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            0
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canInteract || code.trim().length === 0}
            className="h-14 rounded-xl bg-agro-600 text-sm font-semibold text-white shadow-sm hover:bg-agro-700 disabled:opacity-60"
          >
            OK
          </button>
        </div>

        <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-300">
          Este modo no requiere inicio de sesión.
        </p>
      </div>
    </div>
  );
}

