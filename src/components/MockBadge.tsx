"use client";

export function MockBadge({ label = "MOCK" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-200">
      {label}
    </span>
  );
}

