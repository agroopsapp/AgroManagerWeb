"use client";

import { useState, useRef } from "react";
import type { AnimalCase as AnimalCaseType, IncidentStatus } from "@/types";
import { formatTaskId } from "@/types";

const severityLabels: Record<AnimalCaseType["severity"], string> = {
  critical: "Crítico",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const severityStyles: Record<AnimalCaseType["severity"], string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300",
};

const severityBorderStyles: Record<AnimalCaseType["severity"], string> = {
  critical: "border-l-red-500 dark:border-l-red-500",
  high: "border-l-orange-500 dark:border-l-orange-500",
  medium: "border-l-amber-500 dark:border-l-amber-500",
  low: "border-l-slate-400 dark:border-l-slate-500",
};

function formatIncidentDate(iso: string): string {
  try {
    const [y, m, d] = iso.split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
  } catch {
    // ignore
  }
  return iso;
}

interface IncidentCardProps {
  case: AnimalCaseType;
  /** Nombre del animal (si tiene). */
  animalName: string;
  /** Número de crotal / identificación del animal. */
  animalIdentification?: string;
  onStatusChange: (caseId: string, newStatus: IncidentStatus) => void;
  onDelete?: (caseId: string) => void;
}

const statusLabels: Record<IncidentStatus, string> = {
  reported: "Reportado",
  in_treatment: "En tratamiento",
  resolved: "Resuelto",
};

export default function IncidentCard({ case: incident, animalName, animalIdentification, onStatusChange, onDelete }: IncidentCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("caseId", incident.id);
    e.dataTransfer.effectAllowed = "move";
    if (cardRef.current) {
      e.dataTransfer.setDragImage(cardRef.current, 0, 0);
    }
  };

  return (
    <>
      <div
        ref={cardRef}
        draggable
        onDragStart={handleDragStart}
        className={`relative rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm transition hover:shadow-md cursor-grab active:cursor-grabbing dark:border-slate-600 dark:bg-slate-800 ${severityBorderStyles[incident.severity]}`}
        title="Arrastrar para mover de columna"
        aria-label="Arrastrar incidente"
      >
        {/* Línea 1: id incidencia + título tarea + prioridad */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              <span className="text-slate-500 dark:text-slate-400 font-normal mr-2">
                #{formatTaskId(incident.incidentNumber ?? 0)}
              </span>
              {incident.caseType}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${severityStyles[incident.severity]}`}>
              {severityLabels[incident.severity]}
            </span>
            {onDelete && (
              deleteConfirm ? (
                <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-slate-700">
                  <span className="text-slate-600 dark:text-slate-300">¿Eliminar?</span>
                  <button type="button" onClick={() => { onDelete(incident.id); setDeleteConfirm(false); }} className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200">Sí</button>
                  <button type="button" onClick={() => setDeleteConfirm(false)} className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-600 dark:text-slate-200">No</button>
                </span>
              ) : (
                <button type="button" onClick={() => setDeleteConfirm(true)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/50 dark:hover:text-red-400" title="Eliminar incidente" aria-label="Eliminar incidente">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )
            )}
          </div>
        </div>

        {/* Línea 2: Animal: número crotal y nombre (si tiene) */}
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          <span className="font-medium text-slate-600 dark:text-slate-400">Animal:</span>{" "}
          {[animalIdentification, animalName].filter(Boolean).join(" — ") || "—"}
        </p>

        {/* Línea 3: Fecha de creación */}
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-600 dark:text-slate-400">Creada:</span> {formatIncidentDate(incident.date)}
        </p>

        {/* Línea 4: Estado tarea */}
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          {statusLabels[incident.status]}
        </p>

        {/* Línea 5: Resumen tarea */}
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
          {incident.summary}
        </p>

        {/* Botones debajo */}
        <div className="mt-4 flex flex-col gap-2">
          {incident.status === "reported" && (
            <button
              type="button"
              onClick={() => onStatusChange(incident.id, "in_treatment")}
              className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
            >
              Pasar a tratamiento
            </button>
          )}
          {incident.status === "in_treatment" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onStatusChange(incident.id, "reported")}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                Volver a reportado
              </button>
              <button
                type="button"
                onClick={() => onStatusChange(incident.id, "resolved")}
                className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
              >
                Marcar resuelto
              </button>
            </div>
          )}
          {incident.status === "resolved" && (
            <button
              type="button"
              onClick={() => onStatusChange(incident.id, "in_treatment")}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              Volver a tratamiento
            </button>
          )}
        </div>
      </div>
    </>
  );
}
