/**
 * PDF único: por cada día de la rejilla (registro, sin imputar, no laboral), bloque de fichaje + parte en servidor si aplica.
 * Solo cliente; requiere empresas/servicios resueltos para nombres de líneas del parte.
 */
import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";
import { workReportsApi } from "@/services/work-reports.service";
import type { Company, WorkService } from "@/types";
import type { EquipoTablaFila, TimeEntryMock } from "@/features/time-tracking/types";
import {
  effectiveWorkMinutesEntry,
  equipoRegistroOcultaHorasEnTabla,
  formatRazonTablaEquipo,
} from "@/features/time-tracking/utils/formatters";
import { formatMinutesShort, formatTimeLocal } from "@/shared/utils/time";

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

function addImageSafe(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const formats = ["PNG", "JPEG", "WEBP"] as const;
  for (const fmt of formats) {
    try {
      doc.addImage(dataUrl, fmt, x, y, w, h, undefined, "SLOW");
      return true;
    } catch {
      /* siguiente */
    }
  }
  return false;
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

function fichajeTexto(e: TimeEntryMock): string {
  if (equipoRegistroOcultaHorasEnTabla(e)) {
    return `Sin horario de entrada/salida en rejilla · ${formatRazonTablaEquipo(e)}`;
  }
  if (!e.checkOutUtc) {
    return "Jornada sin cerrar (falta salida).";
  }
  const ent = formatTimeLocal(e.checkInUtc);
  const sal = formatTimeLocal(e.checkOutUtc);
  const br = formatMinutesShort(e.breakMinutes ?? 0);
  const tot = formatMinutesShort(effectiveWorkMinutesEntry(e));
  return `Entrada: ${ent}  ·  Salida: ${sal}  ·  Descanso: ${br}  ·  Total trabajado: ${tot}`;
}

type DiaPdf =
  | { kind: "registro"; workDate: string; e: TimeEntryMock }
  | { kind: "sinImputar"; workDate: string }
  | { kind: "noLaboral"; workDate: string };

function buildDiasSorted(filas: EquipoTablaFila[]): DiaPdf[] {
  const out: DiaPdf[] = [];
  for (const f of filas) {
    if (f.kind === "registro") {
      out.push({ kind: "registro", workDate: f.e.workDate, e: f.e });
    } else if (f.kind === "sinImputar") {
      out.push({ kind: "sinImputar", workDate: f.workDate });
    } else if (f.kind === "noLaboral") {
      out.push({ kind: "noLaboral", workDate: f.workDate });
    }
  }
  out.sort((a, b) => {
    const c = a.workDate.localeCompare(b.workDate);
    if (c !== 0) return c;
    if (a.kind === "registro" && b.kind === "registro") {
      return a.e.checkInUtc.localeCompare(b.e.checkInUtc);
    }
    return 0;
  });
  return out;
}

export async function downloadEquipoPersonaPartesBundlePdf(opts: {
  filas: EquipoTablaFila[];
  workerDisplayName: string;
  periodLabel: string;
  companies: Company[];
  services: WorkService[];
  fileBaseName: string;
}): Promise<void> {
  const { filas, workerDisplayName, periodLabel, companies, services, fileBaseName } = opts;

  const dias = buildDiasSorted(filas);

  if (dias.length === 0) {
    throw new Error("No hay filas en la vista actual para exportar.");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("Partes y fichajes (resumen por día)", margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Trabajador/a: ${workerDisplayName}`, margin, y);
  y += 5;
  doc.text(`Periodo: ${periodLabel}`, margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado: ${new Date().toLocaleString("es-ES")}`, margin, y);
  y += 10;
  doc.setTextColor(15, 23, 42);

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 12) {
      doc.addPage();
      y = 16;
    }
  };

  for (const dia of dias) {
    ensureSpace(42);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(formatWorkDateLongEs(dia.workDate), margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    if (dia.kind === "sinImputar") {
      const fichajeSin =
        "Fichaje: sin imputar — no consta entrada ni salida en este día laborable.";
      const parteSin = "Parte: sin parte en servidor (no hay jornada cerrada).";
      const l1 = doc.splitTextToSize(fichajeSin, pageW - 2 * margin);
      doc.text(l1, margin, y);
      y += l1.length * 4.2 + 2;
      const l2 = doc.splitTextToSize(parteSin, pageW - 2 * margin);
      doc.text(l2, margin, y);
      y += l2.length * 4.2 + 2;
    } else if (dia.kind === "noLaboral") {
      const fichajeNl =
        "Fichaje: día no laboral (fin de semana u otra causa). No aplica imputación de jornada en esta fila.";
      const parteNl = "Parte: no aplica.";
      const l1 = doc.splitTextToSize(fichajeNl, pageW - 2 * margin);
      doc.text(l1, margin, y);
      y += l1.length * 4.2 + 2;
      const l2 = doc.splitTextToSize(parteNl, pageW - 2 * margin);
      doc.text(l2, margin, y);
      y += l2.length * 4.2 + 2;
    } else {
      const e = dia.e;
      const fichLines = doc.splitTextToSize(fichajeTexto(e), pageW - 2 * margin);
      doc.text(fichLines, margin, y);
      y += fichLines.length * 4.2 + 2;

    if (e.workReportId?.trim()) {
      try {
        const report = await workReportsApi.getByIdWithLines(e.workReportId.trim());
        ensureSpace(28 + Math.min(report.lines.length * 5, 60));

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(
          `Parte en servidor · Estado: ${report.status ?? "—"} · ${report.lines.length} línea(s)`,
          margin,
          y,
        );
        y += 5;
        doc.setFont("helvetica", "normal");

        const body = report.lines.map((line, i) => {
          const co = companies.find((c) => c.id === line.clientCompanyId);
          const ar = co?.areas.find((a) => a.id === line.workAreaId);
          const svc = services.find((s) => s.id === line.serviceId);
          return [
            String(i + 1),
            co?.name ?? line.clientCompanyId,
            svc?.name ?? line.serviceId,
            ar?.name ?? line.workAreaId,
            (ar?.observations ?? "").trim() || "—",
          ];
        });

        if (body.length > 0) {
          autoTable(doc, {
            startY: y,
            head: [["#", "Empresa", "Servicio", "Área", "Obs. área"]],
            body,
            styles: { fontSize: 7.5, cellPadding: 1.2, overflow: "linebreak" },
            headStyles: { fillColor: [22, 101, 52], textColor: 255 },
            columnStyles: {
              0: { cellWidth: 12 },
              1: { cellWidth: 38 },
              2: { cellWidth: 32 },
              3: { cellWidth: 34 },
              4: { cellWidth: "auto" },
            },
            margin: { left: margin, right: margin },
          });
          y = (doc as JsPDFWithPlugin).lastAutoTable?.finalY ?? y + 24;
          y += 4;
        } else {
          doc.setFont("helvetica", "italic");
          doc.setTextColor(100, 116, 139);
          doc.text("Parte sin líneas en el servidor.", margin, y);
          doc.setTextColor(15, 23, 42);
          doc.setFont("helvetica", "normal");
          y += 6;
        }

        const sigUrl = report.signatureUrl?.trim();
        if (sigUrl) {
          const sigData = await fetchImageAsDataUrl(sigUrl);
          if (sigData) {
            ensureSpace(38);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.text("Firma", margin, y);
            y += 4;
            doc.setFont("helvetica", "normal");
            const sigW = 70;
            const sigH = 28;
            if (!addImageSafe(doc, sigData, margin, y, sigW, sigH)) {
              doc.setFontSize(7);
              doc.text("(No se pudo incrustar la imagen de firma)", margin, y);
            }
            y += sigH + 4;
          }
        }
      } catch {
        ensureSpace(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(180, 60, 60);
        doc.text("No se pudo cargar el detalle del parte para este día.", margin, y);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "normal");
        y += 6;
      }
    } else {
      ensureSpace(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 116, 139);
      doc.text("Sin parte de trabajo en servidor para este día.", margin, y);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      y += 6;
    }
    }

    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
  }

  const safeBase = fileBaseName.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 180);
  doc.save(`${safeBase}.pdf`);
}
