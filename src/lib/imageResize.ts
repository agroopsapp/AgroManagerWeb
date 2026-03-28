/**
 * Redimensiona una imagen en el navegador para logos ligeros (p. ej. cabecera PDF).
 * Solo cliente; no usar en Server Components.
 */
export async function fileToResizedDataUrl(
  file: File,
  maxW = 900,
  maxH = 300
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("img"));
    i.src = dataUrl;
  });
  const ratio = img.width / Math.max(1, img.height);
  let w = Math.min(maxW, img.width);
  let h = w / Math.max(0.0001, ratio);
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(w));
  canvas.height = Math.max(1, Math.floor(h));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
