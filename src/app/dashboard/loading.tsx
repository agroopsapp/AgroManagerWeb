export default function DashboardLoading() {
  return (
    <div className="min-w-0 max-w-full space-y-4 p-1">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
