"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MOCK_WORKERS,
  MOCK_ANIMAL_CASES,
  MOCK_ANIMALS,
  MOCK_FARMS,
} from "@/data/mock";
import type { Task, TaskStatus, AnimalCase, IncidentStatus, UserRole } from "@/types";
import { USER_ROLE, formatTaskId } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/contexts/TasksContext";
import DatePicker from "@/components/DatePicker";
import { useFeatures } from "@/contexts/FeaturesContext";
import DashboardAvisos from "@/components/DashboardAvisos";
import { useRouter } from "next/navigation";

/** Semana en español: lunes = primer día */
const WEEKDAY_NAMES_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const STATUS_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "ready", label: "Lista para empezar" },
  { status: "in_progress", label: "En desarrollo" },
  { status: "completed", label: "Finalizada" },
];

const INCIDENT_COLUMNS: { status: IncidentStatus; label: string }[] = [
  { status: "reported", label: "Reportado" },
  { status: "in_treatment", label: "En tratamiento" },
  { status: "resolved", label: "Resuelto" },
];

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

interface TaskPreviewProps {
  task: Task;
}

interface IncidentPreviewProps {
  incident: AnimalCase;
}

function getWorkerName(workerId: string): string {
  const worker = MOCK_WORKERS.find((w) => w.id === workerId);
  return worker?.name ?? "Sin asignar";
}

function getAnimalName(animalId: string): string {
  const animal = MOCK_ANIMALS.find((a) => a.id === animalId);
  return animal?.name ?? "Animal desconocido";
}

function getAnimalIdentification(animalId: string): string | undefined {
  return MOCK_ANIMALS.find((a) => a.id === animalId)?.identification;
}

const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  reported: "Reportado",
  in_treatment: "En tratamiento",
  resolved: "Resuelto",
};

