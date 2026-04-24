"use client";

import { memo } from "react";

/** Mismo ancho que dos celdas `w-9` del dúo (reloj + parte), para alinear la columna Acciones. */
const ACCIONES_BLOQUE_ANCHO = "w-[4.5rem]";

/** Marco exterior compartido: una sola pieza, sin «dos botones sueltos». */
const accionesBloqueMarcoClass =
  `mx-auto inline-flex shrink-0 overflow-hidden rounded-md border border-slate-300 bg-slate-50 shadow-sm dark:border-slate-600 dark:bg-slate-900/80 ${ACCIONES_BLOQUE_ANCHO}`;

/** Reloj: editar horario / jornada. */
function IconoReloj({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

/** Documento / hoja: aún no hay parte en servidor (crear). */
function IconoPapel({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

/** Portapapeles con lápiz: ya existe parte en servidor (editar). */
function IconoPortapapelesLapiz({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M8 4V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" />
      <line x1="8" y1="10" x2="14" y2="10" />
      <line x1="8" y1="13" x2="12" y2="13" />
      <g transform="translate(12.25, 7.75) scale(0.42)">
        <path
          d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3"
          strokeWidth={4.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** Cruz «+»: crear / añadir (día o parte nuevo). */
function IconoMas({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/**
 * Día sin fichaje aún: un solo control — abre «Editar día» (ausencias o imputación manual).
 * Cuando ya exista registro, la tabla usa `EquipoTablaAccionesDuo` (horario + parte).
 */
export const EquipoTablaBotonPrimeraJornada = memo(function EquipoTablaBotonPrimeraJornada({
  onCrearJornada,
  disabled,
}: {
  onCrearJornada: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={`${accionesBloqueMarcoClass} h-9`}>
      <button
        type="button"
        disabled={disabled}
        onClick={onCrearJornada}
        className="flex h-9 w-full min-w-0 items-center justify-center bg-blue-50 text-blue-800 transition hover:bg-blue-100 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-agro-500/40 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-blue-950/45 dark:text-blue-100 dark:hover:bg-blue-900/55"
        title="Opciones del día: vacaciones, baja, no laboral o imputar horario"
        aria-label="Abrir menú del día: ausencias o jornada"
      >
        <IconoMas className="h-5 w-5" />
      </button>
    </div>
  );
});

/**
 * Ya hay fichaje: reloj = horario/jornada; papel = parte (crear o editar).
 */
export const EquipoTablaAccionesDuo = memo(function EquipoTablaAccionesDuo({
  onEditarHora,
  onEditarParte,
  parteDisabled,
  tieneParte,
}: {
  onEditarHora: () => void;
  onEditarParte: () => void;
  parteDisabled: boolean;
  tieneParte: boolean;
}) {
  const parteLabel = tieneParte ? "Editar parte en servidor" : "Crear parte en servidor";
  return (
    <div
      className={`${accionesBloqueMarcoClass} h-9`}
      role="group"
      aria-label="Fichar o jornada, y parte de trabajo"
    >
      <button
        type="button"
        onClick={onEditarHora}
        className="flex h-9 w-1/2 min-w-0 shrink-0 items-center justify-center border-r border-slate-300 bg-blue-50 text-blue-800 transition hover:bg-blue-100 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-agro-500/40 dark:border-slate-600 dark:bg-blue-950/45 dark:text-blue-100 dark:hover:bg-blue-900/55"
        title="Fichar / editar jornada: entrada, salida y descanso"
        aria-label="Fichar o editar jornada: horario del día"
      >
        <IconoReloj className="h-5 w-5" />
      </button>
      <button
        type="button"
        disabled={parteDisabled}
        onClick={onEditarParte}
        className="flex h-9 w-1/2 min-w-0 shrink-0 items-center justify-center bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-agro-500/40 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        title={parteLabel}
        aria-label={parteLabel}
      >
        {tieneParte ? (
          <IconoPortapapelesLapiz className="h-5 w-5" />
        ) : (
          <IconoPapel className="h-5 w-5" />
        )}
      </button>
    </div>
  );
});
