const crypto = require("node:crypto");

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Cabeceras de seguridad (centrado en mitigar XSS).
   * Nota: el theme init usa un <script> inline en `src/app/layout.tsx`,
   * así que permitimos ese único inline script mediante hash sha256 (sin 'unsafe-inline').
   */
  async headers() {
    const themeInitScript =
      "(function(){var t=localStorage.getItem('agromanager_theme');var d=t==='dark';document.documentElement.classList.toggle('dark',d);document.body.classList.toggle('dark',d);})();";
    const themeInitHash = crypto.createHash("sha256").update(themeInitScript).digest("base64");

    const isProd = process.env.NODE_ENV === "production";

    const csp = [
      "default-src 'self'",
      `script-src 'self' 'sha256-${themeInitHash}'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // En prod evitamos `http:` (MITM); en dev permitimos http/https para APIs locales.
      isProd ? "connect-src 'self' https:" : "connect-src 'self' https: http:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HSTS solo en HTTPS; Vercel ya sirve HTTPS. Mantenemos max-age moderado.
          { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
