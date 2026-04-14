"use client";

import DashboardLayout from "@/components/DashboardLayout";

/** Client layout: evita en dev (Turbopack) el fallo intermitente `useContext`/`usePathname` al mezclar
 *  el boundary servidor→cliente con páginas que ya son 100 % cliente. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
