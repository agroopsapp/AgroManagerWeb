"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, user, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && user) router.replace("/dashboard");
  }, [user, isReady, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Introduce tu email");
      return;
    }
    if (!password.trim()) {
      setError("Introduce tu contraseña");
      return;
    }
    login(email.trim(), password);
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-agro-50 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
          <div className="mb-[1cm] flex flex-col items-center text-center">
            <Image
              src="/PngLogoTexto.png"
              alt="AgroOps"
              width={360}
              height={100}
              className="h-auto w-full max-w-[360px] object-contain object-center"
              priority
            />
            <p className="mt-0 text-slate-600">Inicia sesión en tu cuenta</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-2 focus:ring-agro-500/20"
                autoComplete="email"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-2 focus:ring-agro-500/20"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-agro-600 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-agro-700 active:scale-[0.99]"
            >
              Iniciar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
