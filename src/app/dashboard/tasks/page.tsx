"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { MOCK_TASKS, MOCK_WORKERS, MOCK_FARMS, TASK_TEMPLATES, MOCK_RECURRING_SCHEDULES } from "@/data/mock";
import type { Task, TaskStatus, TaskPriority, RecurringTaskSchedule, DayOfWeek } from "@/types";
import TaskCard from "@/components/TaskCard";

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
  { status: "ready", label: "Lista para empezar" },
  { status: "in_progress", label: "En desarrollo" },
  { status: "completed", label: "Finalizada" },
];

const STATUS_LABEL_BY_VALUE: Record<TaskStatus, string> = {
  ready: "Lista para empezar",
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
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{task.title}</h3>
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
      dragAttributes={attributes}
      isDragging={isDragging}
    />
  );
}

export default function TasksPage() {
  const isDesktop = useIsDesktop();
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [selectedDate, setSelectedDate] = useState<string>(() => todayISO());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [mobileStatusFilter, setMobileStatusFilter] = useState<TaskStatus | "all">("all");

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
  const [createMode, setCreateMode] = useState<CreateMode>("template");
  const [formTemplateId, setFormTemplateId] = useState(TASK_TEMPLATES[0]?.id ?? "");
  const [formCustomTitle, setFormCustomTitle] = useState("");
  const [formCustomDetails, setFormCustomDetails] = useState("");
  const [formWorkerId, setFormWorkerId] = useState(MOCK_WORKERS[0]?.id ?? "");
  const [formFarmId, setFormFarmId] = useState(MOCK_FARMS[0]?.id ?? "");
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium");
  const [formDate, setFormDate] = useState<string>(() => todayISO());

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
    return tasks.filter((t) => (t.date ?? today) === selectedDate);
  }, [tasks, selectedDate]);

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

  const openCreateModal = () => {
    setCreateMode("template");
    setFormTemplateId(TASK_TEMPLATES[0]?.id ?? "");
    setFormCustomTitle("");
    setFormCustomDetails("");
    setFormWorkerId(MOCK_WORKERS[0]?.id ?? "");
    setFormFarmId(MOCK_FARMS[0]?.id ?? "");
    setFormPriority("medium");
    setFormDate(selectedDate);
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
  };

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

  const selectedTemplate = TASK_TEMPLATES.find((t) => t.id === formTemplateId);
  const selectedRecurringTemplate = TASK_TEMPLATES.find((t) => t.id === recurringTemplateId);
  const farm = MOCK_FARMS.find((f) => f.id === formFarmId);
  const recurringFarm = MOCK_FARMS.find((f) => f.id === recurringFarmId);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    let title: string;
    let managerDetails: string;

    if (createMode === "template") {
      if (!selectedTemplate) return;
      title = selectedTemplate.title;
      managerDetails = selectedTemplate.managerDetails;
    } else {
      title = formCustomTitle.trim();
      managerDetails = formCustomDetails.trim();
      if (!title) return;
    }

    const newTask: Task = {
      id: `t${Date.now()}`,
      title,
      priority: formPriority,
      farmName: farm?.name ?? "Sin granja",
      workerId: formWorkerId,
      status: "ready",
      managerDetails: managerDetails || "Sin detalles.",
      comments: [],
      date: formDate,
    };
    setTasks((prev) => [...prev, newTask]);
    closeCreateModal();
  };

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
    const newTasks: Task[] = toCreate.map((s) => ({
      id: `t${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: s.title,
      priority: s.priority,
      farmName: s.farmName,
      workerId: s.workerId,
      status: "ready" as TaskStatus,
      managerDetails: s.managerDetails,
      comments: [],
      date: todayISO(),
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

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Calendario</p>
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

      {/* Modal crear tarea */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeCreateModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-task-title"
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-hidden flex flex-col dark:bg-slate-800 dark:border dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-600">
              <h2 id="create-task-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Crear tarea
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Elige una tarea preconfigurada o define una personalizada.
              </p>
            </div>
            <form onSubmit={handleCreateTask} className="flex flex-1 flex-col overflow-hidden">
              <div className="space-y-4 overflow-y-auto p-4">
                {/* Tipo: preconfigurada o personalizada */}
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de tarea</p>
                  <div className="flex gap-4">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="createMode"
                        checked={createMode === "template"}
                        onChange={() => setCreateMode("template")}
                        className="text-agro-600 focus:ring-agro-500"
                      />
                      <span className="text-sm dark:text-slate-200">Preconfigurada</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="createMode"
                        checked={createMode === "custom"}
                        onChange={() => setCreateMode("custom")}
                        className="text-agro-600 focus:ring-agro-500"
                      />
                      <span className="text-sm dark:text-slate-200">Personalizada</span>
                    </label>
                  </div>
                </div>

                {createMode === "template" ? (
                  <div>
                    <label htmlFor="task-template" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Tarea preconfigurada
                    </label>
                    <select
                      id="task-template"
                      value={formTemplateId}
                      onChange={(e) => setFormTemplateId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                    >
                      {TASK_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                    {selectedTemplate && (
                      <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {selectedTemplate.managerDetails}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="custom-title" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Título de la tarea
                      </label>
                      <input
                        id="custom-title"
                        type="text"
                        value={formCustomTitle}
                        onChange={(e) => setFormCustomTitle(e.target.value)}
                        placeholder="Ej. Revisar bomba de agua"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-details" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Detalles (opcional)
                      </label>
                      <textarea
                        id="custom-details"
                        value={formCustomDetails}
                        onChange={(e) => setFormCustomDetails(e.target.value)}
                        placeholder="Instrucciones para el trabajador..."
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                )}

                {/* Trabajador */}
                <div>
                  <label htmlFor="task-worker" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Asignar a
                  </label>
                  <select
                    id="task-worker"
                    value={formWorkerId}
                    onChange={(e) => setFormWorkerId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                  >
                    {MOCK_WORKERS.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Granja */}
                <div>
                  <label htmlFor="task-farm" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Granja
                  </label>
                  <select
                    id="task-farm"
                    value={formFarmId}
                    onChange={(e) => setFormFarmId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                  >
                    {MOCK_FARMS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Importancia */}
                <div>
                  <label htmlFor="task-priority" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Importancia
                  </label>
                  <select
                    id="task-priority"
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fecha */}
                <div>
                  <label htmlFor="task-date" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Fecha de la tarea
                  </label>
                  <input
                    id="task-date"
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-600">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMode === "custom" && !formCustomTitle.trim()}
                  className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white hover:bg-agro-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Crear tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal tarea periódica */}
      {recurringModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeRecurringModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="recurring-task-title"
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-hidden flex flex-col dark:bg-slate-800 dark:border dark:border-slate-600"
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
