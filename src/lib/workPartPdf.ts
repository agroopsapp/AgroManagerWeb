import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";
import {
  AGROOPS_PDF_LOGO_PUBLIC_PATHS,
  createAgroOpsPdfWordmarkDataUrl,
} from "@/lib/agroopsBranding";
import { getMyCompanyProfile } from "@/lib/myCompanyProfile";
import type { WorkPartRecord, WorkPartTask } from "@/lib/workPartsStorage";
import type { Company } from "@/types";

type JsPDFWithPlugin = jsPDF & { lastAutoTable?: { finalY: number } };

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const abs = url.startsWith("http")
      ? url
      : `${typeof window !== "undefined" ? window.location.origin : ""}${url.startsWith("/") ? url : `/${url}`}`;
    const res = await fetch(abs);
    if (!res.ok) return null;
    const blob = await res.blob();
    const t = blob.type || "";
    if (
      !t.includes("png") &&
      !t.includes("jpeg") &&
      !t.includes("jpg") &&
      !t.includes("webp")
    ) {
      return null;
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function getImageSize(dataUrl: string): Promise<{ w: number; h: number } | null> {
  if (typeof Image === "undefined") return null;
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function formatWorkDateLongEs(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function addImageSafe(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  w: number,
  h: number,
  compression: "NONE" | "FAST" | "MEDIUM" | "SLOW" = "SLOW"
): boolean {
  const formats = ["PNG", "JPEG", "WEBP"] as const;
  for (const fmt of formats) {
    try {
      doc.addImage(dataUrl, fmt, x, y, w, h, undefined, compression);
      return true;
    } catch {
      /* siguiente formato */
    }
  }
  return false;
}

/**
 * Genera y descarga un PDF del parte: cabecera AgroOps, datos de imputación al cliente, resumen fichaje, tabla y firma.
 */
export async function downloadWorkPartPdf(
  record: WorkPartRecord,
  tasks: WorkPartTask[],
  opts?: {
    workerDisplayName?: string;
    companies?: Company[];
  }
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 10;

  const firstCompanyId = tasks[0]?.companyId;
  const companyMeta = firstCompanyId
    ? opts?.companies?.find((c) => c.id === firstCompanyId)
    : undefined;
  const imputationName =
    companyMeta?.name ??
    tasks[0]?.companyName ??
    record.companyName ??
    "—";

  let agroImg: string | null = null;
  const myCo = typeof window !== "undefined" ? getMyCompanyProfile() : null;
  if (myCo?.logoDataUrl?.trim()) {
    agroImg = myCo.logoDataUrl.trim();
  } else if (myCo?.logoUrl?.trim()) {
    agroImg = await fetchImageAsDataUrl(myCo.logoUrl.trim());
  }
  if (!agroImg) {
    for (const path of AGROOPS_PDF_LOGO_PUBLIC_PATHS) {
      agroImg = await fetchImageAsDataUrl(path);
      if (agroImg) break;
    }
    if (!agroImg && typeof document !== "undefined") {
      agroImg = createAgroOpsPdfWordmarkDataUrl();
    }
  }
  if (agroImg) {
    // Mantener proporción del logo y evitar que se vea “aplastado”.
    const maxW = 120;
    const maxH = 24;
    const sz = await getImageSize(agroImg);
    const ratio = sz && sz.h > 0 ? sz.w / sz.h : 5; // fallback para wordmark
    let imgW = maxW;
    let imgH = imgW / ratio;
    if (imgH > maxH) {
      imgH = maxH;
      imgW = imgH * ratio;
    }
    addImageSafe(doc, agroImg, margin, y, imgW, imgH, "SLOW");
    y += 22;
  }

  // Datos de "mi empresa" (emisor): se imprimen en pequeño bajo el logo.
  if (
    myCo &&
    (myCo.name ||
      myCo.fiscalName ||
      myCo.taxId ||
      myCo.address ||
      myCo.email ||
      myCo.phone ||
      myCo.website)
  ) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    const lines = [
      myCo.name?.trim() ? myCo.name.trim() : null,
      myCo.fiscalName?.trim() ? myCo.fiscalName.trim() : null,
      myCo.taxId?.trim() ? `CIF / NIF: ${myCo.taxId.trim()}` : null,
      myCo.address?.trim() ? myCo.address.trim() : null,
      [myCo.phone?.trim() ? `Tel: ${myCo.phone.trim()}` : null, myCo.email?.trim() ? myCo.email.trim() : null]
        .filter(Boolean)
        .join(" · ") || null,
      myCo.website?.trim() ? myCo.website.trim() : null,
    ].filter((x): x is string => Boolean(x));
    if (lines.length) {
      const wrapped = lines.flatMap((ln) => doc.splitTextToSize(ln, pageWidth - 2 * margin));
      doc.text(wrapped, margin, y - 3);
      y += Math.min(10, wrapped.length * 3.2);
    }
  }

  const clientLogoData = companyMeta?.logoUrl?.trim()
    ? await fetchImageAsDataUrl(companyMeta.logoUrl.trim())
    : null;
  const textMaxW = clientLogoData
    ? pageWidth - 2 * margin - 48
    : pageWidth - 2 * margin;
  const imputationBlockStart = y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Empresa de imputación (cliente / obra)", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  const nameLines = doc.splitTextToSize(imputationName, textMaxW);
  doc.text(nameLines, margin, y);
  y += nameLines.length * 4.2;
  if (clientLogoData) {
    const lw = 44;
    const lh = 12;
    addImageSafe(
      doc,
      clientLogoData,
      pageWidth - margin - lw,
      imputationBlockStart,
      lw,
      lh
    );
  }

  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  if (companyMeta?.taxId?.trim()) {
    doc.text(`CIF / NIF: ${companyMeta.taxId.trim()}`, margin, y);
    y += 4;
  }
  if (companyMeta?.address?.trim()) {
    const addrLines = doc.splitTextToSize(
      companyMeta.address.trim(),
      textMaxW
    );
    doc.text(addrLines, margin, y);
    y += addrLines.length * 3.6;
  }

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Parte de trabajo", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Día: ${formatWorkDateLongEs(record.workDate)}`, margin, y);
  y += 5;
  if (opts?.workerDisplayName?.trim()) {
    doc.text(`Trabajador/a: ${opts.workerDisplayName.trim()}`, margin, y);
    y += 5;
  }

  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Resumen del fichaje", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 55, 55);
  const resumen =
    `Entrada: ${record.entradaDisplay}  ·  Salida: ${record.salidaDisplay}  ·  ` +
    `Descanso: ${record.breakMinutes} min  ·  Total trabajado: ${record.workedMinutes} min`;
  const resumenLines = doc.splitTextToSize(resumen, pageWidth - 2 * margin);
  doc.text(resumenLines, margin, y);
  y += resumenLines.length * 4 + 4;
  doc.setTextColor(15, 23, 42);

  if (tasks.length === 0) {
    doc.setFontSize(9);
    doc.text("Sin líneas de tarea registradas en este parte.", margin, y);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["#", "Empresa", "Servicio", "Área", "Observaciones"]],
      body: tasks.map((t, i) => [
        String(i + 1),
        t.companyName,
        t.serviceName,
        t.areaName,
        t.areaObservations?.trim() || "—",
      ]),
      styles: { fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 36 },
        2: { cellWidth: 34 },
        3: { cellWidth: 34 },
        4: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
    });
    const d = doc as JsPDFWithPlugin;
    y = (d.lastAutoTable?.finalY ?? y) + 10;
  }

  if (record.signaturePngDataUrl?.trim()) {
    const labelH = 5;
    const sigW = 78;
    const sigH = 30;
    if (y + labelH + sigH + 15 > pageH - 18) {
      doc.addPage();
      y = 18;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Firma del trabajador/a", margin, y);
    y += labelH + 1;
    doc.setFont("helvetica", "normal");
    const ok = addImageSafe(
      doc,
      record.signaturePngDataUrl,
      margin,
      y,
      sigW,
      sigH
    );
    if (!ok) {
      doc.setFontSize(8);
      doc.text("(No se pudo incluir la firma en el PDF)", margin, y);
    }
    y += sigH + 4;
  }

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Documento generado el ${new Date().toLocaleString("es-ES")}`,
    margin,
    pageH - 9
  );

  const safeId = record.id.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 14) || "parte";
  doc.save(`parte-trabajo-${record.workDate}-${safeId}.pdf`);
}
