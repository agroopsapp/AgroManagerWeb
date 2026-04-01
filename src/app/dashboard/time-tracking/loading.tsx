export default function TimeTrackingLoading() {
  return (
    <div className="min-w-0 max-w-full space-y-4">
      {/* Banner cabecera — misma forma y gradiente que el real */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-agro-600 via-emerald-500 to-sky-500 px-4 py-3 shadow-sm sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="h-3 w-32 rounded bg-white/30" />
            <div className="h-7 w-28 rounded bg-white/30" />
            <div className="h-4 w-64 rounded bg-white/20" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="h-6 w-36 rounded-full bg-white/20" />
            <div className="h-3 w-28 rounded bg-white/15" />
          </div>
        </div>
      </div>

      {/* Grid 2 columnas: reloj + historial */}
      <div className="grid min-w-0 max-w-full gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* ClockPanel skeleton */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="h-5 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mx-auto h-28 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="mx-auto h-10 w-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-48 animate-pulse rounded bg-slate-100 dark:bg-slate-700/60" />
        </div>

        {/* HistorialPersonal skeleton */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="h-5 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700/50"
              />
            ))}
          </div>
        </div>
      </div>

      {/* WorkPartsSavedPanel skeleton */}
      <div className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
