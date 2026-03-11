"use client";

import { useMemo, useState } from "react";
import { MOCK_TASKS, MOCK_WORKERS, MOCK_ANIMAL_CASES, MOCK_ANIMALS } from "@/data/mock";
import type { Task, TaskStatus, AnimalCase, IncidentStatus } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

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

function TaskPreviewCard({ task }: TaskPreviewProps) {
  const priorityBorder =
    task.priority === "high"
      ? "border-l-red-500"
      : task.priority === "medium"
      ? "border-l-amber-500"
      : "border-l-slate-400";

  return (
    <div className={`rounded-xl border border-slate-200 border-l-4 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:${priorityBorder} ${priorityBorder}`}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{task.title}</h3>
      <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        {getWorkerName(task.workerId)}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {task.farmName} · {task.priority === "high" ? "Alta" : task.priority === "medium" ? "Media" : "Baja"}
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

  return (
    <div className="rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:border-l-amber-500">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {getAnimalName(incident.animalId)}
      </h3>
      <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{incident.caseType}</p>
      <p className="mt-1 text-sm text-slate-600 line-clamp-2 dark:text-slate-300">{incident.summary}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Gravedad: <span className="font-medium">{severityLabel}</span> · Fecha: {incident.date}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.email === "admin@agro.local";

  const [selectedDate, setSelectedDate] = useState<string>(() => todayISO());
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("all");
  const [activeSection, setActiveSection] = useState<"tasks" | "incidents">("tasks");
  const [mobileStatusFilter, setMobileStatusFilter] = useState<TaskStatus | "all">("all");

  const tasksForSelectedDateBase = useMemo(() => {
    const today = todayISO();
    return MOCK_TASKS.filter((t) => (t.date ?? today) === selectedDate);
  }, [selectedDate]);

  const tasksForSelectedDate = useMemo(() => {
    if (!isAdmin || selectedWorkerId === "all") return tasksForSelectedDateBase;
    return tasksForSelectedDateBase.filter((t) => t.workerId === selectedWorkerId);
  }, [isAdmin, selectedWorkerId, tasksForSelectedDateBase]);

  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const { status } of STATUS_COLUMNS) {
      map.set(status, tasksForSelectedDate.filter((t) => t.status === status));
    }
    return map;
  }, [tasksForSelectedDate]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Resumen de tareas y animales. La parte de tareas está ligada al calendario; la de animales es solo informativa.
        </p>
      </div>

      {/* Pestañas: tareas / animales */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm dark:border-slate-600 dark:bg-slate-800">
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
            onClick={() => setActiveSection("incidents")}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              activeSection === "incidents"
                ? "bg-agro-600 text-white dark:bg-agro-500"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            Animales con incidentes
          </button>
        </div>
      </div>

      {/* Filtro por trabajador: solo en pestaña de tareas y para admins */}
      {activeSection === "tasks" && isAdmin && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Trabajador:
          </span>
          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="min-w-[220px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="all">Todos los trabajadores</option>
            {MOCK_WORKERS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          {selectedWorkerId !== "all" && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Mostrando solo tareas de {MOCK_WORKERS.find((w) => w.id === selectedWorkerId)?.name}.
            </span>
          )}
        </div>
      )}

      {/* Bloques resumen: cambian según pestaña activa */}
      {activeSection === "tasks" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800 md:col-span-1">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              Fecha
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {formatDateES(selectedDate)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              Total tareas
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 text-center dark:text-slate-100">{totalTasks}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              Listas para empezar
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-500 text-center">{ready}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              En curso
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-500 text-center">
              {inProgress}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              Finalizadas
            </p>
            <p className="mt-1 text-2xl font-bold text-green-500 text-center">
              {completed}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              Total incidentes
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {incidentsForSelectedDate.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              Reportados
            </p>
            <p className="mt-1 text-xl font-bold text-red-500">
              {(incidentsByStatus.get("reported") ?? []).length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              En tratamiento
            </p>
            <p className="mt-1 text-xl font-bold text-amber-500">
              {(incidentsByStatus.get("in_treatment") ?? []).length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
              Resueltos
            </p>
            <p className="mt-1 text-xl font-bold text-green-500">
              {(incidentsByStatus.get("resolved") ?? []).length}
            </p>
          </div>
        </div>
      )}

      {/* Contenido principal según pestaña */}
      {activeSection === "tasks" ? (
        <>
          {/* Calendario arriba */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Calendario (solo lectura)</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600"
                >
                  ← Semana anterior
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600"
                >
                  Semana siguiente →
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
              {weekDays.map(({ iso, dayName, dayNum }) => (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDate(iso)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm font-medium transition text-center ${
                    iso === selectedDate
                      ? "border-agro-500 bg-agro-100 text-agro-800 dark:border-agro-400 dark:bg-agro-900/40 dark:text-agro-200"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {dayName} {dayNum}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Mostrando tareas del <strong>{formatDateES(selectedDate)}</strong>
            </p>
          </div>

          {/* Filtro de columnas solo en móvil */}
          <div className="mt-4 flex gap-2 md:hidden">
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
          <div className="grid gap-4 md:grid-cols-3">
            {STATUS_COLUMNS.map(({ status, label }) => {
              const list = tasksByStatus.get(status) ?? [];
              return (
                <div
                  key={status}
                  className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800 ${
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
        </>
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
    </div>
  );
}

