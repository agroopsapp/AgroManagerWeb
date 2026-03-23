"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useFeatures } from "@/contexts/FeaturesContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  FICHADOR_STORAGE_KEY,
  leerResumenImputacionHoy,
  formatDuracionImputacionEs,
  type ResumenImputacionHoy,
} from "@/lib/fichadorStorage";
import { workerIdForLoggedUser } from "@/lib/fichajeWorker";

function TarjetaAviso({
  children,
  className = "",
  comfortable,
}: {
  children: React.ReactNode;
  className?: string;
  comfortable?: boolean;
}) {
  const pad = comfortable ? "px-4 py-4" : "px-3 py-2.5";
  const base = comfortable ? "text-sm" : "text-xs";
  return (
    <div
      className={`rounded-xl border border-slate-100 bg-slate-50/80 shadow-sm dark:border-slate-600 dark:bg-slate-800/60 ${pad} ${base} ${className}`}
    >
      {children}
    </div>
  );
}

type AvisosVariant = "default" | "comfortable";

export default function DashboardAvisos({ variant = "default" }: { variant?: AvisosVariant }) {
  const comfortable = variant === "comfortable";
  const { enableTimeTracking } = useFeatures();
  const { user, isReady } = useAuth();
  const pathname = usePathname();
  const [resumen, setResumen] = useState<ResumenImputacionHoy | "pendiente">("pendiente");
  const workerId = workerIdForLoggedUser(user);

  useEffect(() => {
    if (!enableTimeTracking || typeof window === "undefined" || !isReady) {
      setResumen("pendiente");
      return;
    }
    const sync = () => setResumen(leerResumenImputacionHoy(workerId));
    sync();
    const onFocus = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === FICHADOR_STORAGE_KEY) sync();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [enableTimeTracking, pathname, isReady, workerId]);

  const linkClass = comfortable
    ? "mt-3 inline-block text-sm font-semibold text-agro-700 underline-offset-2 hover:underline dark:text-agro-400"
    : "mt-2 inline-block text-[11px] font-semibold text-agro-700 underline-offset-2 hover:underline dark:text-agro-400";
  const linkUrgent = comfortable
    ? "mt-3 inline-block text-sm font-bold text-amber-900 underline-offset-2 hover:underline dark:text-amber-300"
    : "mt-2.5 inline-block text-[11px] font-bold text-amber-900 underline-offset-2 hover:underline dark:text-amber-300";

  return (
    <div
      className={`flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800 ${
        comfortable ? "min-h-[12rem]" : "h-full min-h-[11rem]"
      }`}
    >
      <div
        className={`flex shrink-0 items-center gap-2.5 border-b border-slate-100 dark:border-slate-700 ${
          comfortable ? "px-4 py-3.5" : "px-3 py-2"
        }`}
      >
        <span className={comfortable ? "text-lg" : "text-sm"} aria-hidden>
          📋
        </span>
        <div className="min-w-0">
          <h2
            className={
              comfortable
                ? "text-base font-bold text-slate-800 dark:text-slate-100"
                : "text-sm font-semibold text-slate-800 dark:text-slate-100"
            }
          >
            Imputación de hoy
          </h2>
          <p
            className={`text-slate-500 dark:text-slate-400 ${comfortable ? "text-xs" : "text-[10px]"}`}
          >
            Entrada, salida y jornada cerrada
          </p>
        </div>
      </div>
      <div className={`flex min-h-0 flex-1 flex-col ${comfortable ? "gap-3 p-4" : "gap-2 p-3"}`}>
        {enableTimeTracking && resumen === "pendiente" && (
          <TarjetaAviso
            comfortable={comfortable}
            className="animate-pulse border-slate-100 py-8 dark:border-slate-600"
          >
            <p
              className={`text-center text-slate-400 ${comfortable ? "text-sm" : "text-[11px]"}`}
            >
              Comprobando imputación…
            </p>
          </TarjetaAviso>
        )}
        {enableTimeTracking && resumen !== "pendiente" && resumen.estado === "sin_imputar" && (
          <TarjetaAviso
            comfortable={comfortable}
            className="border-amber-300/80 bg-amber-50/90 dark:border-amber-700/60 dark:bg-amber-950/35"
          >
            <div className={`flex ${comfortable ? "gap-3" : "gap-2"}`}>
              <span
                className={`shrink-0 leading-none ${comfortable ? "text-2xl" : "text-base"}`}
                aria-hidden
              >
                ⚠️
              </span>
              <div className="min-w-0">
                <p
                  className={
                    comfortable
                      ? "text-base font-bold leading-snug text-amber-950 dark:text-amber-100"
                      : "font-semibold text-amber-950 dark:text-amber-100"
                  }
                >
                  Imputación incompleta
                </p>
                <p
                  className={`text-amber-900/95 dark:text-amber-100/90 ${
                    comfortable ? "mt-2 text-sm leading-relaxed" : "mt-1.5 text-[11px] leading-snug"
                  }`}
                >
                  Aún no consta la <strong>entrada</strong> ni la <strong>salida</strong> de hoy.
                  Completa el fichaje en el fichador para cerrar la jornada.
                </p>
                <Link href="/dashboard/time-tracking" className={linkUrgent}>
                  Ir al fichador →
                </Link>
              </div>
            </div>
          </TarjetaAviso>
        )}
        {enableTimeTracking && resumen !== "pendiente" && resumen.estado === "falta_salida" && (
          <TarjetaAviso
            comfortable={comfortable}
            className="border-amber-200 bg-amber-50/70 dark:border-amber-800/50 dark:bg-amber-950/30"
          >
            <p
              className={
                comfortable
                  ? "text-base font-bold text-amber-950 dark:text-amber-100"
                  : "font-semibold text-amber-950 dark:text-amber-100"
              }
            >
              Falta cerrar la jornada
            </p>
            <p
              className={`text-amber-900/95 dark:text-amber-100/90 ${comfortable ? "mt-2 text-sm leading-relaxed" : "mt-1"}`}
            >
              Entrada registrada a las <strong>{resumen.horaEntradaLocal}</strong>. Falta registrar la{" "}
              <strong>salida</strong> para completar la imputación del día.
            </p>
            <Link href="/dashboard/time-tracking" className={linkClass}>
              Fichar salida →
            </Link>
          </TarjetaAviso>
        )}
        {enableTimeTracking && resumen !== "pendiente" && resumen.estado === "completa" && (
          <TarjetaAviso
            comfortable={comfortable}
            className="border-emerald-200/90 bg-emerald-50/80 dark:border-emerald-800/50 dark:bg-emerald-950/30"
          >
            <p
              className={
                comfortable
                  ? "text-base font-bold text-emerald-900 dark:text-emerald-100"
                  : "font-semibold text-emerald-900 dark:text-emerald-100"
              }
            >
              {resumen.esAusencia
                ? "Imputación registrada (día no laboral / ausencia)"
                : "Imputación correcta el día de hoy"}
            </p>
            {!resumen.esAusencia && (
              <div
                className={`mt-3 grid gap-2 rounded-lg bg-white/70 px-3 py-3 dark:bg-emerald-950/20 ${
                  comfortable ? "text-sm" : "text-xs"
                }`}
              >
                <div className="flex justify-between gap-3 border-b border-emerald-100/80 pb-2 dark:border-emerald-800/40">
                  <span className="font-medium text-emerald-800/90 dark:text-emerald-200/90">
                    Hora inicio
                  </span>
                  <span className="tabular-nums font-semibold text-emerald-950 dark:text-emerald-100">
                    {resumen.horaEntradaLocal}
                  </span>
                </div>
                <div className="flex justify-between gap-3 border-b border-emerald-100/80 pb-2 dark:border-emerald-800/40">
                  <span className="font-medium text-emerald-800/90 dark:text-emerald-200/90">
                    Hora fin
                  </span>
                  <span className="tabular-nums font-semibold text-emerald-950 dark:text-emerald-100">
                    {resumen.horaSalidaLocal}
                  </span>
                </div>
                <div className="flex justify-between gap-3 pt-0.5">
                  <span className="font-medium text-emerald-800/90 dark:text-emerald-200/90">
                    Horas totales
                  </span>
                  <span className="tabular-nums text-base font-bold text-emerald-800 dark:text-emerald-200">
                    {formatDuracionImputacionEs(resumen.minutosEfectivos)}
                  </span>
                </div>
                {resumen.minutosBrutos !== resumen.minutosEfectivos && resumen.minutosBrutos > 0 && (
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                    Bruto {formatDuracionImputacionEs(resumen.minutosBrutos)}
                    {resumen.minutosBrutos > resumen.minutosEfectivos
                      ? " (descontado descanso declarado)"
                      : ""}
                  </p>
                )}
              </div>
            )}
            {resumen.esAusencia && (
              <p
                className={`mt-2 text-emerald-800/90 dark:text-emerald-200/90 ${comfortable ? "text-sm" : "text-[11px]"}`}
              >
                El día figura imputado según el registro (vacaciones, baja u otro concepto).
              </p>
            )}
          </TarjetaAviso>
        )}
        {!enableTimeTracking && (
          <TarjetaAviso
            comfortable={comfortable}
            className="border-dashed border-slate-200 bg-transparent py-6 text-center dark:border-slate-600"
          >
            <p className={`text-slate-500 dark:text-slate-400 ${comfortable ? "text-sm" : ""}`}>
              El control de fichaje no está activo. No hay comprobación de imputación.
            </p>
          </TarjetaAviso>
        )}
      </div>
    </div>
  );
}
