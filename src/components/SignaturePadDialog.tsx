"use client";

import { useCallback, useEffect, useRef } from "react";

type SignaturePadDialogProps = {
  open: boolean;
  title?: string;
  initialDataUrl?: string | null;
  onClose: () => void;
  /** PNG data URL (p/ej. data:image/png;base64,...) */
  onSave: (pngDataUrl: string) => void;
};

/** Ajusta tamaño físico del canvas, escala y fondo; deja listo para trazos en coordenadas CSS. */
function prepareCanvas(canvas: HTMLCanvasElement): {
  ctx: CanvasRenderingContext2D;
  cssW: number;
  cssH: number;
} | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, rect.width);
  const cssH = Math.max(1, rect.height);
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  const dark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  ctx.fillStyle = dark ? "#1e293b" : "#ffffff";
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.strokeStyle = dark ? "#e2e8f0" : "#0f172a";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.25;
  return { ctx, cssW, cssH };
}

export function SignaturePadDialog({
  open,
  title = "Firma",
  initialDataUrl,
  onClose,
  onSave,
}: SignaturePadDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const preparedRef = useRef(false);

  const resetSurface = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prep = prepareCanvas(canvas);
    if (!prep) return;
    preparedRef.current = true;
    if (initialDataUrl?.trim()) {
      const { ctx, cssW, cssH } = prep;
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, cssW, cssH);
      };
      img.src = initialDataUrl;
    }
  }, [initialDataUrl]);

  useEffect(() => {
    if (!open) return;
    // Prepara el canvas inmediatamente (y reintenta en el siguiente frame por si aún no tiene tamaño).
    preparedRef.current = false;
    resetSurface();
    const id = window.requestAnimationFrame(() => resetSurface());
    return () => window.cancelAnimationFrame(id);
  }, [open, resetSurface]);

  const pointerCss = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!preparedRef.current) {
      resetSurface();
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = pointerCss(e);
    lastRef.current = p;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !lastRef.current) return;
    const p = pointerCss(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    }
    drawingRef.current = false;
    lastRef.current = null;
  };

  const clearPad = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    prepareCanvas(canvas);
  }, []);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-3 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sig-pad-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl dark:border dark:border-slate-600 dark:bg-slate-800 sm:p-5">
        <h3
          id="sig-pad-title"
          className="text-base font-semibold text-slate-900 dark:text-slate-50"
        >
          {title}
        </h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Firma con el ratón o el dedo en el recuadro. «Limpiar» borra todo el trazo.
        </p>
        <div className="mt-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
          <canvas
            ref={canvasRef}
            className="h-44 w-full cursor-crosshair touch-none rounded-[10px] sm:h-52"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={(e) => {
              if (drawingRef.current) endStroke(e);
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearPad}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Limpiar
          </button>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-600">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-agro-600 px-3 py-2 text-xs font-semibold text-white hover:bg-agro-700"
          >
            Guardar firma
          </button>
        </div>
      </div>
    </div>
  );
}
