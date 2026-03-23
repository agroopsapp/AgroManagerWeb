"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/contexts/TasksContext";
import { MOCK_WORKERS, MOCK_FARMS } from "@/data/mock";
import { USER_ROLE, formatTaskId } from "@/types";
import type { Task, TaskFamily } from "@/types";
import DatePicker from "@/components/DatePicker";
import CreateTaskModal from "@/components/CreateTaskModal";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const TASK_FAMILY_LABELS: Record<TaskFamily, string> = {
  veterinaria: "Veterinaria",
  campo: "Campo",
  alimentacion: "Alimentación",
  limpieza: "Limpieza",
};

export default function UnassignedTasksPage() {
  const { user } = useAuth();
  const { generalTasks, setGeneralTasks, assignUnassignedTask } = useTasks();
  const role = user?.role;
  const canAccess =
    role === USER_ROLE.Admin || role === USER_ROLE.SuperAdmin || role === USER_ROLE.Manager;

  const [assigningTask, setAssigningTask] = useState<Task | null>(null);
  const [assignWorkerId, setAssignWorkerId] = useState<string>("");
  const [assignFarmId, setAssignFarmId] = useState<string>("");
  const [assignDate, setAssignDate] = useState<string>(() => todayISO());

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [taskCodeQuery, setTaskCodeQuery] = useState("");
  const [filterFamily, setFilterFamily] = useState<TaskFamily | "">("");

  const generalTasksFiltered = useMemo(() => {
    let list = generalTasks;
    const codeQ = taskCodeQuery.replace(/^#/, "").trim();
    if (codeQ) {
      list = list.filter((t) => {
        const code = formatTaskId(t.taskNumber ?? 0);
        return code.includes(codeQ) || String(t.taskNumber ?? "").includes(codeQ);
      });
    }
    if (filterFamily) {
      list = list.filter((t) => t.family === filterFamily);
    }
    return list;
  }, [generalTasks, taskCodeQuery, filterFamily]);

  const openAssign = (task: Task) => {
    setAssigningTask(task);
    setAssignWorkerId("");
    // Preseleccionar la granja si la tarea ya tiene una (ej. "Granja Norte")
    const farm = MOCK_FARMS.find((f) => f.name === task.farmName);
    setAssignFarmId(farm ? farm.id : "");
    setAssignDate(task.date ?? todayISO());
  };

  const closeAssign = () => {
    setAssigningTask(null);
  };

  /** Guardar: si hay trabajador asigna y pasa a Tasks; si no, solo actualiza granja y fecha. Cierra el modal y se queda en la misma página. */
  const handleGuardar = () => {
    if (!assigningTask) return;
    const farm = MOCK_FARMS.find((f) => f.id === assignFarmId);
    const farmName = farm ? farm.name : "Sin asignar a granja";
    const worker = MOCK_WORKERS.find((w) => w.id === assignWorkerId);
    if (worker) {
      assignUnassignedTask(assigningTask.id, {
        workerId: worker.id,
        farmName,
        date: assignDate,
      });
    } else {
      setGeneralTasks((prev) =>
        prev.map((t) =>
          t.id === assigningTask.id ? { ...t, farmName, date: assignDate } : t
        )
      );
    }
    closeAssign();
  };

  const openCreateModal = () => setCreateModalOpen(true);
  const closeCreateModal = () => setCreateModalOpen(false);

  if (!canAccess) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        <p className="font-medium">Sin acceso</p>
        <p className="mt-1 text-sm">
          Solo administradores pueden gestionar tareas sin asignar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Tareas sin asignar
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Puedes cambiar granja y fecha sin asignar; la tarea solo sale de esta lista cuando asignas un responsable (trabajador).
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="shrink-0 rounded-lg bg-agro-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-agro-700"
        >
          Crear tarea
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <span className="text-slate-400 dark:text-slate-500" aria-hidden>⌕</span>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Filtros</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="unassigned-filter-code" className="text-xs font-medium text-slate-500 dark:text-slate-400">Código de tarea</label>
            <input
              id="unassigned-filter-code"
              type="text"
              value={taskCodeQuery}
              onChange={(e) => setTaskCodeQuery(e.target.value)}
              placeholder="Ej. 0020 o #0020"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-agro-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-700 dark:focus:ring-agro-500/30"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="unassigned-filter-family" className="text-xs font-medium text-slate-500 dark:text-slate-400">Familia de tarea</label>
            <select
              id="unassigned-filter-family"
              value={filterFamily}
              onChange={(e) => setFilterFamily((e.target.value || "") as TaskFamily | "")}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 transition-colors focus:border-agro-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-agro-500/20 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100 dark:focus:bg-slate-700 dark:focus:ring-agro-500/30"
            >
              <option value="">Todas</option>
              {(Object.entries(TASK_FAMILY_LABELS) as [TaskFamily, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {generalTasksFiltered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-600 dark:bg-slate-800">
          <p className="text-slate-600 dark:text-slate-400">
            {generalTasks.length === 0
              ? "No hay tareas sin asignar en este momento."
              : "Ninguna tarea coincide con los filtros."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {generalTasksFiltered.map((task) => (
            <UnassignedCard key={task.id} task={task} onAssign={() => openAssign(task)} />
          ))}
        </div>
      )}

      {/* Modal asignar */}
      {assigningTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-600 dark:bg-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Asignar tarea
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
              {assigningTask.title}
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Trabajador
                </label>
                <select
                  value={assignWorkerId}
                  onChange={(e) => setAssignWorkerId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {MOCK_WORKERS.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Granja
                </label>
                <select
                  value={assignFarmId}
                  onChange={(e) => setAssignFarmId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="">Sin asignar a granja</option>
                  {MOCK_FARMS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Día de ejecución
                </label>
                <DatePicker
                  value={assignDate}
                  onChange={setAssignDate}
                  className="rounded-lg border border-slate-200 dark:border-slate-500 dark:bg-slate-700"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAssign}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardar}
                className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white hover:bg-agro-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateTaskModal open={createModalOpen} onClose={closeCreateModal} />
    </div>
  );
}

function UnassignedCard({
  task,
  onAssign,
}: {
  task: Task;
  onAssign: () => void;
}) {
  const createdISO = task.createdAt ?? todayISO();
  const createdLabel = new Date(createdISO + "T12:00:00").toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const priorityBorder =
    task.priority === "high"
      ? "border-l-red-500"
      : task.priority === "medium"
      ? "border-l-amber-400"
      : "border-l-slate-300";

  return (
    <div
      className={`rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800 ${priorityBorder}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
          <span className="text-slate-500 dark:text-slate-400 font-normal mr-1.5">#{formatTaskId(task.taskNumber ?? 0)}</span>
          {task.title}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
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
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Creada: {createdLabel}
      </p>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
        Granja: {task.farmName || "Sin asignar a granja"}
      </p>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
        Responsable: Sin asignar
      </p>
      {task.family && (
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
          Familia: {TASK_FAMILY_LABELS[task.family]}
        </p>
      )}
      {task.managerDetails && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
          {task.managerDetails}
        </p>
      )}
      <button
        type="button"
        onClick={onAssign}
        className="mt-3 w-full rounded-lg bg-agro-600 py-2 text-sm font-medium text-white hover:bg-agro-700"
      >
        Asignar
      </button>
    </div>
  );
}
