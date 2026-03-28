/**
 * Identidad AgroOps para PDFs e informes.
 * Los PNG deben estar en la raíz de `public/` (sirven igual que en el Header).
 */

/**
 * PDF con fondo blanco: primero logos con texto u oscuros.
 * `LogoBlanco.png` no se incluye aquí (poco contraste en blanco); úsalo en UI oscura.
 */
export const AGROOPS_PDF_LOGO_PUBLIC_PATHS: readonly string[] = [
  "/LogoConTexto.png",
  "/PngLogoTexto.png",
  "/LogoNegro.png",
  "/LogoSinTexto.png",
  "/branding/agroops-logo.png",
];

/**
 * Wordmark AgroOps en PNG (barra agro + texto), para incrustar en jsPDF cuando no hay asset en `/public`.
 */
export function createAgroOpsPdfWordmarkDataUrl(): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const barX = 20;
  const barY = 28;
  const barW = 5;
  const barH = 44;
  ctx.fillStyle = "#16a34a";
  ctx.fillRect(barX, barY, barW, barH);

  const textX = barX + barW + 16;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 38px Helvetica, Arial, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("AgroOps", textX, 52);

  ctx.fillStyle = "#64748b";
  ctx.font = "14px Helvetica, Arial, sans-serif";
  ctx.fillText("Gestión de explotaciones", textX, 78);

  return canvas.toDataURL("image/png");
}
