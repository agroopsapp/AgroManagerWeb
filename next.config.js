/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Cabeceras de seguridad.
   *
   * Importante: Next.js App Router inyecta scripts inline para el payload RSC
   * (`self.__next_f.push(...)`). Una `script-src` demasiado estricta rompe la
   * hidratación y la app se queda en el HTML inicial (p. ej. «Cargando aplicación…»).
   *
   * Mitigación razonable: `script-src 'self' 'unsafe-inline'` en producción;
   * en desarrollo añadimos `'unsafe-eval'` por webpack/HMR.
   */
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const onVercel = process.env.VERCEL === "1";

    const scriptSrc = isProd
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

    const directives = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "worker-src 'self'",
      "connect-src 'self' https: http:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ];

    if (isProd) {
      directives.push("upgrade-insecure-requests");
    }

    const csp = directives.join("; ");

    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];

    if (onVercel && isProd) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=15552000; includeSubDomains",
      });
    }

    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
