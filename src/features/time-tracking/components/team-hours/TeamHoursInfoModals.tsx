"use client";

import { useCallback, useEffect, useState } from "react";
import { MODAL_BACKDROP_CENTER, modalScrollablePanel } from "@/components/modalShell";
import type { TeamHoursInfoModalId } from "@/features/time-tracking/types";

/** Lista estable para menús o botones «¿Qué es esto?». */
export const TEAM_HOURS_INFO_MODAL_IDS = [
  "vistaGeneral",
  "filtrosYPeriodo",
  "tablaRegistros",
  "resumenYLateral",
  "kpisEstadoEquipo",
  "cumplimientoHeatmaps",
  "exportacion",
  "permisosWorker",
] as const satisfies readonly TeamHoursInfoModalId[];

type ModalCopy = { title: string; paragraphs: string[] };

const TEAM_HOURS_INFO_COPY: Record<TeamHoursInfoModalId, ModalCopy> = {
  vistaGeneral: {
    title: "Vista general",
    paragraphs: [
      "Centro de control para revisar fichajes y partes del equipo según periodo y filtros.",
      "Sustituye este texto por una guía corta al equipo (objetivo de la pantalla y flujo típico).",
    ],
  },
  filtrosYPeriodo: {
    title: "Filtros y periodo",
    paragraphs: [
      "Aquí elegís día, semana, mes, trimestre o año; empresa, persona y servicio cuando aplique.",
      "«Vista rápida» acota por registros sin fichar o sin parte en servidor.",
      "Editad estos párrafos con las reglas reales de negocio.",
    ],
  },
  tablaRegistros: {
    title: "Tabla de registros",
    paragraphs: [
      "Lista los fichajes del periodo con ordenación por columnas y acciones por fila.",
      "«Expandir grid» agranda la zona scroll interna; «Compactar» la deja en vista previa.",
    ],
  },
  resumenYLateral: {
    title: "Resumen y columna lateral",
    paragraphs: [
      "El bloque «Resumen equipo» y los paneles junto a él dependen del periodo y filtros.",
      "Describid aquí qué muestra cada tarjeta en vuestro contexto.",
    ],
  },
  kpisEstadoEquipo: {
    title: "Estado del equipo (KPIs)",
    paragraphs: [
      "La barra superior resume métricas del equipo para la vista actual.",
      "Completad con el significado exacto de cada indicador en vuestra implantación.",
    ],
  },
  cumplimientoHeatmaps: {
    title: "Cumplimiento y heatmaps",
    paragraphs: [
      "Los heatmaps solo aplican a periodos cortos (día / semana / mes); cambiad el texto si la API evoluciona.",
    ],
  },
  exportacion: {
    title: "Exportación",
    paragraphs: [
      "PDF de tabla, CSV u otros export según permisos.",
      "Indicad rutas de archivo o convenciones de nombre si las usáis.",
    ],
  },
  permisosWorker: {
    title: "Permisos (trabajador)",
    paragraphs: [
      "Los trabajadores solo pueden editar fichajes/partes en una ventana de días naturales recientes.",
      "Ajustad el texto si cambia la política.",
    ],
  },
};

export function useTeamHoursInfoModal() {
  const [activeId, setActiveId] = useState<TeamHoursInfoModalId | null>(null);
  const openModal = useCallback((id: TeamHoursInfoModalId) => {
    setActiveId(id);
  }, []);
  const closeModal = useCallback(() => {
    setActiveId(null);
  }, []);
  return { activeId, openModal, closeModal };
}

export function TeamHoursInfoModals({
  activeId,
  onClose,
}: {
  activeId: TeamHoursInfoModalId | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, onClose]);

  if (!activeId) return null;

  const copy = TEAM_HOURS_INFO_COPY[activeId];

  return (
    <div
      className={`fixed inset-0 z-[100] ${MODAL_BACKDROP_CENTER}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-hours-info-modal-title"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className={modalScrollablePanel("md")}
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2
          id="team-hours-info-modal-title"
          className="text-lg font-bold text-slate-900 dark:text-slate-50"
        >
          {copy.title}
        </h2>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {copy.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="agro-btn-primary">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
