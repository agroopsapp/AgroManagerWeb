"use client";

import { usePathname } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

/**
 * `usePathname` debe vivir en un chunk pequeño bajo `Suspense` del layout padre.
 * Si se mezcla con muchos contextos en el mismo árbol, en dev (Turbopack) a veces falla el SSR:
 * `Cannot read properties of null (reading 'useContext')`.
 */
export default function DashboardPathnameShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <DashboardLayout pathname={pathname}>{children}</DashboardLayout>;
}
