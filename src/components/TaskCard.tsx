"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MODAL_BACKDROP_CENTER, MODAL_SURFACE, MODAL_SURFACE_PAD, modalFramePanel } from "@/components/modalShell";
import type { Task as TaskType, TaskPriority, TaskStatus } from "@/types";
import { formatTaskId } from "@/types";
import DatePicker from "@/components/DatePicker";

const priorityBorderColors: Record<TaskPriority, string> = {
  high: "border-l-red-500 dark:border-l-red-500",
  medium: "border-l-amber-500 dark:border-l-amber-500",
  low: "border-l-slate-400 dark:border-l-slate-400",
};

const priorityBadgeColors: Record<TaskPriority, string> = {
  high: "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  medium: "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

const statusLabels: Record<TaskStatus, string> = {
  ready: "Lista para empezar",
  in_progress: "En desarrollo",
  completed: "Finalizada",
};

function getNextStatus(status: TaskStatus): TaskStatus | null {
  if (status === "ready") return "in_progress";
  if (status === "in_progress") return "completed";
  return null;
}

function getPrevStatus(status: TaskStatus): TaskStatus | null {
  if (status === "completed") return "in_progress";
  if (status === "in_progress") return "ready";
  return null;
}

interface TaskCardProps {
  task: TaskType;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onUpdateComments: (taskId: string, comments: string[]) => void;
  onDelete?: (taskId: string) => void;
  onDateChange?: (taskId: string, newDate: string) => void;
  workerName?: string;
  /** dnd-kit: ref del nodo draggable */
  dragRef?: (element: HTMLElement | null) => void;
  /** dnd-kit: listeners para el área de arrastre */
  dragListeners?: Record<string, unknown>;
  /** dnd-kit: atributos accesibilidad */
  dragAttributes?: Record<string, unknown>;
  /** dnd-kit: true mientras se arrastra (mostrar semitransparente) */
  isDragging?: boolean;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function TaskCard({
  task,
  onStatusChange,
  onUpdateComments,
  onDelete,
  onDateChange,
  workerName,
  dragRef,
  dragListeners,
  dragAttributes,
  isDragging,
}: TaskCardProps) {
  const useDnd = Boolean(dragRef && dragListeners);
  const cardRef = useRef<HTMLDivElement>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dateChangeOpen, setDateChangeOpen] = useState(false);
  const [tempDate, setTempDate] = useState(() => task.date ?? todayISO());
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editingComments, setEditingComments] = useState<string[]>(task.comments);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("taskId", task.id);
    e.dataTransfer.effectAllowed = "move";
  };

  // Gestos táctiles simples (swipe izquierda/derecha) para móvil
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Si tocamos un botón o input, no interpretamos como swipe
    if (target.closest("button") || target.closest("input") || target.closest("textarea")) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Umbral: desplazamiento horizontal claro y poco movimiento vertical
    if (absDx < 40 || absDy > 30) return;

    if (dx > 0) {
      // Swipe hacia la derecha: avanzar estado
      const next = getNextStatus(task.status);
      if (next) onStatusChange(task.id, next);
    } else {
      // Swipe hacia la izquierda: retroceder estado
      const prev = getPrevStatus(task.status);
      if (prev) onStatusChange(task.id, prev);
    }
  };

  useEffect(() => {
    setEditingComments(task.comments);
  }, [task.comments, detailsOpen]);

  const openDetails = () => {
    setEditingComments(task.comments);
    setEditingIndex(null);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setEditingIndex(null);
  };

  const saveComments = () => {
    let final = editingComments;
    if (editingIndex !== null && editValue.trim()) {
      final = [...editingComments];
      final[editingIndex] = editValue.trim();
    }
    onUpdateComments(task.id, final);
    setEditingIndex(null);
  };

  const addCommentInModal = (e: React.FormEvent) => {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).querySelector("input");
    const text = input?.value?.trim();
    if (text) {
      setEditingComments((prev) => [...prev, text]);
      if (input) input.value = "";
    }
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(editingComments[index] ?? "");
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const next = [...editingComments];
    next[editingIndex] = editValue.trim();
    setEditingComments(next);
    setEditingIndex(null);
    setEditValue("");
  };

  const deleteComment = (index: number) => {
    setEditingComments((prev) => prev.filter((_, i) => i !== index));
    setEditingIndex(null);
  };

  const cardContent = (
    <motion.div
      ref={(el) => {
        (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        dragRef?.(el);
      }}
      layout
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: isDragging ? 0.5 : 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        whileHover={isDragging ? undefined : { scale: 1.02, boxShadow: "0 10px 25px rgba(15,23,42,0.18)" }}
        whileTap={isDragging ? undefined : { scale: 0.98 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.8 }}
        className={`rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-md dark:border-slate-600 dark:bg-slate-800 ${priorityBorderColors[task.priority]} ${
          isDragging ? "opacity-50" : ""
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      {...(useDnd ? { ...dragListeners, ...dragAttributes } : {})}
      style={useDnd ? { cursor: "grab" } : undefined}
    >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                <span className="text-slate-500 dark:text-slate-400 font-normal mr-2">
                  #{formatTaskId(task.taskNumber ?? 0)}
                </span>
                {task.title}
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${priorityBadgeColors[task.priority]}`}>
                {task.priority}
              </span>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Eliminar tarea"
                  aria-label="Eliminar tarea"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            <span className="font-medium">Granja:</span> {task.farmName}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Responsable:</span> {workerName || "Sin asignar"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Creada:</span>{" "}
            {formatDateShort(task.createdAt ?? todayISO())}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{statusLabels[task.status]}</p>
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={openDetails}
            className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 active:scale-[0.98] dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            Detalles
          </button>
          {onDateChange && task.status !== "completed" && (
            <button
              type="button"
              onClick={() => {
                setTempDate(task.date ?? todayISO());
                setDateChangeOpen(true);
              }}
              className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 active:scale-[0.98] dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              Cambiar día
            </button>
          )}
        </div>

        {/* Botones según estado */}
        <div className="mt-3 flex flex-col gap-2">
          {task.status === "ready" && (
            <button
              type="button"
              onClick={() => onStatusChange(task.id, "in_progress")}
              className="w-full rounded-lg bg-agro-600 py-2.5 text-sm font-medium text-white transition hover:bg-agro-700 active:scale-[0.98]"
            >
              Comenzar tarea
            </button>
          )}
          {task.status === "in_progress" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onStatusChange(task.id, "ready")}
                className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
              >
                Volver atrás
              </button>
              <button
                type="button"
                onClick={() => onStatusChange(task.id, "completed")}
                className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 active:scale-[0.98]"
              >
                Finalizar tarea
              </button>
            </div>
          )}
          {task.status === "completed" && (
            <button
              type="button"
              onClick={() => onStatusChange(task.id, "in_progress")}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
            >
              Volver atrás
            </button>
          )}
        </div>

        {/* Comentarios solo gestionables desde el modal de Detalles, para hacer la tarjeta más compacta */}
      </motion.div>
  );

  const wrappedCard = !useDnd ? (
    <div
      draggable
      onDragStart={(e: React.DragEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("input") || target.closest("textarea")) {
          e.preventDefault();
          return;
        }
        handleDragStart(e);
      }}
    >
      {cardContent}
    </div>
  ) : (
    cardContent
  );

  return (
    <>
      {wrappedCard}

      {/* Modal Detalles */}
      {detailsOpen && (
        <div
          className={`fixed inset-0 z-50 ${MODAL_BACKDROP_CENTER}`}
          onClick={closeDetails}
          role="dialog"
          aria-modal="true"
          aria-labelledby="details-title"
        >
          <div
            className={modalFramePanel("lg", { className: "flex flex-col" })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-600">
              <h2 id="details-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Detalles: {task.title}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {task.farmName} · {statusLabels[task.status]}
              </p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
              <section>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Detalles del manager
                </h3>
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800 whitespace-pre-wrap dark:bg-slate-700 dark:text-slate-200">
                  {task.managerDetails || "Sin detalles."}
                </p>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Comentarios del trabajador
                </h3>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  Puedes añadir, editar y eliminar comentarios.
                </p>
                <ul className="mb-3 space-y-2">
                  {editingComments.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-700">
                      {editingIndex === i ? (
                        <>
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-600 dark:text-slate-100"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="rounded bg-agro-600 px-2 py-1 text-xs font-medium text-white hover:bg-agro-700"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingIndex(null); setEditValue(""); }}
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">{c}</span>
                          <button
                            type="button"
                            onClick={() => startEdit(i)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteComment(i)}
                            className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-500 dark:text-red-300 dark:bg-red-900/40"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                <form onSubmit={addCommentInModal} className="flex gap-2">
                  <input
                    type="text"
                    name="newComment"
                    placeholder="Añadir comentario..."
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500"
                  >
                    Añadir
                  </button>
                </form>
              </section>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-600">
              <button
                type="button"
                onClick={closeDetails}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => { saveComments(); closeDetails(); }}
                className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white hover:bg-agro-700"
              >
                Guardar comentarios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar día */}
      {dateChangeOpen && onDateChange && (
        <div
          className={`fixed inset-0 z-50 ${MODAL_BACKDROP_CENTER}`}
          onClick={() => setDateChangeOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-date-title"
        >
          <div
            className={`w-full max-w-sm ${MODAL_SURFACE} ${MODAL_SURFACE_PAD}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="change-date-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Cambiar día de la tarea
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Nueva fecha para &quot;{task.title}&quot;
            </p>
            <div className="mt-4">
              <DatePicker value={tempDate} onChange={setTempDate} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDateChangeOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDateChange(task.id, tempDate);
                  setDateChangeOpen(false);
                }}
                className="rounded-lg bg-agro-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-agro-700"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {deleteConfirm && onDelete && (
        <div
          className={`fixed inset-0 z-[60] ${MODAL_BACKDROP_CENTER}`}
          onClick={() => setDeleteConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-task-title"
        >
          <div
            className={`w-full max-w-xs ${MODAL_SURFACE} ${MODAL_SURFACE_PAD}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-task-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              ¿Eliminar esta tarea?
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              &quot;{task.title}&quot; se eliminará y no podrás deshacerlo.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { onDelete(task.id); setDeleteConfirm(false); }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