function TaskPreviewCard({ task }: TaskPreviewProps) {
  const priorityBorder =
    task.priority === "high"
      ? "border-l-red-500"
      : task.priority === "medium"
      ? "border-l-amber-400"
      : "border-l-slate-300";

  const createdISO = task.createdAt ?? todayISO();
  const createdLabel = new Date(createdISO + "T12:00:00").toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div
      className={`rounded-xl border border-slate-200 border-l-4 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90 ${priorityBorder}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
          <span className="text-slate-500 dark:text-slate-400 font-normal mr-1.5">#{formatTaskId(task.taskNumber ?? 0)}</span>
          {task.title}
        </h3>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
            task.priority === "high"
              ? "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              : task.priority === "medium"
              ? "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          {task.priority === "high" ? "Alta" : task.priority === "medium" ? "Media" : "Baja"}
        </span>
      </div>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {task.farmName}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Creada: {createdLabel}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        {getWorkerName(task.workerId)}
      </p>
      <p className="mt-1 text-sm text-slate-600 line-clamp-2 dark:text-slate-300">
        {task.managerDetails || "Sin detalles del manager."}
      </p>
    </div>
  );
}

function IncidentPreviewCard({ incident }: IncidentPreviewProps) {
  const severityLabel =
    incident.severity === "critical"
      ? "Crítica"
      : incident.severity === "high"
      ? "Alta"
      : incident.severity === "medium"
      ? "Media"
      : "Baja";

  const createdLabel = new Date(incident.date + "T12:00:00").toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const borderColor =
    incident.severity === "critical" || incident.severity === "high"
      ? "border-l-red-500"
      : incident.severity === "medium"
      ? "border-l-amber-400"
      : "border-l-slate-300";

  const chipClasses =
    incident.severity === "critical" || incident.severity === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : incident.severity === "medium"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";

  const animalId = incident.animalId;
  const animalName = getAnimalName(animalId);
  const animalCrotal = getAnimalIdentification(animalId);
  const animalLine = [animalCrotal, animalName].filter(Boolean).join(" — ") || "—";

  return (
    <div
      className={`rounded-xl border border-slate-200 border-l-4 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90 ${borderColor}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
          <span className="text-slate-500 dark:text-slate-400 font-normal mr-1.5">
            #{formatTaskId(incident.incidentNumber ?? 0)}
          </span>
          {incident.caseType}
        </h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${chipClasses}`}>
          {severityLabel}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
        <span className="font-medium text-slate-600 dark:text-slate-400">Animal:</span> {animalLine}
      </p>
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
        <span className="font-medium text-slate-600 dark:text-slate-400">Creada:</span> {createdLabel}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
        {INCIDENT_STATUS_LABELS[incident.status]}
      </p>
      <p className="mt-1.5 text-sm text-slate-600 line-clamp-2 dark:text-slate-300">
        {incident.summary}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isReady } = useAuth();
  const { enableAnimals } = useFeatures();
  const { tasks, generalTasks } = useTasks();
  const role: UserRole | undefined = user?.role;
  const isSuperAdmin = role === USER_ROLE.SuperAdmin;
  const isAdmin = role === USER_ROLE.Admin || isSuperAdmin || role === USER_ROLE.Manager;
  const canSeeAnimals = enableAnimals && (isAdmin || isSuperAdmin);
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!user?.role) return;
    if (user.role === USER_ROLE.Worker) {
      router.replace("/dashboard/tasks");
      return;
    }
    // Para admin/manager/superadmin, el “Panel” se sirve desde /dashboard/manager.
    router.replace("/dashboard/manager");
  }, [isReady, user?.role, router]);

  const isRedirecting = isReady && !!user?.role;

  const [selectedDate, setSelectedDate] = useState<string>(() => todayISO());
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("all");
  const [selectedFarmId, setSelectedFarmId] = useState<string>("all");
  const [workerQuery, setWorkerQuery] = useState<string>("");
  const [farmQuery, setFarmQuery] = useState<string>("");
  const [taskCodeQuery, setTaskCodeQuery] = useState<string>("");
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [activeSection, setActiveSection] = useState<"tasks" | "generalTasks" | "incidents">("tasks");
  const [mobileStatusFilter, setMobileStatusFilter] = useState<TaskStatus | "all">("all");

  const tasksForSelectedDateBase = useMemo(() => {
    const today = todayISO();
    return tasks.filter((t) => (t.date ?? today) === selectedDate);
  }, [tasks, selectedDate]);

  const tasksForSelectedDate = useMemo(() => {
    let list = tasksForSelectedDateBase;
    if (isAdmin) {
      // Filtro por trabajador (selector + texto)
      if (selectedWorkerId !== "all") {
        list = list.filter((t) => t.workerId === selectedWorkerId);
      }
      const wq = workerQuery.trim().toLowerCase();
      if (wq) {
        list = list.filter((t) => {
          const worker = MOCK_WORKERS.find((w) => w.id === t.workerId);
          return worker?.name.toLowerCase().includes(wq);
        });
      }

      // Filtro por granja (selector + texto)
      if (selectedFarmId !== "all") {
        const farm = MOCK_FARMS.find((f) => f.id === selectedFarmId);
        if (farm) {
          list = list.filter((t) => t.farmName === farm.name);
        }
      }
      const fq = farmQuery.trim().toLowerCase();
      if (fq) {
        list = list.filter((t) => t.farmName.toLowerCase().includes(fq));
      }
      const codeQ = taskCodeQuery.replace(/^#/, "").trim();
      if (codeQ) {
        list = list.filter((t) => {
          const code = formatTaskId(t.taskNumber ?? 0);
          return code.includes(codeQ) || String(t.taskNumber ?? "").includes(codeQ);
        });
      }
    }
    return list;
  }, [isAdmin, selectedWorkerId, workerQuery, selectedFarmId, farmQuery, taskCodeQuery, tasksForSelectedDateBase]);

  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const { status } of STATUS_COLUMNS) {
      map.set(status, tasksForSelectedDate.filter((t) => t.status === status));
    }
    return map;
  }, [tasksForSelectedDate]);

  // Tareas generales (no asignadas a trabajador). En esta vista el calendario es un filtro opcional:
  // - Sin filtro: se muestran todas las tareas generales
  // - Con filtro: solo las de la fecha seleccionada
  const [generalFilterByDate, setGeneralFilterByDate] = useState(false);

  const generalTasksFiltered = useMemo(() => {
    let list = generalTasks;
    if (generalFilterByDate) {
      const today = todayISO();
      list = list.filter((t) => (t.date ?? today) === selectedDate);
    }
    const codeQ = taskCodeQuery.replace(/^#/, "").trim();
    if (codeQ && isAdmin) {
      list = list.filter((t) => {
        const code = formatTaskId(t.taskNumber ?? 0);
        return code.includes(codeQ) || String(t.taskNumber ?? "").includes(codeQ);
      });
    }
    return list;
  }, [generalFilterByDate, selectedDate, generalTasks, taskCodeQuery, isAdmin]);

  const generalTasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const { status } of STATUS_COLUMNS) {
      map.set(status, generalTasksFiltered.filter((t) => t.status === status));
    }
    return map;
  }, [generalTasksFiltered]);

  const weekDays = useMemo(() => {
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
  }, [selectedDate]);

  const totalTasks = tasksForSelectedDate.length;
  const ready = tasksByStatus.get("ready")?.length ?? 0;
  const inProgress = tasksByStatus.get("in_progress")?.length ?? 0;
  const completed = tasksByStatus.get("completed")?.length ?? 0;

  const totalGeneralTasks = generalTasksFiltered.length;
  const readyGeneral = generalTasksByStatus.get("ready")?.length ?? 0;
  const inProgressGeneral = generalTasksByStatus.get("in_progress")?.length ?? 0;
  const completedGeneral = generalTasksByStatus.get("completed")?.length ?? 0;

  const incidentsForSelectedDate = useMemo(() => {
    // Dashboard de animales: solo informativo, por ahora todos los incidentes sin filtrar por fecha
    return MOCK_ANIMAL_CASES;
  }, []);

  const incidentsByStatus = useMemo(() => {
    const map = new Map<IncidentStatus, AnimalCase[]>();
    for (const { status } of INCIDENT_COLUMNS) {
      map.set(status, incidentsForSelectedDate.filter((c) => c.status === status));
    }
    return map;
  }, [incidentsForSelectedDate]);

  return isRedirecting ? (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-agro-500 border-t-transparent" />
    </div>
  ) : (
    <div className="space-y-4">
      {/* Cabecera con banda de color */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-agro-600 via-emerald-500 to-sky-500 px-5 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-agro-100/80">
              Panel general
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white">Dashboard</h1>
            <p className="mt-1 text-sm text-agro-50/90">
              Vista rápida de tareas e incidentes en todas tus granjas.
            </p>
          </div>
          {role && (
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-agro-50 backdrop-blur">
                Rol: {role}
              </span>
              {isSuperAdmin && (
                <span className="text-[11px] text-agro-50/80">
                  Acceso global a todas las empresas
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pestañas: tareas / tareas generales / (animales con incidentes si está activado y rol permite verlo) */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-slate-200 bg-white/80 p-1 text-sm shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveSection("tasks")}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              activeSection === "tasks"
                ? "bg-agro-600 text-white dark:bg-agro-500"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            Tareas
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("generalTasks")}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              activeSection === "generalTasks"
                ? "bg-agro-600 text-white dark:bg-agro-500"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            Tareas generales
          </button>
          {canSeeAnimals && (
            <button
              type="button"
              onClick={() => setActiveSection("incidents")}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                activeSection === "incidents"
                  ? "bg-agro-600 text-white dark:bg-agro-500"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              Animales con incidentes
            </button>
          )}
        </div>
      </div>

      {canSeeAnimals && activeSection === "incidents" && (
        <div className="mx-auto mb-4 w-full max-w-lg">
          <DashboardAvisos />
        </div>
      )}

      {canSeeAnimals && activeSection === "incidents" ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-2.5 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              Total incidentes
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {incidentsForSelectedDate.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-2.5 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              Reportados
            </p>
            <p className="mt-1 text-xl font-bold text-red-500">
              {(incidentsByStatus.get("reported") ?? []).length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-2.5 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              En tratamiento
            </p>
            <p className="mt-1 text-xl font-bold text-amber-500">
              {(incidentsByStatus.get("in_treatment") ?? []).length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-2.5 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              Resueltos
            </p>
            <p className="mt-1 text-xl font-bold text-green-500">
              {(incidentsByStatus.get("resolved") ?? []).length}
            </p>
          </div>
        </div>
      ) : null}

      {/* Contenido principal según pestaña */}
      {activeSection === "tasks" ? (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(260px,300px)_1fr] lg:items-start lg:gap-5">
          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Contexto
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {formatDateES(selectedDate)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Estado global del día seleccionado.
              </p>
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/90 p-2.5 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Total{" "}
                  <span className="text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
                    {totalTasks}
                  </span>
                </p>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <div className="rounded-lg border border-amber-100/80 bg-amber-50/95 py-2 text-center dark:border-amber-900/40 dark:bg-amber-950/30">
                    <p className="text-[10px] font-semibold uppercase text-amber-800 dark:text-amber-200">
                      Inicio
                    </p>
                    <p className="text-xl font-bold text-amber-500 tabular-nums">{ready}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100/80 bg-blue-50/95 py-2 text-center dark:border-blue-900/40 dark:bg-blue-950/30">
                    <p className="text-[10px] font-semibold uppercase text-blue-800 dark:text-blue-200">
                      Curso
                    </p>
                    <p className="text-xl font-bold text-blue-500 tabular-nums">{inProgress}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-100/80 bg-emerald-50/95 py-2 text-center dark:border-emerald-900/40 dark:bg-emerald-950/30">
                    <p className="text-[10px] font-semibold uppercase text-emerald-800 dark:text-emerald-200">
                      Fin
                    </p>
                    <p className="text-xl font-bold text-green-500 tabular-nums">{completed}</p>
                  </div>
                </div>
              </div>
            </div>
            {isAdmin && (
              <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800">
                <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-700">
                  <span className="text-sm text-slate-400 dark:text-slate-500" aria-hidden>
                    ⌕
                  </span>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Filtros
                  </h2>
                </div>
                <div className="flex min-h-0 flex-col gap-3 p-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex w-[4.25rem] shrink-0 flex-col gap-0.5">
                        <label
                          htmlFor="dash-filter-code"
                          className="text-[10px] font-medium text-slate-500 dark:text-slate-400"
                        >
                          Cód.
                        </label>
                        <input
                          id="dash-filter-code"
                          type="text"
                          maxLength={8}
                          value={taskCodeQuery}
                          onChange={(e) => setTaskCodeQuery(e.target.value)}
                          placeholder="0020"
                          className="box-border w-full max-w-[4.25rem] rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-center text-xs tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100 dark:focus:bg-slate-800"
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
                        <div className="flex w-[9.5rem] shrink-0 flex-col gap-0.5">
                          <label
                            htmlFor="dash-filter-worker"
                            className="text-[10px] font-medium text-slate-500 dark:text-slate-400"
                          >
                            Trabajador
                          </label>
                          <select
                            id="dash-filter-worker"
                            value={selectedWorkerId}
                            onChange={(e) => setSelectedWorkerId(e.target.value)}
                            className="w-full rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-900 focus:border-agro-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100 dark:focus:bg-slate-800"
                          >
                            <option value="all">Todos</option>
                            {MOCK_WORKERS.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex min-w-[7rem] flex-1 flex-col gap-0.5 basis-[10rem]">
                          <label
                            htmlFor="dash-filter-worker-txt"
                            className="text-[10px] font-medium text-slate-500 dark:text-slate-400"
                          >
                            Buscar trabajador
                          </label>
                          <input
                            id="dash-filter-worker-txt"
                            type="text"
                            value={workerQuery}
                            onChange={(e) => setWorkerQuery(e.target.value)}
                            placeholder="Por nombre…"
                            className="w-full min-w-0 rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100 dark:focus:bg-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 dark:border-slate-700/80">
                      <div className="flex w-[9.5rem] shrink-0 flex-col gap-0.5">
                        <label
                          htmlFor="dash-filter-farm"
                          className="text-[10px] font-medium text-slate-500 dark:text-slate-400"
                        >
                          Granja
                        </label>
                        <select
                          id="dash-filter-farm"
                          value={selectedFarmId}
                          onChange={(e) => setSelectedFarmId(e.target.value)}
                          className="w-full rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-900 focus:border-agro-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100 dark:focus:bg-slate-800"
                        >
                          <option value="all">Todas</option>
                          {MOCK_FARMS.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex min-w-[7rem] flex-1 flex-col gap-0.5 basis-[10rem]">
                        <label
                          htmlFor="dash-filter-farm-txt"
                          className="text-[10px] font-medium text-slate-500 dark:text-slate-400"
                        >
                          Buscar granja
                        </label>
                        <input
                          id="dash-filter-farm-txt"
                          type="text"
                          value={farmQuery}
                          onChange={(e) => setFarmQuery(e.target.value)}
                          placeholder="Nombre…"
                          className="w-full min-w-0 rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100 dark:focus:bg-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs shadow-sm dark:border-slate-600 dark:bg-slate-800/60">
                    {taskCodeQuery.trim() ||
                    selectedWorkerId !== "all" ||
                    workerQuery.trim() ||
                    selectedFarmId !== "all" ||
                    farmQuery.trim() ? (
                      <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          Filtros activos:{" "}
                        </span>
                        {taskCodeQuery.trim() && `código ${taskCodeQuery.trim()}`}
                        {taskCodeQuery.trim() &&
                          (selectedWorkerId !== "all" ||
                            workerQuery.trim() ||
                            selectedFarmId !== "all" ||
                            farmQuery.trim()) &&
                          " · "}
                        {selectedWorkerId !== "all" &&
                          (MOCK_WORKERS.find((w) => w.id === selectedWorkerId)?.name ?? "")}
                        {workerQuery.trim() && ` "${workerQuery.trim()}"`}
                        {selectedFarmId !== "all" &&
                          ` · ${MOCK_FARMS.find((f) => f.id === selectedFarmId)?.name ?? ""}`}
                        {farmQuery.trim() && ` · granja "${farmQuery.trim()}"`}
                      </p>
                    ) : (
                      <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                        Sin filtros: todas las tareas de la fecha.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="min-h-[11rem] min-w-0">
              <DashboardAvisos />
            </div>
          </aside>
          <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Semana operativa
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      const y = window.scrollY;
                      setSelectedDate(addDays(selectedDate, -7));
                      window.scrollTo({ top: y, behavior: "auto" });
                    } else {
                      setSelectedDate(addDays(selectedDate, -7));
                    }
                  }}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600"
                >
                  ← Semana anterior
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      const y = window.scrollY;
                      setSelectedDate(addDays(selectedDate, 7));
                      window.scrollTo({ top: y, behavior: "auto" });
                    } else {
                      setSelectedDate(addDays(selectedDate, 7));
                    }
                  }}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600"
                >
                  Semana siguiente →
                </button>
                <button
                  type="button"
                  onClick={() => setShowWeekPicker((v) => !v)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600"
                >
                  Ir a semana…
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:grid-cols-7">
              {weekDays.map(({ iso, dayName, dayNum }) => (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDate(iso)}
                  className={`w-full rounded-lg border px-2.5 py-2 text-xs font-medium transition text-center ${
                    iso === selectedDate
                      ? "border-agro-500 bg-agro-100 text-agro-800 dark:border-agro-400 dark:bg-agro-900/40 dark:text-agro-200"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {dayName} {dayNum}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Mostrando tareas del <strong>{formatDateES(selectedDate)}</strong>
            </p>
          </div>

          {/* Filtro de columnas solo en móvil */}
          <div className="mt-2 flex gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobileStatusFilter("all")}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium ${
                mobileStatusFilter === "all"
                  ? "bg-agro-600 text-white"
                  : "bg-white text-slate-700 border border-slate-200"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setMobileStatusFilter("ready")}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium ${
                mobileStatusFilter === "ready"
                  ? "bg-agro-600 text-white"
                  : "bg-white text-slate-700 border border-slate-200"
              }`}
            >
              Lista
            </button>
            <button
              type="button"
              onClick={() => setMobileStatusFilter("in_progress")}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium ${
                mobileStatusFilter === "in_progress"
                  ? "bg-agro-600 text-white"
                  : "bg-white text-slate-700 border border-slate-200"
              }`}
            >
              En curso
            </button>
            <button
              type="button"
              onClick={() => setMobileStatusFilter("completed")}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium ${
                mobileStatusFilter === "completed"
                  ? "bg-agro-600 text-white"
                  : "bg-white text-slate-700 border border-slate-200"
              }`}
            >
              Finalizadas
            </button>
          </div>

          {/* Tarjetas por estado, debajo del calendario */}
          <div className="grid gap-3 md:grid-cols-3">
            {STATUS_COLUMNS.map(({ status, label }) => {
              const list = tasksByStatus.get(status) ?? [];
              return (
                <div
                  key={status}
                  className={`rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90 ${
                    mobileStatusFilter !== "all" && mobileStatusFilter !== status ? "hidden md:block" : ""
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{list.length} tarea(s)</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="py-3 text-sm text-slate-500 dark:text-slate-400">
                      No hay tareas en este estado para este día.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {list.map((task) => (
                        <TaskPreviewCard key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      ) : activeSection === "generalTasks" ? (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(260px,300px)_1fr] lg:items-start lg:gap-5">
          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Contexto
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {formatDateES(selectedDate)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Tareas generales (listado global).
              </p>
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/90 p-2.5 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Total{" "}
                  <span className="text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
                    {totalGeneralTasks}
                  </span>
                </p>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <div className="rounded-lg border border-amber-100/80 bg-amber-50/95 py-2 text-center dark:border-amber-900/40 dark:bg-amber-950/30">
                    <p className="text-[10px] font-semibold uppercase text-amber-800 dark:text-amber-200">
                      Inicio
                    </p>
                    <p className="text-xl font-bold text-amber-500 tabular-nums">{readyGeneral}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100/80 bg-blue-50/95 py-2 text-center dark:border-blue-900/40 dark:bg-blue-950/30">
                    <p className="text-[10px] font-semibold uppercase text-blue-800 dark:text-blue-200">
                      Curso
                    </p>
                    <p className="text-xl font-bold text-blue-500 tabular-nums">{inProgressGeneral}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-100/80 bg-emerald-50/95 py-2 text-center dark:border-emerald-900/40 dark:bg-emerald-950/30">
                    <p className="text-[10px] font-semibold uppercase text-emerald-800 dark:text-emerald-200">
                      Fin
                    </p>
                    <p className="text-xl font-bold text-green-500 tabular-nums">{completedGeneral}</p>
                  </div>
                </div>
              </div>
            </div>
            {isAdmin && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800">
                <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-700">
                  <span className="text-sm text-slate-400" aria-hidden>
                    ⌕
                  </span>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Filtros
                  </h2>
                </div>
                <div className="p-3">
                  <label
                    htmlFor="dash-gen-filter-code"
                    className="text-[10px] font-medium text-slate-500 dark:text-slate-400"
                  >
                    Código de tarea
                  </label>
                  <input
                    id="dash-gen-filter-code"
                    type="text"
                    value={taskCodeQuery}
                    onChange={(e) => setTaskCodeQuery(e.target.value)}
                    placeholder="Ej. #0020"
                    className="mt-0.5 w-full rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:bg-white focus:outline-none dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100"
                  />
                </div>
              </div>
            )}
            <div className="min-h-[11rem] min-w-0">
              <DashboardAvisos />
            </div>
          </aside>
          <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Calendario
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setGeneralFilterByDate(false)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    !generalFilterByDate
                      ? "bg-agro-600 text-white dark:bg-agro-500"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  Todas las fechas
                </button>
                <button
                  type="button"
                  onClick={() => setGeneralFilterByDate(true)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    generalFilterByDate
                      ? "bg-agro-600 text-white dark:bg-agro-500"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  Filtrar por fecha
                </button>
              </div>
            </div>
            {generalFilterByDate ? (
              <>
                <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:grid-cols-7">
                  {weekDays.map(({ iso, dayName, dayNum }) => (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedDate(iso)}
                      className={`w-full rounded-lg border px-2.5 py-2 text-xs font-medium transition text-center ${
                        iso === selectedDate
                          ? "border-agro-500 bg-agro-100 text-agro-800 dark:border-agro-400 dark:bg-agro-900/40 dark:text-agro-200"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                      }`}
                    >
                      {dayName} {dayNum}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Mostrando tareas generales del <strong>{formatDateES(selectedDate)}</strong>
                </p>
              </>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Sin filtro de fecha. Mostrando todas las tareas generales pendientes.
              </p>
            )}
          </div>

          {/* Lista de tareas generales (solo columna Lista para empezar, tarjetas en grid 3x3) */}
          <div className="mt-3 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/90">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Lista para empezar
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {readyGeneral} tarea(s)
              </span>
            </div>
            {readyGeneral === 0 ? (
              <p className="py-3 text-sm text-slate-500 dark:text-slate-400">
                No hay tareas generales pendientes.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(generalTasksByStatus.get("ready") ?? []).map((task) => (
                  <TaskPreviewCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {INCIDENT_COLUMNS.map(({ status, label }) => {
            const list = incidentsByStatus.get(status) ?? [];
            return (
              <div
                key={status}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{list.length} caso(s)</span>
                </div>
                {list.length === 0 ? (
                  <p className="py-3 text-sm text-slate-500 dark:text-slate-400">
                    No hay incidentes en este estado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {list.map((incident) => (
                      <IncidentPreviewCard key={incident.id} incident={incident} />
        ))}
      </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para seleccionar semana con calendario completo */}
      {showWeekPicker && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowWeekPicker(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Elegir semana en el calendario"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-800 dark:border dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Elegir semana
              </h2>
              <button
                type="button"
                onClick={() => setShowWeekPicker(false)}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cerrar
              </button>
            </div>
            <DatePicker
              value={selectedDate}
              onChange={(value) => {
                if (typeof window !== "undefined") {
                  const y = window.scrollY;
                  setSelectedDate(value);
                  setShowWeekPicker(false);
                  window.scrollTo({ top: y, behavior: "auto" });
                } else {
                  setSelectedDate(value);
                  setShowWeekPicker(false);
                }
              }}
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Selecciona cualquier día de la semana que quieras ver en el dashboard.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

