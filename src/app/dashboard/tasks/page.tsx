"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

// DndContext y DragOverlay son componentes pesados (no hooks): se cargan en diferido
// para no bloquear el render inicial de la página de tareas.
const DndContext = dynamic(
  () => import("@dnd-kit/core").then((m) => ({ default: m.DndContext })),
  { ssr: false }
);
const DragOverlay = dynamic(
  () => import("@dnd-kit/core").then((m) => ({ default: m.DragOverlay })),
  { ssr: false }
);
import { MOCK_WORKERS, MOCK_FARMS, TASK_TEMPLATES, MOCK_RECURRING_SCHEDULES } from "@/data/mock";
import type { Task, TaskStatus, TaskPriority, RecurringTaskSchedule, DayOfWeek, UserRole } from "@/types";
import { USER_ROLE, formatTaskId } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { MODAL_BACKDROP_CENTER, modalFramePanel } from "@/components/modalShell";
import { useTasks } from "@/contexts/TasksContext";
import TaskCard from "@/components/TaskCard";
import CreateTaskModal from "@/components/CreateTaskModal";
import DashboardAvisos from "@/components/DashboardAvisos";

/** Semana en español: lunes = primer día */
const WEEKDAY_NAMES_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const DAY_LABELS: { value: DayOfWeek; label: string }[] = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" },
];

const STATUS_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "ready", label: "Pendientes" },
  { status: "in_progress", label: "En desarrollo" },
  { status: "completed", label: "Finalizada" },
];

const STATUS_LABEL_BY_VALUE: Record<TaskStatus, string> = {
  ready: "Pendientes",
  in_progress: "En desarrollo",
  completed: "Finalizada",
};

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
];

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

type CreateMode = "template" | "custom";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Formatea YYYY-MM-DD en español (ej: "lunes, 10 de marzo de 2025") */
function formatDateES(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function getWorkerName(workerId: string): string {
  const worker = MOCK_WORKERS.find((w) => w.id === workerId);
  return worker?.name ?? "Sin asignar";
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    setIsDesktop(m.matches);
    const fn = () => setIsDesktop(m.matches);
    m.addEventListener("change", fn);
    return () => m.removeEventListener("change", fn);
  }, []);
  return isDesktop;
}

/** Vista compacta de la tarjeta para el overlay de arrastre (sigue al cursor) */
function TaskCardOverlayContent({ task, workerName }: { task: Task; workerName: string }) {
  const priorityBorder =
    task.priority === "high"
      ? "border-l-red-500"
      : task.priority === "medium"
        ? "border-l-amber-500"
        : "border-l-slate-400";
  const priorityBadge =
    task.priority === "high"
      ? "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : task.priority === "medium"
        ? "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
  return (
    <div
      className={`rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800 ${priorityBorder} cursor-grabbing rotate-2 scale-105`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
          <span className="text-slate-500 dark:text-slate-400 font-normal mr-2">#{formatTaskId(task.taskNumber ?? 0)}</span>
          {task.title}
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${priorityBadge}`}>
          {task.priority}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {task.farmName} · {workerName}
      </p>
    </div>
  );
}

/** Columna que acepta soltar tarjetas (solo PC con dnd-kit) */
function DroppableColumn({ status, children }: { status: TaskStatus; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] flex-1 space-y-3 p-3 transition-colors duration-150 ${
        isOver ? "rounded-lg bg-agro-100/50 dark:bg-agro-900/20" : ""
      }`}
    >
      {children}
    </div>
  );
}

/** Envuelve TaskCard para hacerla draggable con dnd-kit (solo PC) */
function DraggableTaskCard({
  task,
  ...taskCardProps
}: { task: Task } & React.ComponentProps<typeof TaskCard>) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <TaskCard
      task={task}
      {...taskCardProps}
      dragRef={setNodeRef}
      dragListeners={listeners}
      dragAttributes={attributes as unknown as Record<string, unknown>}
      isDragging={isDragging}
    />
  );
}

