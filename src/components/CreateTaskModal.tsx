"use client";

import { useState, useEffect } from "react";
import { useTasks } from "@/contexts/TasksContext";
import { TASK_TEMPLATES, MOCK_WORKERS, MOCK_FARMS } from "@/data/mock";
import type { Task, TaskPriority, TaskFamily } from "@/types";

type CreateMode = "template" | "custom";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
];

const TASK_FAMILY_OPTIONS: { value: TaskFamily; label: string }[] = [
  { value: "veterinaria", label: "Veterinaria" },
  { value: "campo", label: "Campo" },
  { value: "alimentacion", label: "Alimentación" },
  { value: "limpieza", label: "Limpieza" },
];

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  /** Fecha preseleccionada (ej. día del calendario en Tasks). */
  defaultDate?: string;
}

export default function CreateTaskModal({ open, onClose, defaultDate }: CreateTaskModalProps) {
  const { setTasks, setGeneralTasks, getNextTaskNumber } = useTasks();

  const [createMode, setCreateMode] = useState<CreateMode>("template");
  const [formTemplateId, setFormTemplateId] = useState(TASK_TEMPLATES[0]?.id ?? "");
  const [formCustomTitle, setFormCustomTitle] = useState("");
  const [formCustomDetails, setFormCustomDetails] = useState("");
  const [formWorkerId, setFormWorkerId] = useState("");
  const [formFarmId, setFormFarmId] = useState("");
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium");
  const [formFamily, setFormFamily] = useState<TaskFamily>("campo");
  const [formDate, setFormDate] = useState(() => todayISO());

  useEffect(() => {
    if (open) {
      setCreateMode("template");
      setFormTemplateId(TASK_TEMPLATES[0]?.id ?? "");
      setFormCustomTitle("");
      setFormCustomDetails("");
      setFormWorkerId("");
      setFormFarmId("");
      setFormPriority("medium");
      setFormFamily("campo");
      setFormDate(defaultDate ?? todayISO());
    }
  }, [open, defaultDate]);

  const selectedTemplate = TASK_TEMPLATES.find((t) => t.id === formTemplateId);
  const farm = MOCK_FARMS.find((f) => f.id === formFarmId);
  const farmName = farm ? farm.name : "Sin asignar a granja";

  const handleSubmit = (e: React.FormEvent) => {
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

    const today = todayISO();
    const newTask: Task = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      taskNumber: getNextTaskNumber(),
      title,
      priority: formPriority,
      farmName,
      workerId: formWorkerId,
      status: "ready",
      managerDetails: managerDetails || "Sin detalles.",
      comments: [],
      family: formFamily,
      createdAt: today,
      date: formDate,
    };

    if (formWorkerId) {
      setTasks((prev) => [...prev, newTask]);
    } else {
      setGeneralTasks((prev) => [...prev, newTask]);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
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
            Elige una tarea preconfigurada o define una personalizada. Si asignas un responsable, la tarea irá a Tasks; si no, quedará en Tareas sin asignar.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="space-y-4 overflow-y-auto p-4">
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
                <option value="">Sin asignar</option>
                {MOCK_WORKERS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Sin asignar → la tarea irá a Tareas sin asignar. Asignar → irá a Tasks.
              </p>
            </div>

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
                <option value="">Sin asignar a granja</option>
                {MOCK_FARMS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

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

            <div>
              <label htmlFor="task-family" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Familia de tarea
              </label>
              <select
                id="task-family"
                value={formFamily}
                onChange={(e) => setFormFamily(e.target.value as TaskFamily)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
              >
                {TASK_FAMILY_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

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
              onClick={onClose}
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
  );
}
