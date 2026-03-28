"use client";

import { Suspense } from "react";

function TasksLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-agro-500 border-t-transparent" />
    </div>
  );
}

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<TasksLoading />}>{children}</Suspense>;
}
