"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => ({ default: m.ResponsiveContainer })),
  { ssr: false, loading: () => <div className="h-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" /> }
);
const PieChart = dynamic(
  () => import("recharts").then((m) => ({ default: m.PieChart })),
  { ssr: false }
);
const Pie = dynamic(
  () => import("recharts").then((m) => ({ default: m.Pie })),
  { ssr: false }
);
const Cell = dynamic(
  () => import("recharts").then((m) => ({ default: m.Cell })),
  { ssr: false }
);
import { useTasks } from "@/contexts/TasksContext";
import { useFeatures } from "@/contexts/FeaturesContext";
import { useAuth } from "@/contexts/AuthContext";
import { MOCK_ANIMAL_CASES, MOCK_ANIMALS, MOCK_FARMS, MOCK_WORKERS } from "@/data/mock";
import { USER_ROLE } from "@/types";
import {
  FICHADOR_STORAGE_KEY,
  leerResumenImputacionParaFecha,
  formatDuracionImputacionEs,
} from "@/lib/fichadorStorage";
import type { ResumenImputacionHoy } from "@/lib/fichadorStorage";

const WEEKDAY_NAMES_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateES(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getWeekDays(referenceDate: string) {
  const ref = new Date(referenceDate + "T12:00:00");
  const jsDay = ref.getDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = addDays(referenceDate, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(monday, i);
    const d = new Date(iso + "T12:00:00");
    return {
      iso,
      dayNum: d.getDate(),
      label: WEEKDAY_NAMES_ES[i],
    };
  });
}

// Worker id mapping (mock data uses string ids like "w1" -> workerId 1)
const WORKER_ID_MAP: Record<string, number> = { w1: 1, w2: 2, w3: 3, w4: 4 };
const WORKER_NAME_MAP: Record<string, string> = { w1: "Juan", w2: "Pedro", w3: "Luis", w4: "Ana" };

