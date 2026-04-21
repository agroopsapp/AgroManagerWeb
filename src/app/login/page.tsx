"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatures } from "@/contexts/FeaturesContext";
import { appHomePath } from "@/lib/dashboardNavGating";
import { userVisibleMessageFromUnknown } from "@/shared/utils/apiErrorDisplay";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user, isReady } = useAuth();
  const { enableTimeTracking, enableOperativaYAnalisisMenu } = useFeatures();
  const router = useRouter();

  useEffect(() => {
    if (!isReady || !user) return;
    router.replace(appHomePath(user.role, enableTimeTracking, enableOperativaYAnalisisMenu));
  }, [user, isReady, router, enableTimeTracking, enableOperativaYAnalisisMenu]);

  const handleSubmit = async (e: React.FormEvent) => {
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
    try {
      setLoading(true);
      const authUser = await login(email.trim(), password);
      router.replace(
        appHomePath(authUser.role, enableTimeTracking, enableOperativaYAnalisisMenu),
      );
    } catch (err) {
      setError(userVisibleMessageFromUnknown(err, "No se ha podido iniciar sesión."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 p-4"
      style={{
        backgroundImage: "url('/login-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-slate-900/25" aria-hidden />

      <div className="relative z-10 flex flex-col items-center gap-6 px-4">
        {/* Tarjeta: logo y formulario */}
        <div className="w-full max-w-[460px]">
          <div className="rounded-2xl border border-white/10 bg-white/90 px-8 py-7 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-800/90">
            <div className="flex flex-col items-center">
              <Image
                src="/PngLogoTexto.png"
                alt="AgroOps"
                width={280}
                height={80}
                className="h-auto w-full max-w-[280px] object-contain"
                priority
              />
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {error && (
                <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="mt-1.5 w-full border-0 border-b-2 border-slate-200 bg-transparent px-0 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-0 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
                  autoComplete="email"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5 w-full border-0 border-b-2 border-slate-200 bg-transparent px-0 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-0 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-agro-600 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-agro-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  "Entrando..."
                ) : (
                  <>
                    Iniciar sesión
                    <span className="text-white/80" aria-hidden>→</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Fuera de la tarjeta: pie sobre el fondo */}
        <p className="text-center text-xs text-white/70 drop-shadow-sm">
          AgroOps · Tu explotación al día
        </p>
      </div>
    </div>
  );
}
