import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { FeaturesProvider } from "@/contexts/FeaturesContext";
import { PwaProvider } from "@/components/PwaProvider";

export const metadata: Metadata = {
  title: "AgroOps - Gestión de granja",
  description: "Dashboard para gestión de tareas e incidentes en granja",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('agromanager_theme');var d=t==='dark';document.documentElement.classList.toggle('dark',d);document.body.classList.toggle('dark',d);})();`,
          }}
        />
        <ThemeProvider>
          <FeaturesProvider>
            <AuthProvider>
              {children}
              <PwaProvider />
            </AuthProvider>
          </FeaturesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