export default function TasksPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const role: UserRole | undefined = user?.role;
  const isSuperAdmin = role === USER_ROLE.SuperAdmin;
  const isAdmin = role === USER_ROLE.Admin || isSuperAdmin || role === USER_ROLE.Manager;
  const isDesktop = useIsDesktop();
  const { tasks, setTasks, getNextTaskNumber } = useTasks();
  const [selectedDate, setSelectedDate] = useState<string>(() => todayISO());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [mobileStatusFilter, setMobileStatusFilter] = useState<TaskStatus | "all">("all");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("all");
  const [selectedFarmId, setSelectedFarmId] = useState<string>("all");
  const [workerQuery, setWorkerQuery] = useState<string>("");
  const [farmQuery, setFarmQuery] = useState<string>("");
  const [taskCodeQuery, setTaskCodeQuery] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDndDragStart = (e: DragStartEvent) => setActiveDragId(String(e.active.id));
  const handleDndDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over?.id || active.id === over.id) return;
    const newStatus = String(over.id) as TaskStatus;
    if (newStatus !== "ready" && newStatus !== "in_progress" && newStatus !== "completed") return;
    handleStatusChange(String(active.id), newStatus);
  };
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [recurringSchedules, setRecurringSchedules] = useState<RecurringTaskSchedule[]>(MOCK_RECURRING_SCHEDULES);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [recurringMode, setRecurringMode] = useState<CreateMode>("template");
  const [recurringTemplateId, setRecurringTemplateId] = useState(TASK_TEMPLATES[0]?.id ?? "");
  const [recurringCustomTitle, setRecurringCustomTitle] = useState("");
  const [recurringCustomDetails, setRecurringCustomDetails] = useState("");
  const [recurringWorkerId, setRecurringWorkerId] = useState(MOCK_WORKERS[0]?.id ?? "");
  const [recurringFarmId, setRecurringFarmId] = useState(MOCK_FARMS[0]?.id ?? "");
  const [recurringPriority, setRecurringPriority] = useState<TaskPriority>("medium");
  const [recurringDays, setRecurringDays] = useState<DayOfWeek[]>([1, 2, 3, 4, 5]);

  const tasksForSelectedDate = useMemo(() => {
    const today = todayISO();
    let list = tasks.filter((t) => (t.date ?? today) === selectedDate);

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

      // Filtro por código de tarea (#0001, #0020, etc.)
      const codeQ = taskCodeQuery.replace(/^#/, "").trim();
      if (codeQ) {
        list = list.filter((t) => {
          const code = formatTaskId(t.taskNumber ?? 0);
          return code.includes(codeQ) || String(t.taskNumber ?? "").includes(codeQ);
        });
      }
    }

    return list;
  }, [tasks, selectedDate, isAdmin, selectedWorkerId, workerQuery, selectedFarmId, farmQuery, taskCodeQuery]);

  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const { status } of STATUS_COLUMNS) {
      const list = tasksForSelectedDate
        .filter((t) => t.status === status)
        .slice()
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
      map.set(status, list);
    }
    return map;
  }, [tasksForSelectedDate]);

  const taskCountTotal = tasksForSelectedDate.length;
  const taskCountReady = tasksByStatus.get("ready")?.length ?? 0;
  const taskCountInProgress = tasksByStatus.get("in_progress")?.length ?? 0;
  const taskCountCompleted = tasksByStatus.get("completed")?.length ?? 0;

  /** 7 días: lunes a domingo de la semana que contiene selectedDate (lunes = primer día) */
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

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    const movedTask = tasks.find((t) => t.id === taskId);
    const statusLabel = STATUS_LABEL_BY_VALUE[newStatus];
    if (movedTask) {
      setToastMessage(`"${movedTask.title}" → ${statusLabel}`);
    }
  };

  const handleUpdateComments = (taskId: string, comments: string[]) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, comments } : t))
    );
  };

  // Oculta el mensaje flotante tras un corto periodo
  useEffect(() => {
    if (!toastMessage) return;
    const timeout = setTimeout(() => setToastMessage(null), 2200);
    return () => clearTimeout(timeout);
  }, [toastMessage]);

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleDateChange = (taskId: string, newDate: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId && t.status !== "completed" ? { ...t, date: newDate } : t
      )
    );
  };

  const openCreateModal = () => setCreateModalOpen(true);
  const closeCreateModal = () => setCreateModalOpen(false);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateModalOpen(true);
      router.replace("/dashboard/tasks", { scroll: false });
    }
  }, [searchParams, router]);

  const openRecurringModal = () => {
    setRecurringMode("template");
    setRecurringTemplateId(TASK_TEMPLATES[0]?.id ?? "");
    setRecurringCustomTitle("");
    setRecurringCustomDetails("");
    setRecurringWorkerId(MOCK_WORKERS[0]?.id ?? "");
    setRecurringFarmId(MOCK_FARMS[0]?.id ?? "");
    setRecurringPriority("medium");
    setRecurringDays([1, 2, 3, 4, 5]);
    setRecurringModalOpen(true);
  };

  const closeRecurringModal = () => setRecurringModalOpen(false);

  const toggleRecurringDay = (d: DayOfWeek) => {
    setRecurringDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  };

  /** Devuelve 1=Lun ... 7=Dom */
  const getTodayDayOfWeek = (): DayOfWeek => {
    const d = new Date().getDay();
    return (d === 0 ? 7 : d) as DayOfWeek;
  };

  const selectedRecurringTemplate = TASK_TEMPLATES.find((t) => t.id === recurringTemplateId);
  const recurringFarm = MOCK_FARMS.find((f) => f.id === recurringFarmId);

  const handleCreateRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    if (recurringDays.length === 0) return;
    let title: string;
    let managerDetails: string;
    if (recurringMode === "template") {
      if (!selectedRecurringTemplate) return;
      title = selectedRecurringTemplate.title;
      managerDetails = selectedRecurringTemplate.managerDetails;
    } else {
      title = recurringCustomTitle.trim();
      managerDetails = recurringCustomDetails.trim();
      if (!title) return;
    }
    const newSchedule: RecurringTaskSchedule = {
      id: `r${Date.now()}`,
      title,
      managerDetails: managerDetails || "Sin detalles.",
      workerId: recurringWorkerId,
      farmName: recurringFarm?.name ?? "Sin granja",
      priority: recurringPriority,
      daysOfWeek: [...recurringDays],
    };
    setRecurringSchedules((prev) => [...prev, newSchedule]);
    closeRecurringModal();
  };

  const handleDeleteRecurring = (id: string) => {
    setRecurringSchedules((prev) => prev.filter((r) => r.id !== id));
  };

  const generateTodayTasks = () => {
    const today = getTodayDayOfWeek();
    const toCreate = recurringSchedules.filter((s) => s.daysOfWeek.includes(today));
    const todayIso = todayISO();
    let nextNum = getNextTaskNumber();
    const newTasks: Task[] = toCreate.map((s) => ({
      id: `t${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      taskNumber: nextNum++,
      title: s.title,
      priority: s.priority,
      farmName: s.farmName,
      workerId: s.workerId,
      status: "ready" as TaskStatus,
      managerDetails: s.managerDetails,
      comments: [],
      createdAt: todayIso,
      date: todayIso,
    }));
    setTasks((prev) => [...prev, ...newTasks]);
  };

  const formatDays = (days: DayOfWeek[]) =>
    days.sort((a, b) => a - b).map((d) => DAY_LABELS.find((x) => x.value === d)?.label ?? d).join(", ");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Tareas</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Elige un día en el calendario para ver sus tareas. Crea tareas para hoy o para fechas futuras.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-agro-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-agro-700"
          >
            Crear tarea
          </button>
          <button
            type="button"
            onClick={openRecurringModal}
            className="rounded-lg border border-agro-600 bg-white px-4 py-2.5 text-sm font-medium text-agro-700 transition hover:bg-agro-50 dark:border-agro-500 dark:bg-slate-800 dark:text-agro-300 dark:hover:bg-slate-700"
          >
            Tarea periódica
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(320px,400px)_1fr] lg:items-start lg:gap-8">
        <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-4 lg:self-start">
          {/* Contexto: un solo bloque, jerarquía clara, sin cajas anidadas */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-md dark:border-slate-600 dark:bg-slate-800">
            <p className="text-xs font-bold uppercase tracking-widest text-agro-600 dark:text-agro-400">
              Contexto del día
            </p>
            <p className="mt-3 text-lg font-bold leading-snug text-slate-900 dark:text-slate-50">
              {formatDateES(selectedDate)}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Resumen de tareas para la fecha seleccionada en el calendario.
            </p>
            <div className="mt-6 flex flex-col items-center rounded-xl bg-slate-50 py-5 dark:bg-slate-900/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total del día
              </p>
              <p className="mt-1 text-4xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                {taskCountTotal}
              </p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">tareas</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-amber-50 px-2 py-4 text-center dark:bg-amber-950/40">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  Inicio
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {taskCountReady}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 px-2 py-4 text-center dark:bg-blue-950/40">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200">
                  Curso
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {taskCountInProgress}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 px-2 py-4 text-center dark:bg-emerald-950/40">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                  Fin
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {taskCountCompleted}
                </p>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <DashboardAvisos variant="comfortable" />
          </div>
          {isAdmin && (
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-md dark:border-slate-600 dark:bg-slate-800">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-600 dark:bg-slate-700 dark:text-slate-300" aria-hidden>
                  ⌕
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Filtros</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Refina las tareas del día</p>
                </div>
              </div>
              <div className="flex flex-col gap-5 p-5">
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Persona
                  </p>
                  <div className="flex flex-col gap-4">
                    <div>
                      <label htmlFor="tasks-filter-worker" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Trabajador
                      </label>
                      <select
                        id="tasks-filter-worker"
                        value={selectedWorkerId}
                        onChange={(e) => setSelectedWorkerId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-agro-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:bg-slate-900"
                      >
                        <option value="all">Todos los trabajadores</option>
                        {MOCK_WORKERS.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="tasks-filter-worker-txt" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Buscar por nombre
                      </label>
                      <input
                        id="tasks-filter-worker-txt"
                        type="text"
                        value={workerQuery}
                        onChange={(e) => setWorkerQuery(e.target.value)}
                        placeholder="Escribe un nombre…"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-agro-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>
                <div className="h-px bg-slate-100 dark:bg-slate-700" aria-hidden />
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Ubicación
                  </p>
                  <div className="flex flex-col gap-4">
                    <div>
                      <label htmlFor="tasks-filter-farm" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Granja
                      </label>
                      <select
                        id="tasks-filter-farm"
                        value={selectedFarmId}
                        onChange={(e) => setSelectedFarmId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-agro-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:bg-slate-900"
                      >
                        <option value="all">Todas las granjas</option>
                        {MOCK_FARMS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="tasks-filter-farm-txt" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Buscar granja
                      </label>
                      <input
                        id="tasks-filter-farm-txt"
                        type="text"
                        value={farmQuery}
                        onChange={(e) => setFarmQuery(e.target.value)}
                        placeholder="Nombre de la granja…"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-agro-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>
                <div className="h-px bg-slate-100 dark:bg-slate-700" aria-hidden />
                <div>
                  <label htmlFor="tasks-filter-code" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Código de tarea
                  </label>
                  <input
                    id="tasks-filter-code"
                    type="text"
                    maxLength={12}
                    value={taskCodeQuery}
                    onChange={(e) => setTaskCodeQuery(e.target.value)}
                    placeholder="Ej. 0020 o #0020"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-agro-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:bg-slate-900"
                  />
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3.5 dark:bg-slate-900/40">
                  {taskCodeQuery.trim() ||
                  selectedWorkerId !== "all" ||
                  workerQuery.trim() ||
                  selectedFarmId !== "all" ||
                  farmQuery.trim() ? (
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Aplicado: </span>
                      {taskCodeQuery.trim() && <>código «{taskCodeQuery.trim()}»</>}
                      {taskCodeQuery.trim() &&
                        (selectedWorkerId !== "all" ||
                          workerQuery.trim() ||
                          selectedFarmId !== "all" ||
                          farmQuery.trim()) &&
                        " · "}
                      {selectedWorkerId !== "all" &&
                        (MOCK_WORKERS.find((w) => w.id === selectedWorkerId)?.name ?? "")}
                      {workerQuery.trim() && ` búsqueda «${workerQuery.trim()}»`}
                      {selectedFarmId !== "all" &&
                        ` · ${MOCK_FARMS.find((f) => f.id === selectedFarmId)?.name ?? ""}`}
                      {farmQuery.trim() && ` · granja «${farmQuery.trim()}»`}
                    </p>
                  ) : (
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                      Sin filtros: se muestran todas las tareas del día.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Semana operativa</p>
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

      {recurringSchedules.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 font-semibold text-slate-800">Tareas periódicas</h3>
          <p className="mb-3 text-sm text-slate-600">
            Se crean automáticamente en los días indicados. Pulsa &quot;Generar tareas de hoy&quot; para crear las que correspondan a hoy.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {recurringSchedules.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">{s.title}</span>
                <span className="text-slate-500">({formatDays(s.daysOfWeek)})</span>
                <button
                  type="button"
                  onClick={() => handleDeleteRecurring(s.id)}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Eliminar programación"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={generateTodayTasks}
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Generar tareas de hoy
          </button>
        </div>
      )}

      {/* Filtro de columnas solo en móvil */}
      <div className="flex gap-2 md:hidden">
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

      {isDesktop ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDndDragStart}
          onDragEnd={handleDndDragEnd}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STATUS_COLUMNS.map(({ status, label }) => (
              <div
                key={status}
                className={`flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm dark:border-slate-700 dark:bg-slate-800/50 ${
                  mobileStatusFilter !== "all" && mobileStatusFilter !== status ? "hidden md:flex" : ""
                }`}
              >
                <div className="rounded-t-xl border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                  <h2 className="font-semibold text-slate-800 dark:text-slate-200">{label}</h2>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    {(tasksByStatus.get(status) ?? []).length} tarea(s)
                  </p>
                </div>
                <DroppableColumn status={status}>
                  {(tasksByStatus.get(status) ?? []).length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-500">Ninguna</p>
                  ) : (
                    (tasksByStatus.get(status) ?? []).map((task) => (
                      <DraggableTaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={handleStatusChange}
                        onUpdateComments={handleUpdateComments}
                        onDelete={handleDeleteTask}
                        onDateChange={handleDateChange}
                        workerName={getWorkerName(task.workerId)}
                      />
                    ))
                  )}
                </DroppableColumn>
              </div>
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDragId ? (() => {
              const task = tasks.find((t) => t.id === activeDragId);
              return task ? (
                <TaskCardOverlayContent
                  task={task}
                  workerName={getWorkerName(task.workerId)}
                />
              ) : null;
            })() : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STATUS_COLUMNS.map(({ status, label }) => (
            <div
              key={status}
              className={`flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm dark:border-slate-700 dark:bg-slate-800/50 ${
                mobileStatusFilter !== "all" && mobileStatusFilter !== status ? "hidden md:flex" : ""
              }`}
            >
              <div className="rounded-t-xl border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <h2 className="font-semibold text-slate-800 dark:text-slate-200">{label}</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {(tasksByStatus.get(status) ?? []).length} tarea(s)
                </p>
              </div>
              <div
                className="min-h-[120px] flex-1 space-y-3 p-3"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData("taskId");
                  if (taskId) handleStatusChange(taskId, status);
                }}
              >
                {(tasksByStatus.get(status) ?? []).length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">Ninguna</p>
                ) : (
                  (tasksByStatus.get(status) ?? []).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onUpdateComments={handleUpdateComments}
                      onDelete={handleDeleteTask}
                      onDateChange={handleDateChange}
                      workerName={getWorkerName(task.workerId)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

        </div>
      </div>

      <CreateTaskModal
        open={createModalOpen}
        onClose={closeCreateModal}
        defaultDate={selectedDate}
      />

      {/* Modal tarea periódica */}
      {recurringModalOpen && (
        <div
          className={`fixed inset-0 z-50 ${MODAL_BACKDROP_CENTER}`}
          onClick={closeRecurringModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="recurring-task-title"
        >
          <div
            className={modalFramePanel("lg", { className: "flex flex-col" })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-600">
              <h2 id="recurring-task-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Tarea periódica
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Elige los días de la semana en que se creará la tarea automáticamente.
              </p>
            </div>
            <form onSubmit={handleCreateRecurring} className="flex flex-1 flex-col overflow-hidden">
              <div className="space-y-4 overflow-y-auto p-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de tarea</p>
                  <div className="flex gap-4">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="recurringMode"
                        checked={recurringMode === "template"}
                        onChange={() => setRecurringMode("template")}
                        className="text-agro-600 focus:ring-agro-500"
                      />
                      <span className="text-sm dark:text-slate-200">Preconfigurada</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="recurringMode"
                        checked={recurringMode === "custom"}
                        onChange={() => setRecurringMode("custom")}
                        className="text-agro-600 focus:ring-agro-500"
                      />
                      <span className="text-sm dark:text-slate-200">Personalizada</span>
                    </label>
                  </div>
                </div>

                {recurringMode === "template" ? (
                  <div>
                    <label htmlFor="recurring-template" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Tarea preconfigurada
                    </label>
                    <select
                      id="recurring-template"
                      value={recurringTemplateId}
                      onChange={(e) => setRecurringTemplateId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                    >
                      {TASK_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                    {selectedRecurringTemplate && (
                      <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {selectedRecurringTemplate.managerDetails}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="recurring-custom-title" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Título de la tarea
                      </label>
                      <input
                        id="recurring-custom-title"
                        type="text"
                        value={recurringCustomTitle}
                        onChange={(e) => setRecurringCustomTitle(e.target.value)}
                        placeholder="Ej. Revisar bomba de agua"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label htmlFor="recurring-custom-details" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Detalles (opcional)
                      </label>
                      <textarea
                        id="recurring-custom-details"
                        value={recurringCustomDetails}
                        onChange={(e) => setRecurringCustomDetails(e.target.value)}
                        placeholder="Instrucciones para el trabajador..."
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="recurring-worker" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Asignar a
                  </label>
                  <select
                    id="recurring-worker"
                    value={recurringWorkerId}
                    onChange={(e) => setRecurringWorkerId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                  >
                    {MOCK_WORKERS.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="recurring-farm" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Granja
                  </label>
                  <select
                    id="recurring-farm"
                    value={recurringFarmId}
                    onChange={(e) => setRecurringFarmId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                  >
                    {MOCK_FARMS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="recurring-priority" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Importancia
                  </label>
                  <select
                    id="recurring-priority"
                    value={recurringPriority}
                    onChange={(e) => setRecurringPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Crear automáticamente los días de la semana
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map(({ value, label }) => (
                      <label
                        key={value}
                        className={`flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm transition ${
                          recurringDays.includes(value)
                            ? "border-agro-500 bg-agro-50 text-agro-800 dark:border-agro-400 dark:bg-agro-900/40 dark:text-agro-200"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={recurringDays.includes(value)}
                          onChange={() => toggleRecurringDay(value)}
                          className="sr-only"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {recurringDays.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Selecciona al menos un día.</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-600">
                <button
                  type="button"
                  onClick={closeRecurringModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={recurringDays.length === 0 || (recurringMode === "custom" && !recurringCustomTitle.trim())}
                  className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white hover:bg-agro-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Crear programación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Toast / mensaje flotante poco invasivo para cambios de estado */}
      {toastMessage && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="max-w-sm rounded-full bg-slate-900/90 px-4 py-2 text-xs font-medium text-slate-50 shadow-lg backdrop-blur-sm">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}
