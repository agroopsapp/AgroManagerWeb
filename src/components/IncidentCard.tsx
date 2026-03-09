"use client";

import { useState, useRef } from "react";
import type { AnimalCase as AnimalCaseType, IncidentStatus } from "@/types";

function GripIcon() {
  return (
    <svg className="h-4 w-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

const statusLabels: Record<IncidentStatus, string> = {
  reported: "Reportado",
  in_treatment: "En tratamiento",
  resolved: "Resuelto",
};

const severityStyles: Record<AnimalCaseType["severity"], string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300",
};

interface IncidentCardProps {
  case: AnimalCaseType;
  animalName: string;
  onStatusChange: (caseId: string, newStatus: IncidentStatus) => void;
  onDelete?: (caseId: string) => void;
}

export default function IncidentCard({ case: incident, animalName, onStatusChange, onDelete }: IncidentCardProps) {
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
        className="relative rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-4 shadow-md transition hover:shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:border-l-amber-500"
      >
        <div
          draggable
          onDragStart={handleDragStart}
          className="absolute left-2 top-2 cursor-grab touch-none rounded p-1 hover:bg-slate-100 active:cursor-grabbing dark:hover:bg-slate-600"
          title="Arrastrar para mover de columna"
          aria-label="Arrastrar incidente"
        >
          <GripIcon />
        </div>
        {onDelete && (
          <div className="absolute top-2 right-2">
            {deleteConfirm ? (
              <span className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-700">
                <span className="text-slate-500 dark:text-slate-300">¿Eliminar?</span>
                <button
                  type="button"
                  onClick={() => { onDelete(incident.id); setDeleteConfirm(false); }}
                  className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200 dark:hover:bg-red-900/70"
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-600 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/50 dark:hover:text-red-400"
                title="Eliminar incidente"
                aria-label="Eliminar incidente"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="pl-6 pr-8">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{animalName}</h3>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{incident.caseType}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{incident.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityStyles[incident.severity]}`}>
              {incident.severity}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{incident.date}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {incident.status === "reported" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onStatusChange(incident.id, "in_treatment")}
                className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Pasar a tratamiento
              </button>
            </div>
          )}
          {incident.status === "in_treatment" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onStatusChange(incident.id, "reported")}
                className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                Volver a reportado
              </button>
              <button
                type="button"
                onClick={() => onStatusChange(incident.id, "resolved")}
                className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
              >
                Marcar resuelto
              </button>
            </div>
          )}
          {incident.status === "resolved" && (
<button
            type="button"
            onClick={() => onStatusChange(incident.id, "in_treatment")}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            Volver a tratamiento
          </button>
          )}
        </div>
      </div>
    </>
  );
}