export default function ManagerPage() {
  const { user, isReady } = useAuth();
  const { enableAnimals } = useFeatures();
  const { tasks, generalTasks } = useTasks();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [fichadorVersion, setFichadorVersion] = useState(0);

  useEffect(() => {
    if (!isReady) return;
    if (!user) { router.replace("/login"); return; }
    if (user.role === USER_ROLE.Worker) { router.replace("/dashboard/tasks"); return; }
  }, [user, isReady, router]);

  // Re-read fichador when localStorage changes
  useEffect(() => {
    const handler = () => setFichadorVersion((v) => v + 1);
    window.addEventListener("storage", handler);
    window.addEventListener("agromanager-workparts-changed", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("agromanager-workparts-changed", handler);
    };
  }, []);

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  // ── Tasks for selected day ──
  const dayTasks = useMemo(
    () => tasks.filter((t) => t.date === selectedDate),
    [tasks, selectedDate]
  );

  const tareasRetrasadas = useMemo(() => {
    const today = todayISO();
    return tasks.filter(
      (t) => t.status !== "completed" && t.date < today
    ).length;
  }, [tasks]);

  const tareasSinAsignar = useMemo(
    () => generalTasks.length,
    [generalTasks]
  );

  // ── Animals KPI ──
  const animalesSinTratamiento = useMemo(() => {
    if (!enableAnimals) return 0;
    return MOCK_ANIMAL_CASES.filter(
      (c) => c.status === "reported" || c.status === "in_treatment"
    ).length;
  }, [enableAnimals]);

  // ── Imputación alertas (fichador) ──
  const alertasImputacion = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    fichadorVersion; // dependency trigger
    return MOCK_WORKERS.map((w) => {
      const numericId = WORKER_ID_MAP[w.id] ?? 0;
      const resumen = leerResumenImputacionParaFecha(numericId, selectedDate);
      return { ...w, resumen };
    });
  }, [selectedDate, fichadorVersion]);

  const operariosConImputacionIncompleta = useMemo(
    () =>
      alertasImputacion.filter(
        (w) =>
          w.resumen.estado === "sin_imputar" ||
          w.resumen.estado === "falta_salida"
      ).length,
    [alertasImputacion]
  );

  // ── Tasks by farm ──
  const farmStats = useMemo(() => {
    return MOCK_FARMS.map((farm) => {
      const farmTasks = dayTasks.filter((t) => t.farmName === farm.name);
      const retrasadas = farmTasks.filter(
        (t) => t.status !== "completed" && t.date < todayISO()
      ).length;
      const enCurso = farmTasks.filter((t) => t.status === "in_progress").length;
      const incidencias = enableAnimals
        ? MOCK_ANIMAL_CASES.filter((c) => {
            const animal = MOCK_ANIMALS.find((a) => a.id === c.animalId);
            return animal?.farmId === farm.id && c.status !== "resolved";
          }).length
        : 0;
      const activos = farmTasks.filter((t) => t.status !== "completed").length;
      return {
        name: farm.name,
        total: farmTasks.length,
        retrasadas,
        enCurso,
        incidencias,
        activos,
      };
    });
  }, [dayTasks, enableAnimals]);

  // ── PieChart data ──
  const statusPieData = useMemo(() => {
    const ready = dayTasks.filter((t) => t.status === "ready").length;
    const inProgress = dayTasks.filter((t) => t.status === "in_progress").length;
    const completed = dayTasks.filter((t) => t.status === "completed").length;
    return [
      { name: "Pendientes", value: ready, fill: "#f59e0b" },
      { name: "En curso", value: inProgress, fill: "#3b82f6" },
      { name: "Completadas", value: completed, fill: "#22c55e" },
    ].filter((d) => d.value > 0);
  }, [dayTasks]);

  // ── Urgencias globales ──
  const urgenciasGlobales = useMemo(() => {
    const today = todayISO();
    const items: { type: string; label: string; severity: "high" | "medium" | "low" }[] = [];
    tasks
      .filter((t) => t.status !== "completed" && t.date < today)
      .slice(0, 3)
      .forEach((t) => {
        items.push({
          type: "Tarea retrasada",
          label: `${t.title} — ${WORKER_NAME_MAP[t.workerId] ?? "Sin asignar"}`,
          severity: t.priority === "high" ? "high" : "medium",
        });
      });
    if (enableAnimals) {
      MOCK_ANIMAL_CASES.filter((c) => c.severity === "high" && c.status !== "resolved")
        .slice(0, 2)
        .forEach((c) => {
          const animal = MOCK_ANIMALS.find((a) => a.id === c.animalId);
          items.push({
            type: "Incidencia animal",
            label: `${c.caseType} — ${animal?.name ?? "Desconocido"}`,
            severity: "high",
          });
        });
    }
    return items;
  }, [tasks, enableAnimals]);

  // ── Workers without tasks today ──
  const empleadosSinTareas = useMemo(() => {
    return MOCK_WORKERS.filter(
      (w) => !dayTasks.some((t) => t.workerId === w.id)
    );
  }, [dayTasks]);

  if (!isReady || !user) return null;

  function imputacionLabel(resumen: ResumenImputacionHoy): {
    text: string;
    color: string;
  } {
    if (resumen.estado === "completa") {
      if (resumen.esAusencia) return { text: "Día imputado como ausencia", color: "text-amber-600" };
      return { text: "Imputación correcta", color: "text-emerald-600" };
    }
    if (resumen.estado === "falta_salida") return { text: "Falta salida", color: "text-amber-600" };
    return { text: "Sin imputar", color: "text-rose-600" };
  }

  function imputacionHoraInfo(resumen: ResumenImputacionHoy): string | null {
    if (resumen.estado === "completa") {
      return `${resumen.horaEntradaLocal} - ${resumen.horaSalidaLocal} · ${formatDuracionImputacionEs(resumen.minutosEfectivos)}`;
    }
    if (resumen.estado === "falta_salida") {
      return `Sin entrada ni salida`;
    }
    return "Sin entrada ni salida";
  }

  const kpiSinAsignarOk = tareasSinAsignar === 0;

  return (
    <div className="min-w-0 max-w-full space-y-5">
      {/* ── Header ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-agro-600">
          Visión Manager
        </p>
        <h1 className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-white">
          Panel de Control Global
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {formatDateES(selectedDate)}
        </p>
      </div>

      {/* ── Week toolbar ── */}
      <div className="flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSelectedDate((d) => addDays(d, -7))}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => setSelectedDate((d) => addDays(d, 7))}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          →
        </button>
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
          Semana operativa
        </span>
        <div className="flex gap-1">
          {weekDays.map((wd) => (
            <button
              key={wd.iso}
              type="button"
              onClick={() => setSelectedDate(wd.iso)}
              className={`flex min-w-[72px] flex-col items-center rounded-full px-3 py-1.5 text-xs font-medium transition ${
                wd.iso === selectedDate
                  ? "bg-agro-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <span>{wd.label} {wd.dayNum}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Desviación de personal */}
        <div
          className={`rounded-xl border p-4 shadow-sm ${
            operariosConImputacionIncompleta > 0
              ? "border-rose-300 bg-rose-50 dark:border-rose-600 dark:bg-rose-950/30"
              : "border-emerald-300 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/30"
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Desviación de personal
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
            {operariosConImputacionIncompleta}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Operarios con imputación incompleta
          </p>
        </div>

        {/* Tareas retrasadas */}
        <div
          className={`rounded-xl border p-4 shadow-sm ${
            tareasRetrasadas > 0
              ? "border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
              : "border-emerald-300 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/30"
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Tareas retrasadas
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
            {tareasRetrasadas} <span className="text-lg font-bold opacity-60">totales</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {tareasRetrasadas === 0 ? "Sin retrasos" : "Requieren atención"}
          </p>
        </div>

        {/* Animales sin tratamiento */}
        {enableAnimals && (
          <div
            className={`rounded-xl border p-4 shadow-sm ${
              animalesSinTratamiento > 0
                ? "border-rose-300 bg-rose-50 dark:border-rose-600 dark:bg-rose-950/30"
                : "border-emerald-300 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/30"
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Animales sin tratamiento
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
              {animalesSinTratamiento} <span className="text-lg font-bold opacity-60">casos</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Pendientes de reasignación vet.
            </p>
          </div>
        )}

        {/* Tareas sin asignar */}
        <div
          className={`rounded-xl border p-4 shadow-sm ${
            !kpiSinAsignarOk
              ? "border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
              : "border-emerald-300 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/30"
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Tareas sin asignar
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
            {tareasSinAsignar} <span className="text-lg font-bold opacity-60">totales</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {kpiSinAsignarOk ? "Todas asignadas" : "Reasignar →"}
          </p>
          {!kpiSinAsignarOk && (
            <Link
              href="/dashboard/unassigned-tasks"
              className="mt-2 inline-block text-xs font-bold text-slate-700 underline-offset-2 hover:underline"
            >
              {kpiSinAsignarOk ? "Revisar tareas" : "Reasignar "}
            </Link>
          )}
        </div>
      </div>

      {/* ── Main grid: Alertas + Granjas ── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        {/* Left: Alertas de imputación */}
        <div className="space-y-4">
          <div
            className={`rounded-xl border p-4 shadow-sm ${
              operariosConImputacionIncompleta > 0
                ? "border-rose-300 bg-white dark:border-rose-600 dark:bg-slate-800"
                : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
            }`}
          >
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              Alertas de imputación
            </h2>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
              {alertasImputacion.map((w) => {
                const info = imputacionLabel(w.resumen);
                const horaInfo = imputacionHoraInfo(w.resumen);
                return (
                  <div key={w.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {w.name}
                      </p>
                      {horaInfo && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {horaInfo}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs font-bold ${info.color}`}>
                      {info.text}
                    </span>
                  </div>
                );
              })}
            </div>
            <Link
              href="/dashboard/time-tracking"
              className="mt-3 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            >
              Ver fichador
            </Link>
          </div>

          {/* Últimas urgencias */}
          {urgenciasGlobales.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                Últimas urgencias globales
              </h2>
              <div className="mt-3 space-y-2">
                {urgenciasGlobales.map((u, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      u.severity === "high"
                        ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-200"
                        : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
                    }`}
                  >
                    <span className="font-bold">{u.type}:</span> {u.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Usuarios sin tarea */}
          {empleadosSinTareas.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                Usuarios sin tarea
              </h2>
              <div className="mt-3 space-y-2">
                {empleadosSinTareas.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {w.name}
                      </p>
                      <p className="text-xs font-semibold text-slate-600/80 mt-1">No tiene tareas asignadas.</p>
                    </div>
                    <span className="text-xs font-bold text-amber-600">Sin tareas</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Por granja + PieChart */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              Por granja
            </h2>
            <div className="mt-3 space-y-3">
              {farmStats.map((farm) => (
                <div
                  key={farm.name}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {farm.name}
                    </p>
                    <span className="text-xs font-medium text-slate-500">{farm.total} tareas</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        farm.retrasadas > 0
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {farm.retrasadas} retrasadas
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        farm.enCurso > 0
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {farm.enCurso} en curso
                    </span>
                    {enableAnimals && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          farm.incidencias > 0
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                        }`}
                      >
                        {farm.incidencias} incidencias
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                      {farm.activos} activos
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/dashboard/tasks"
              className="mt-3 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            >
              Ver tareas →
            </Link>
          </div>

          {/* PieChart distribución por estado */}
          {statusPieData.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                Distribución tareas del día
              </h2>
              <div className="flex items-center gap-6">
                <div className="h-36 w-36 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        paddingAngle={3}
                      >
                        {statusPieData.map((entry, idx) => (
                          <Cell key={`${entry.name}-${idx}`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5">
                  {statusPieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: d.fill }}
                      />
                      <span className="text-slate-700 dark:text-slate-300">
                        {d.name}: <strong>{d.value}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
