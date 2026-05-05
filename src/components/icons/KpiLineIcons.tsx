"use client";

/**
 * Iconos lineales (estilo dashboard) para KPIs.
 * Tamaño 24x24, trazo 2, formas simples como en el mock.
 */
const iconClass = "h-6 w-6 shrink-0";

export function KpiIconClock({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`${iconClass} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l3 2" />
    </svg>
  );
}

export function KpiIconUsers({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`${iconClass} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 21v-1.5a3.5 3.5 0 0 0-3.5-3.5H7a3.5 3.5 0 0 0-3.5 3.5V21" />
      <circle cx="9.5" cy="8" r="3" />
      <path d="M17 10.5a2.8 2.8 0 0 0 0-5.6" />
      <path d="M20.5 21v-1.2a3.2 3.2 0 0 0-2.4-3.1" />
    </svg>
  );
}

export function KpiIconClipboardCheck({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`${iconClass} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M8.5 13l2 2 5-5" />
    </svg>
  );
}

export function KpiIconAlert({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`${iconClass} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v7" />
      <path d="M12 17h.01" />
    </svg>
  );
}

