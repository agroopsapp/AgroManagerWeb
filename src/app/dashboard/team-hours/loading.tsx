export default function TeamHoursLoading() {
  return (
    <div className="min-w-0 max-w-full space-y-4 p-4 sm:p-6">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800/80" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,18rem)]">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
      </div>
      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Compilando vista de fichajes del equipo…
      </p>
    </div>
  );
}
