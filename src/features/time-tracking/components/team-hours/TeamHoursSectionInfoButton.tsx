"use client";

type Props = {
  ariaLabel: string;
  onPress: () => void;
};

/** Botón «i» junto a títulos de sección en Fichajes y partes del equipo. */
export function TeamHoursSectionInfoButton({ ariaLabel, onPress }: Props) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={ariaLabel}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300/90 bg-white text-slate-500 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus-visible:ring-slate-500"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    </button>
  );
}
