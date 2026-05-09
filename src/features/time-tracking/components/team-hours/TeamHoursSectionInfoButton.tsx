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
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:bg-emerald-100 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/55 dark:hover:text-emerald-100 dark:focus-visible:ring-emerald-400"
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
