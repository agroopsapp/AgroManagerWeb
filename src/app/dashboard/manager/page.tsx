"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts";
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

function getWeekDays(selectedDate: string) {
  const d = new Date(selectedDate + "T12:00:00");
  const dayOfWeek = d.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(d);
    date.setDate(d.getDate() + i);
    const iso = date.toISOString().slice(0, 10);
    return { iso, dayName: WEEKDAY_NAMES_ES[i], dayNum: date.getDate() };
  });
}

function workerNameByTaskWorkerId(taskWorkerId: string) {
  const m = taskWorkerId.match(/^w(\d+)$/i);
  if (!m) return "—";
  const idx = Number(m[1]);
  return MOCK_WORKERS.find((w) => w.id === `w${idx}`)?.name ?? `Operario ${idx}`;
}

function workerNumericIdFromTaskWorkerId(taskWorkerId: string): number | null {
  const m = taskWorkerId.match(/^w(\d+)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function daysDiffLabel(selectedDate: string, itemDate: string) {
  const a = new Date(selectedDate + "T12:00:00").getTime();
  const b = new Date(itemDate + "T12:00:00").getTime();
  const diffDays = Math.round((a - b) / 86400000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays > 1) return `Hace ${diffDays} días`;
  return "Pendiente";
}

function isWeekendISO(iso: string): boolean {
  const d = new Date(iso + "T12:00:00");
  const day = d.getDay();
  return day === 0 || day === 6;
}

function formatHoraLocalEs(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** Determinista (para mock por fecha) */
function hashUnit(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // 0..1
  return ((h >>> 0) % 100000) / 100000;
}

function demoResumenImputacionParaFecha(
  workerId: number,
  workDate: string,
  objectiveHoursTotal: number
): ResumenImputacionHoy {
  // reparto de estados: sin imputar / falta salida / completa
  const roll = hashUnit(`${workerId}|${workDate}|estado`) * 100;

  // rango horario típico del día
  const startRoll = hashUnit(`${workerId}|${workDate}|in`);
  const startH = 7 + Math.floor(startRoll * 4); // 07..10
  const startM = [0, 15, 30, 45][Math.floor(hashUnit(`${workerId}|${workDate}|inM`) * 4)] ?? 0;

  const localStart = new Date(`${workDate}T${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}:00`);
  const checkInUtcIso = localStart.toISOString();
  const horaEntradaLocal = formatHoraLocalEs(checkInUtcIso);

  if (roll < 20) {
    return { estado: "sin_imputar" };
  }

  if (roll < 42) {
    return {
      estado: "falta_salida",
      horaEntradaLocal,
      checkInUtc: checkInUtcIso,
    };
  }

  const esAusencia = hashUnit(`${workerId}|${workDate}|ausencia`) < 0.06;
  const esManual = hashUnit(`${workerId}|${workDate}|manual`) < 0.22;

  if (esAusencia) {
    return {
      estado: "completa",
      horaEntradaLocal,
      horaSalidaLocal: "—",
      minutosEfectivos: 0,
      minutosBrutos: 0,
      esAusencia: true,
      esManual,
    };
  }

  // horas efectivas: hacemos que a veces cubra objetivo, y a veces se pase para ver “vida” (purples)
  const effectiveRoll = hashUnit(`${workerId}|${workDate}|eff`);
  const overtime = hashUnit(`${workerId}|${workDate}|ot`) < 0.18;
  const effectiveHours = overtime ? 8 + Math.floor(effectiveRoll * 3) : 3 + Math.floor(effectiveRoll * 6); // 3..13 aprox
  const effectiveMinutes = effectiveHours * 60;

  const localEnd = new Date(localStart.getTime() + effectiveMinutes);
  const checkOutUtcIso = localEnd.toISOString();
  const horaSalidaLocal = formatHoraLocalEs(checkOutUtcIso);

  // en demo no descontamos descanso para mantener el donut consistente
  const minutosEfectivos = effectiveMinutes;
  const minutosBrutos = effectiveMinutes;

  // objectiveHoursTotal se usa solo como “contexto” (para que el mock sea coherente si cambiamos objetivo)
  void objectiveHoursTotal;

  return {
    estado: "completa",
    horaEntradaLocal,
    horaSalidaLocal,
    minutosEfectivos,
    minutosBrutos,
    esAusencia: false,
    esManual,
  };
}

export default function DashboardManagerPage() {
  const { user, isReady } = useAuth();
  const { enableTimeTracking } = useFeatures();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (user?.role === USER_ROLE.Worker) router.replace("/dashboard/tasks");
  }, [isReady, user?.role, router]);

  const [selectedDate, setSelectedDate] = useState<string>(() => todayISO());
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const { tasks, generalTasks } = useTasks();

  const tasksForSelectedDate = useMemo(() => {
    const t0 = todayISO();
    return tasks.filter((t) => (t.date ?? t0) === selectedDate);
  }, [tasks, selectedDate]);

  const generalTasksForSelectedDate = useMemo(() => {
    const t0 = todayISO();
    return generalTasks.filter((t) => (t.date ?? t0) === selectedDate);
  }, [generalTasks, selectedDate]);

  const tareasSinAsignar = useMemo(() => {
    return generalTasksForSelectedDate.filter((t) => !t.workerId).length;
  }, [generalTasksForSelectedDate]);

  const tasksDelayed = useMemo(() => {
    const t0 = todayISO();
    return tasks
      .filter((t) => (t.date ?? t0) < selectedDate)
      .filter((t) => t.status !== "completed");
  }, [tasks, selectedDate]);

  const generalTasksDelayed = useMemo(() => {
    const t0 = todayISO();
    return generalTasks
      .filter((t) => (t.date ?? t0) < selectedDate)
      .filter((t) => t.status !== "completed");
  }, [generalTasks, selectedDate]);

  const incidentsForSelectedDate = useMemo(() => {
    return MOCK_ANIMAL_CASES.filter((c) => c.date === selectedDate);
  }, [selectedDate]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const teamWorkerTaskIds = useMemo(() => {
    const ids = Array.from(new Set(tasksForSelectedDate.map((t) => t.workerId).filter(Boolean)));
    return ids.length > 0 ? ids : MOCK_WORKERS.map((w) => w.id);
  }, [tasksForSelectedDate]);

  const teamNumericWorkerIds = useMemo(() => {
    return teamWorkerTaskIds
      .map(workerNumericIdFromTaskWorkerId)
      .filter((x): x is number => x != null);
  }, [teamWorkerTaskIds]);

  const attendance = useMemo(() => {
    if (!mounted || !enableTimeTracking) return null;

    const teamSize = Math.max(1, teamNumericWorkerIds.length);
    const objectiveHoursTotal = teamSize * 8;

    // 1) Miramos si existe en localStorage alguna entrada para el día seleccionado y el equipo actual
    let hasAnyForSelectedDate = false;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(FICHADOR_STORAGE_KEY);
        if (raw) {
          const p = JSON.parse(raw) as unknown;
          if (Array.isArray(p)) {
            const ids = new Set(teamNumericWorkerIds);
            hasAnyForSelectedDate = p.some((e: unknown) => {
              if (e === null || typeof e !== "object") return false;
              const obj = e as { workDate?: unknown; workerId?: unknown };
              return (
                typeof obj.workDate === "string" &&
                obj.workDate === selectedDate &&
                typeof obj.workerId === "number" &&
                ids.has(obj.workerId)
              );
            });
          }
        }
      } catch {
        // si falla el parse, caemos al mock
        hasAnyForSelectedDate = false;
      }
    }

    // 2) Si no hay datos del fichaje para ese día/equipo, generamos mock determinista para que “se vea bien”
    if (!hasAnyForSelectedDate) {
      return teamNumericWorkerIds.map((wid): { wid: number; resumen: ResumenImputacionHoy } => ({
        wid,
        resumen: demoResumenImputacionParaFecha(wid, selectedDate, objectiveHoursTotal),
      }));
    }

    // 3) Si hay datos reales, los usamos
    return teamNumericWorkerIds.map((wid): { wid: number; resumen: ResumenImputacionHoy } => ({
      wid,
      resumen: leerResumenImputacionParaFecha(wid, selectedDate),
    }));
  }, [mounted, enableTimeTracking, teamNumericWorkerIds, selectedDate]);

  const imputacion = useMemo(() => {
    if (!attendance) {
      return {
        equipoSize: teamNumericWorkerIds.length,
        sinImputar: 0,
        faltaSalida: 0,
        completa: 0,
        manual: 0,
        horasEfectivas: 0,
      };
    }

    let sinImputar = 0;
    let faltaSalida = 0;
    let completa = 0;
    let manual = 0;
    let horasEfectivas = 0;

    for (const { resumen } of attendance) {
      if (resumen.estado === "sin_imputar") sinImputar += 1;
      else if (resumen.estado === "falta_salida") faltaSalida += 1;
      else {
        completa += 1;
        if (resumen.esManual) manual += 1;
        if (!resumen.esAusencia) horasEfectivas += resumen.minutosEfectivos;
      }
    }

    return {
      equipoSize: attendance.length,
      sinImputar,
      faltaSalida,
      completa,
      manual,
      horasEfectivas: Math.round(horasEfectivas / 60), // horas enteras para KPIs
    };
  }, [attendance, teamNumericWorkerIds.length]);

  const desviacionPersonal = enableTimeTracking
    ? imputacion.sinImputar + imputacion.faltaSalida
    : 0;

  const retrasadasTotales = tasksDelayed.length + generalTasksDelayed.length;
  const animalesSinTratamiento = incidentsForSelectedDate.filter((i) => i.status === "reported").length;

  const kpiDesviacionOk = desviacionPersonal === 0;
  const kpiRetrasosOk = retrasadasTotales === 0;
  const kpiAnimalesOk = animalesSinTratamiento === 0;
  const kpiSinAsignarOk = tareasSinAsignar === 0;

  const urgenciasGlobales = useMemo(() => {
    const MAX_ITEMS = 4;
    const incidentUrg = incidentsForSelectedDate
      .filter((i) => i.status !== "resolved")
      .filter((i) => i.severity === "critical" || i.severity === "high")
      .map((i) => {
        const animal = MOCK_ANIMALS.find((a) => a.id === i.animalId);
        const farm = animal ? MOCK_FARMS.find((f) => f.id === animal.farmId) : null;
        return {
          key: `inc-${i.id}`,
          type: "Incidencia",
          title: `${i.caseType} (${i.severity === "critical" ? "crítica" : "alta"})`,
          farm: farm?.name ?? "Sin granja",
          time: daysDiffLabel(selectedDate, i.date),
        };
      });

    const taskUrg = [
      ...tasksDelayed
        .filter((t) => t.priority === "high")
        .map((t) => ({
          key: `tsk-${t.id}`,
          type: "Tarea retrasada",
          title: t.title,
          farm: t.farmName,
          time: daysDiffLabel(selectedDate, t.date ?? selectedDate),
        })),
      ...generalTasksDelayed
        .filter((t) => t.priority === "high")
        .map((t) => ({
          key: `gt-${t.id}`,
          type: "Tarea retrasada",
          title: t.title,
          farm: t.farmName,
          time: daysDiffLabel(selectedDate, t.date ?? selectedDate),
        })),
    ];

    return [...incidentUrg, ...taskUrg].slice(0, MAX_ITEMS);
  }, [incidentsForSelectedDate, selectedDate, tasksDelayed, generalTasksDelayed]);

  const empleadosSinTareas = useMemo(() => {
    // "Sin tareas" = no tener NINGUNA tarea asignada para el día seleccionado (sin importar estado)
    const workerIdsWithAnyTasksToday = new Set(
      [...tasksForSelectedDate, ...generalTasksForSelectedDate]
        .filter((t) => Boolean(t.workerId))
        .map((t) => t.workerId)
    );

    return MOCK_WORKERS.filter((w) => !workerIdsWithAnyTasksToday.has(w.id));
  }, [generalTasksForSelectedDate, tasksForSelectedDate]);

  const empleadosSinTareasParaMostrar = useMemo(() => {
    const MAX_ITEMS = 4;
    const slots = Math.max(0, MAX_ITEMS - urgenciasGlobales.length);
    return empleadosSinTareas.slice(0, slots);
  }, [empleadosSinTareas, urgenciasGlobales.length]);

  const porGranja = useMemo(() => {
    return MOCK_FARMS.map((farm) => {
      const tasksInFarm = tasksForSelectedDate.filter((t) => t.farmName === farm.name);
      const delayedInFarm = tasksDelayed.filter((t) => t.farmName === farm.name);
      const inProgress = tasksInFarm.filter((t) => t.status === "in_progress").length;
      const active = tasksInFarm.filter((t) => t.status !== "completed").length;

      const farmIncidents = incidentsForSelectedDate.filter((inc) => {
        const animal = MOCK_ANIMALS.find((a) => a.id === inc.animalId);
        if (!animal) return false;
        return MOCK_FARMS.find((f) => f.id === animal.farmId)?.name === farm.name;
      }).length;

      return {
        name: farm.name,
        total: tasksInFarm.length,
        delayed: delayedInFarm.length,
        inProgress,
        active,
        incidents: farmIncidents,
      };
    });
  }, [tasksForSelectedDate, tasksDelayed, incidentsForSelectedDate]);

  const objectiveHours = Math.max(1, imputacion.equipoSize) * 8; // 8h teóricas por operario
  const imputadasEffectiveHours = Math.max(0, (imputacion.horasEfectivas ?? 0));
  const pctObjetivo = objectiveHours > 0 ? (imputadasEffectiveHours / objectiveHours) * 100 : 0;

  const distributionData = useMemo(() => {
    if (objectiveHours <= 0) return [];
    if (imputadasEffectiveHours >= objectiveHours) {
      return [
        { name: "Base", value: objectiveHours, color: "#10b981" },
        { name: "Extra", value: imputadasEffectiveHours - objectiveHours, color: "#8b5cf6" },
      ];
    }
    return [
      { name: "Imputadas", value: imputadasEffectiveHours, color: "#10b981" },
      { name: "Falta", value: objectiveHours - imputadasEffectiveHours, color: "#94a3b8" },
    ];
  }, [objectiveHours, imputadasEffectiveHours]);

  const fichajeRingData = useMemo(() => {
    if (!attendance) {
      return [
        { name: "Correcto", value: 0, color: "#10b981" },
        { name: "Manual / corrección", value: 0, color: "#f59e0b" },
        { name: "Sin imputar", value: 0, color: "#ef4444" },
      ];
    }
    const sinImputar = attendance.filter(({ resumen }) => resumen.estado !== "completa").length;
    const manual = attendance.filter(({ resumen }) => resumen.estado === "completa" && resumen.esManual).length;
    const completaSinManual = attendance.filter(
      ({ resumen }) => resumen.estado === "completa" && !resumen.esManual
    ).length;

    return [
      { name: "Fichaje correcto", value: completaSinManual, color: "#10b981" },
      { name: "Manual / corrección", value: manual, color: "#f59e0b" },
      { name: "Sin imputar", value: sinImputar, color: "#ef4444" },
    ];
  }, [attendance]);

  if (!isReady) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-agro-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-[70vh]">
      {/* Top bar */}
      <div className="mb-6 border-b border-slate-200 pb-4">
        <p className="text-sm font-semibold text-agro-500 uppercase tracking-widest mb-1">Visión Manager</p>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Panel de Control Global</h1>
        <p className="mt-2 text-sm text-slate-500">{formatDateES(selectedDate)}</p>
      </div>

      {/* Toolbar */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => addDays(d, -7))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate((d) => addDays(d, 7))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              →
            </button>
            <span className="ml-2 text-xs font-semibold text-slate-500">Semana operativa</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {weekDays.map(({ iso, dayName, dayNum }) => (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedDate(iso)}
              className={`w-full rounded-xl border px-2 py-2 text-xs font-semibold transition text-center ${
                iso === selectedDate
                  ? "border-agro-500 bg-agro-100 text-agro-800 dark:border-agro-400 dark:bg-agro-900/40 dark:text-agro-200"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800/30"
              }`}
            >
              {dayName} {dayNum}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6">
        <div
          className={`bg-white rounded-2xl p-5 shadow-sm border border-transparent border-t-4 ${
            kpiDesviacionOk ? "border-t-emerald-400" : "border-t-red-500"
          }`}
        >
          <p
            className="text-sm font-semibold uppercase tracking-wide text-slate-600"
          >
            Desviación de personal
          </p>
          <p
            className="mt-2 text-4xl font-black text-slate-900"
          >
            {desviacionPersonal}
          </p>
          <p
            className="mt-2 text-xs font-semibold w-fit px-2 py-1 rounded bg-slate-50 text-slate-700"
          >
            Operarios con imputación incompleta
          </p>
        </div>

        <div
          className={`bg-white rounded-2xl p-5 shadow-sm border border-transparent border-t-4 ${
            kpiRetrasosOk ? "border-t-emerald-400" : "border-t-red-500"
          }`}
        >
          <p
            className="text-sm font-semibold uppercase tracking-wide text-slate-600"
          >
            Tareas retrasadas
          </p>
          <p
            className="mt-2 text-4xl font-black text-slate-900"
          >
            {retrasadasTotales} <span className="text-lg font-bold opacity-60">totales</span>
          </p>
          <p
            className="mt-2 text-xs font-bold text-slate-700"
          >
            {kpiRetrasosOk ? "Sin retrasos" : "Prioridad de reasignación"}
          </p>
        </div>

        <div
          className={`bg-white rounded-2xl p-5 shadow-sm border border-transparent border-t-4 ${
            kpiAnimalesOk ? "border-t-emerald-400" : "border-t-red-500"
          }`}
        >
          <p
            className="text-sm font-semibold uppercase tracking-wide text-slate-600"
          >
            Animales sin tratamiento
          </p>
          <p
            className="mt-2 text-4xl font-black text-slate-900"
          >
            {animalesSinTratamiento}{" "}
            <span className="text-lg font-bold text-slate-900 opacity-60">
              casos
            </span>
          </p>
          <p
            className="mt-2 text-xs font-bold w-fit px-2 py-1 rounded bg-slate-50 text-slate-700"
          >
            {kpiAnimalesOk ? "Todo al día" : "Pendientes de reasignación vet."}
          </p>
        </div>

        <div
          className={`bg-white rounded-2xl p-5 shadow-sm border border-transparent border-t-4 ${
            kpiSinAsignarOk ? "border-t-emerald-400" : "border-t-red-500"
          }`}
        >
          <p
            className="text-sm font-semibold uppercase tracking-wide text-slate-600"
          >
            Tareas sin asignar
          </p>
          <p
            className="mt-2 text-4xl font-black text-slate-900"
          >
            {tareasSinAsignar} <span className="text-lg font-bold opacity-60">totales</span>
          </p>
          <Link
            href="/dashboard/unassigned-tasks"
            className="mt-2 inline-block text-xs font-bold text-slate-700 underline-offset-2 hover:underline"
          >
            {kpiSinAsignarOk ? "Revisar tareas" : "Reasignar →"}
          </Link>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Row 1: Alertas + Por granja (misma altura por grid) */}
        <div className="lg:col-span-4">
          <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-amber-400 p-5">
            <h2 className="text-base font-bold text-slate-800 mb-4 uppercase tracking-wide">Alertas de imputación</h2>

            <div className="flex flex-col gap-3">
              {!enableTimeTracking && (
                <p className="text-sm text-slate-500">El fichaje no está activo (sin comprobación de imputación).</p>
              )}
              {enableTimeTracking && !attendance && (
                <p className="text-sm text-slate-500">Comprobando imputación…</p>
              )}
              {enableTimeTracking &&
                attendance?.map(({ wid, resumen }) => {
                  const isOk = resumen.estado === "completa";
                  const isManual = resumen.estado === "completa" && resumen.esManual;
                  const badgeClass = isOk
                    ? isManual
                      ? "bg-amber-50 text-amber-700 border-amber-100"
                      : "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : resumen.estado === "falta_salida"
                      ? "bg-amber-50 text-amber-700 border-amber-100"
                      : "bg-red-50 text-red-700 border-red-100";
                  const badgeText = isOk
                    ? isManual
                      ? "Imputación (manual)"
                      : "Imputación correcta"
                    : resumen.estado === "falta_salida"
                      ? "Falta salida"
                      : "Sin imputar";

                  const name =
                    MOCK_WORKERS.find((w) => w.id === `w${wid}`)?.name ?? `Operario ${wid}`;

                  return (
                    <div
                      key={wid}
                      className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{name}</p>
                        {isOk && !resumen.esAusencia && (
                          <p className="text-xs text-slate-600 mt-1">
                            {resumen.horaEntradaLocal} - {resumen.horaSalidaLocal} ·{" "}
                            {formatDuracionImputacionEs(resumen.minutosEfectivos)}
                          </p>
                        )}
                        {isOk && resumen.esAusencia && (
                          <p className="text-xs text-slate-600 mt-1">Día imputado como ausencia</p>
                        )}
                        {!isOk && resumen.estado === "falta_salida" && (
                          <p className="text-xs text-slate-600 mt-1">Entrada: {resumen.horaEntradaLocal}</p>
                        )}
                        {!isOk && resumen.estado === "sin_imputar" && (
                          <p className="text-xs text-slate-600 mt-1">Sin entrada ni salida</p>
                        )}
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full border ${badgeClass} whitespace-nowrap`}>
                        {badgeText}
                      </span>
                    </div>
                  );
                })}
            </div>

            <div className="mt-4 flex gap-2">
              <Link
                href="/dashboard/time-tracking"
                className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 transition text-center"
              >
                Ver fichador
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="h-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-5">Por granja</h2>
            <div className="flex flex-col gap-4">
              {porGranja.map((farm) => (
                <div
                  key={farm.name}
                  className="flex flex-col border border-slate-200 rounded-2xl p-5 bg-white shadow-sm hover:border-slate-300 transition"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-bold text-slate-900">{farm.name}</h3>
                    <span className="text-sm font-medium text-slate-500">{farm.total} tareas</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                        farm.delayed > 0 ? "bg-red-50 text-red-600" : "bg-red-50/50 text-red-400 opacity-70"
                      }`}
                    >
                      {farm.delayed} retrasadas
                    </span>
                    <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
                      {farm.inProgress} en curso
                    </span>
                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                        farm.incidents > 0 ? "bg-amber-50 text-amber-600" : "bg-amber-50/50 text-amber-500 opacity-70"
                      }`}
                    >
                      {farm.incidents} incidencias
                    </span>
                    <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                      {farm.active} activos
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Últimas urgencias + charts */}
        <div className="lg:col-span-4">
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-red-400 p-5">
              <h2 className="text-base font-bold text-slate-800 mb-4 uppercase tracking-wide text-red-600">
                Últimas urgencias globales
              </h2>
              <div className="flex flex-col gap-3">
                {urgenciasGlobales.length === 0 && (
                  <p className="text-sm text-slate-500">Sin urgencias para el día seleccionado.</p>
                )}
                {urgenciasGlobales.map((u) => (
                  <div key={u.key} className="p-3 rounded-xl border border-red-100 bg-red-50/30">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-red-100 text-red-700">
                        {u.type}
                      </span>
                      <span className="text-[10px] font-bold text-slate-600/80">{u.time}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 mt-1 leading-tight">{u.title}</p>
                    <p className="text-xs font-semibold text-slate-600/80 mt-1">{u.farm}</p>
                  </div>
                ))}
              </div>
              <Link
                href="/dashboard/incidents"
                className="mt-4 block w-full text-center rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-100 transition"
              >
                Revisar urgencias →
              </Link>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 border-t-4 border-t-emerald-400 p-5">
              <h2 className="text-base font-bold text-slate-800 mb-4 uppercase tracking-wide text-emerald-600">
                Usuarios sin tarea
              </h2>
              <div className="flex flex-col gap-3">
                {empleadosSinTareasParaMostrar.length === 0 ? (
                  <p className="text-sm text-slate-500">Todos tienen tareas para el día seleccionado.</p>
                ) : (
                  empleadosSinTareasParaMostrar.map((w) => (
                    <div
                      key={`emp-${w.id}`}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/60"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-600">
                          Sin tareas
                        </span>
                        <span className="text-[10px] font-bold text-slate-600/80">Hoy</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 mt-1 leading-tight">{w.name}</p>
                      <p className="text-xs font-semibold text-slate-600/80 mt-1">No tiene tareas asignadas.</p>
                    </div>
                  ))
                )}
              </div>
              <Link
                href="/dashboard/tasks"
                className="mt-4 block w-full text-center rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                Ver tareas →
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col items-center">
              <h3 className="text-sm font-bold text-slate-700 tracking-wide mb-8 w-full text-center">
                Distribución de hoy (objetivo vs imputado)
              </h3>
              <div className="relative w-52 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                    >
                      {distributionData.map((entry, idx) => (
                        <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span
                    className={`text-3xl font-black tracking-tighter ${
                      pctObjetivo > 100 ? "text-purple-600" : "text-slate-800"
                    }`}
                  >
                    {pctObjetivo.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase text-center leading-tight mt-1">
                    del objetivo
                    <br />
                    de hoy
                  </span>
                </div>
              </div>

              <div className="w-full mt-4 flex flex-col gap-3">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 border-2 border-slate-300 bg-transparent rounded-sm" />
                      <span className="text-xs font-semibold text-slate-600">Objetivo teórico</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900 tracking-tight">{objectiveHours} h</span>
                    <span className="text-[10px] text-slate-400 block">tope del día</span>
                  </div>
                </div>

                {pctObjetivo > 100 ? (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-purple-500 rounded-sm" />
                      <span className="text-xs font-bold text-purple-700">Horas extra</span>
                    </div>
                    <span className="text-sm font-black text-purple-700 tracking-tight">
                      {Math.max(0, Math.round(imputadasEffectiveHours - objectiveHours))} h
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                          Horas base
                        </span>
                    </div>
                    <span className="text-sm font-black text-slate-900 tracking-tight">{Math.round(Math.min(imputadasEffectiveHours, objectiveHours))} h</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col items-center">
              <h3 className="text-sm font-bold text-slate-700 tracking-wide mb-8 w-full text-center">
                Estado del fichaje hoy (incl. sin imputar)
              </h3>

              <div className="relative w-52 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fichajeRingData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                    >
                      {fichajeRingData.map((entry, idx) => (
                        <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black tracking-tighter text-emerald-700">
                    {teamNumericWorkerIds.length > 0
                      ? ((imputacion.completa / Math.max(1, teamNumericWorkerIds.length)) * 100).toFixed(1) + "%"
                      : "0%"}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase text-center leading-tight mt-1">
                    fichaje completo
                    <br />
                    (hoy)
                  </span>
                </div>
              </div>

              <div className="w-full mt-4 flex flex-col gap-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-emerald-500" aria-hidden />
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                      Correcto
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-200">
                    {imputacion.completa} operarios
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-amber-500" aria-hidden />
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                      Manual / corrección
                    </span>
                  </div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-200">
                    {imputacion.manual}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-red-500" aria-hidden />
                    <span className="text-xs font-semibold text-red-700 dark:text-red-200">
                      Sin completar
                    </span>
                  </div>
                  <span className="text-xs font-bold text-red-600 dark:text-red-200">
                    {imputacion.sinImputar + imputacion.faltaSalida}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {isWeekendISO(selectedDate) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
              Fin de semana: el objetivo teórico se mantiene como referencia, pero los KPIs pueden ser menos relevantes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

