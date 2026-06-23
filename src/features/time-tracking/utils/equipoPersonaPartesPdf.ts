/**
 * PDF único: cabecera (empresa empleadora), resumen del periodo y bloque por día
 * (fichaje con horas ordinarias/extra + parte en servidor con horas por línea).
 */
import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";
import {
  AGROOPS_PDF_LOGO_PUBLIC_PATHS,
  createAgroOpsPdfWordmarkDataUrl,
} from "@/lib/agroopsBranding";
import { getMyCompanyProfile } from "@/lib/myCompanyProfile";
import { workReportsApi } from "@/services/work-reports.service";
import type { TimeEntryRowsSummaryDto } from "@/services/time-tracking.service";
import type { Company, WorkService } from "@/types";
import type { EquipoTablaFila, TimeEntryMock } from "@/features/time-tracking/types";
import {
  DEFAULT_STANDARD_WORKDAY_MINUTES,
  effectiveWorkMinutesEntry,
  equipoRegistroOcultaHorasEnTabla,
  formatRazonTablaEquipo,
  splitWorkedMinutesOrdinaryAndExtra,
} from "@/features/time-tracking/utils/formatters";
import {
  buildTeamHoursKpiScopeFromFilas,
  dailyCapMinutesFromSummary,
} from "@/features/time-tracking/utils/teamHoursKpiScope";
import { formatMinutesShort, formatTimeLocal } from "@/shared/utils/time";

type JsPDFWithPlugin = jsPDF & { lastAutoTable?: { finalY: number } };

const PDF_GREEN: [number, number, number] = [22, 101, 52];
const PDF_SLATE: [number, number, number] = [15, 23, 42];
const PDF_MUTED: [number, number, number] = [100, 116, 139];

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
  compression: "NONE" | "FAST" | "MEDIUM" | "SLOW" = "SLOW",
): boolean {
  const formats = ["PNG", "JPEG", "WEBP"] as const;
  for (const fmt of formats) {
    try {
      doc.addImage(dataUrl, fmt, x, y, w, h, undefined, compression);
      return true;
    } catch {
      /* siguiente */
    }
  }
  return false;
}

async function getImageSize(dataUrl: string): Promise<{ w: number; h: number } | null> {
  if (typeof Image === "undefined") return null;
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Logo de cabecera PDF: empresa si tiene resolución suficiente; si no, wordmark AgroOps. */
async function resolvePdfHeaderLogoDataUrl(): Promise<string | null> {
  const myCo = typeof window !== "undefined" ? getMyCompanyProfile() : null;
  let candidate: string | null = null;

  if (myCo?.logoDataUrl?.trim()) {
    candidate = myCo.logoDataUrl.trim();
  } else if (myCo?.logoUrl?.trim()) {
    candidate = await fetchImageAsDataUrl(myCo.logoUrl.trim());
  }

  if (candidate) {
    const sz = await getImageSize(candidate);
    if (sz && sz.w >= 320) return candidate;
  }

  if (typeof document !== "undefined") {
    const wordmark = createAgroOpsPdfWordmarkDataUrl();
    if (wordmark) return wordmark;
  }

  for (const path of AGROOPS_PDF_LOGO_PUBLIC_PATHS) {
    const img = await fetchImageAsDataUrl(path);
    if (img) return img;
  }

  return candidate;
}

async function embedPdfLogo(
  doc: jsPDF,
  margin: number,
  y: number,
  logoDataUrl: string,
): Promise<number> {
  const maxW = 100;
  const maxH = 22;
  const sz = await getImageSize(logoDataUrl);
  const ratio = sz && sz.h > 0 ? sz.w / sz.h : 4.8;
  let imgW = maxW;
  let imgH = imgW / ratio;
  if (imgH > maxH) {
    imgH = maxH;
    imgW = imgH * ratio;
  }
  addImageSafe(doc, logoDataUrl, margin, y, imgW, imgH, "NONE");
  return y + imgH + 4;
}

function formatWorkDateShortEs(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

async function renderEmployerHeader(
  doc: jsPDF,
  margin: number,
  pageW: number,
  startY: number,
): Promise<number> {
  let y = startY;
  const myCo = typeof window !== "undefined" ? getMyCompanyProfile() : null;

  const agroImg = await resolvePdfHeaderLogoDataUrl();
  if (agroImg) {
    y = await embedPdfLogo(doc, margin, y, agroImg);
  }

  const employerName = myCo?.name?.trim() || myCo?.fiscalName?.trim() || "";
  if (employerName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PDF_SLATE);
    doc.text("Empresa", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.text(employerName, margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(...PDF_MUTED);
    const meta: string[] = [];
    if (myCo?.fiscalName?.trim() && myCo.fiscalName.trim() !== employerName) {
      meta.push(myCo.fiscalName.trim());
    }
    if (myCo?.taxId?.trim()) meta.push(`CIF/NIF: ${myCo.taxId.trim()}`);
    if (meta.length) {
      doc.text(meta.join(" · "), margin, y);
      y += 4;
    }
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y + 2, pageW - margin, y + 2);
  return y + 8;
}

function renderDocumentTitle(
  doc: jsPDF,
  margin: number,
  pageW: number,
  y: number,
  workerDisplayName: string,
  periodLabel: string,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...PDF_SLATE);
  doc.text("Informe de partes y fichajes", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Trabajador/a: ${workerDisplayName}`, margin, y);
  y += 5;
  doc.text(`Periodo: ${periodLabel}`, margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(...PDF_MUTED);
  doc.text(`Generado: ${new Date().toLocaleString("es-ES")}`, margin, y);
  y += 8;
  return y;
}

function renderSummaryBlock(
  doc: jsPDF,
  margin: number,
  pageW: number,
  y: number,
  filas: EquipoTablaFila[],
  summary: TimeEntryRowsSummaryDto | null | undefined,
  capWorkMinutesPerDay: number,
): number {
  const dailyCap = dailyCapMinutesFromSummary(summary ?? null) || capWorkMinutesPerDay;
  const kpi = buildTeamHoursKpiScopeFromFilas(filas, summary ?? null);
  const horasImputadas = formatMinutesShort(kpi.minutosImputados);
  const objetivoH =
    summary?.theoreticalCapHours != null
      ? `${Math.round(summary.theoreticalCapHours)} h`
      : "—";
  const cumplimiento =
    summary?.percentOfTheoreticalCovered != null
      ? `${Math.round(summary.percentOfTheoreticalCovered)} %`
      : kpi.jornadasLaborables > 0
        ? `${kpi.jornadasFichadasPct} %`
        : "—";
  const extraPeriodoMin = filas.reduce((acc, f) => {
    if (f.kind !== "registro" || equipoRegistroOcultaHorasEnTabla(f.e)) return acc;
    const { extra } = splitWorkedMinutesOrdinaryAndExtra(
      effectiveWorkMinutesEntry(f.e),
      dailyCap,
    );
    return acc + extra;
  }, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_SLATE);
  doc.text("Resumen del periodo", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Horas imputadas", `${horasImputadas} de ${objetivoH} objetivo`],
      ["Cumplimiento", cumplimiento],
      ["Horas extra (periodo)", formatMinutesShort(extraPeriodoMin)],
      [
        "Jornadas fichadas",
        `${kpi.jornadasFichadas} / ${kpi.jornadasLaborables} (${kpi.jornadasFichadasPct} %)`,
      ],
      [
        "Partes completados",
        `${kpi.partesCompletados} / ${kpi.jornadasCerradas} (${kpi.partesPct} %)`,
      ],
      ["Sin fichar", String(kpi.sinFichar)],
      ["Sin parte", String(kpi.sinParte)],
      ["Vacaciones", String(kpi.vacaciones)],
      ["Bajas", String(kpi.bajas)],
    ],
    styles: { fontSize: 8.5, cellPadding: 2, textColor: PDF_SLATE },
    headStyles: { fillColor: PDF_GREEN, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: "bold" },
      1: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
    theme: "grid",
  });

  return ((doc as JsPDFWithPlugin).lastAutoTable?.finalY ?? y) + 10;
}

function fichajeTableBody(
  e: TimeEntryMock,
  capWorkMinutesPerDay: number,
): string[][] | null {
  if (equipoRegistroOcultaHorasEnTabla(e)) {
    return [[formatRazonTablaEquipo(e), "—", "—", "—", "—", "—"]];
  }
  if (!e.checkOutUtc) {
    return [
      [
        formatTimeLocal(e.checkInUtc),
        "—",
        formatMinutesShort(e.breakMinutes ?? 0),
        "—",
        "—",
        "Sin cerrar",
      ],
    ];
  }
  const worked = effectiveWorkMinutesEntry(e);
  const { ordinary, extra, total } = splitWorkedMinutesOrdinaryAndExtra(
    worked,
    capWorkMinutesPerDay,
  );
  return [
    [
      formatTimeLocal(e.checkInUtc),
      formatTimeLocal(e.checkOutUtc),
      formatMinutesShort(e.breakMinutes ?? 0),
      formatMinutesShort(ordinary),
      extra > 0 ? formatMinutesShort(extra) : "—",
      formatMinutesShort(total),
    ],
  ];
}

export async function downloadEquipoPersonaPartesBundlePdf(opts: {
  filas: EquipoTablaFila[];
  workerDisplayName: string;
  periodLabel: string;
  companies: Company[];
  services: WorkService[];
  fileBaseName: string;
  summary?: TimeEntryRowsSummaryDto | null;
  capWorkMinutesPerDay?: number;
}): Promise<void> {
  const {
    filas,
    workerDisplayName,
    periodLabel,
    companies,
    services,
    fileBaseName,
    summary,
    capWorkMinutesPerDay = DEFAULT_STANDARD_WORKDAY_MINUTES,
  } = opts;

  const dias = buildDiasSorted(filas);
  if (dias.length === 0) {
    throw new Error("No hay filas en la vista actual para exportar.");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 10;

  y = await renderEmployerHeader(doc, margin, pageW, y);
  y = renderDocumentTitle(doc, margin, pageW, y, workerDisplayName, periodLabel);
  y = renderSummaryBlock(doc, margin, pageW, y, filas, summary, capWorkMinutesPerDay);

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 14) {
      doc.addPage();
      y = 16;
    }
  };

  const topeHLabel = `${capWorkMinutesPerDay / 60} h`;

  for (const dia of dias) {
    ensureSpace(50);

    const dateLabel = formatWorkDateShortEs(dia.workDate);
    autoTable(doc, {
      startY: y,
      body: [[dateLabel]],
      styles: {
        fontSize: 10,
        fontStyle: "bold",
        textColor: [255, 255, 255],
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      },
      theme: "plain",
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === "body") {
          data.cell.styles.fillColor = PDF_GREEN;
        }
      },
    });
    y = ((doc as JsPDFWithPlugin).lastAutoTable?.finalY ?? y) + 4;

    if (dia.kind === "sinImputar") {
      autoTable(doc, {
        startY: y,
        body: [
          ["Fichaje", "Sin imputar — no consta entrada ni salida en este día laborable."],
          ["Parte", "Sin parte en servidor (no hay jornada cerrada)."],
        ],
        styles: { fontSize: 8.5, cellPadding: 2, textColor: PDF_SLATE },
        columnStyles: { 0: { cellWidth: 22, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
        margin: { left: margin, right: margin },
        theme: "grid",
      });
      y = ((doc as JsPDFWithPlugin).lastAutoTable?.finalY ?? y) + 8;
      continue;
    }

    if (dia.kind === "noLaboral") {
      autoTable(doc, {
        startY: y,
        body: [
          ["Fichaje", "Día no laboral (fin de semana u otra causa)."],
          ["Parte", "No aplica."],
        ],
        styles: { fontSize: 8.5, cellPadding: 2, textColor: PDF_SLATE },
        columnStyles: { 0: { cellWidth: 22, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
        margin: { left: margin, right: margin },
        theme: "grid",
      });
      y = ((doc as JsPDFWithPlugin).lastAutoTable?.finalY ?? y) + 8;
      continue;
    }

    const e = dia.e;
    const fichajeBody = fichajeTableBody(e, capWorkMinutesPerDay);
    if (fichajeBody) {
      ensureSpace(28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_MUTED);
      doc.text(`Fichaje · tope jornada ${topeHLabel}`, margin, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        head: [["Entrada", "Salida", "Descanso", "Ordinaria", "Extra", "Total"]],
        body: fichajeBody,
        styles: { fontSize: 8, cellPadding: 1.8, halign: "center" },
        headStyles: { fillColor: [241, 245, 249], textColor: PDF_SLATE, fontStyle: "bold" },
        margin: { left: margin, right: margin },
        theme: "grid",
      });
      y = ((doc as JsPDFWithPlugin).lastAutoTable?.finalY ?? y) + 5;
    }

    if (e.workReportId?.trim()) {
      try {
        const report = await workReportsApi.getByIdWithLines(e.workReportId.trim());
        ensureSpace(28 + Math.min(report.lines.length * 6, 70));

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...PDF_MUTED);
        doc.text(
          `Parte de trabajo · Estado: ${report.status ?? "—"} · ${report.lines.length} línea(s)`,
          margin,
          y,
        );
        y += 3;

        let totalLineMin = 0;
        const body = report.lines.map((line, i) => {
          const lineMin = Math.max(0, Math.round(Number(line.minutes) || 0));
          totalLineMin += lineMin;
          const co = companies.find((c) => c.id === line.clientCompanyId);
          const ar = co?.areas.find((a) => a.id === line.workAreaId);
          const svc = services.find((s) => s.id === line.serviceId);
          return [
            String(i + 1),
            co?.name ?? line.clientCompanyNameSnapshot ?? line.clientCompanyId,
            svc?.name ?? line.serviceNameSnapshot ?? line.serviceId,
            ar?.name ?? line.workAreaNameSnapshot ?? line.workAreaId,
            formatMinutesShort(lineMin),
            (line.notes ?? "").trim() || "—",
          ];
        });

        if (body.length > 0) {
          autoTable(doc, {
            startY: y,
            head: [["#", "Empresa", "Servicio", "Área", "Horas", "Notas"]],
            body,
            styles: { fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" },
            headStyles: { fillColor: PDF_GREEN, textColor: 255 },
            columnStyles: {
              0: { cellWidth: 10, halign: "center" },
              1: { cellWidth: 34 },
              2: { cellWidth: 28 },
              3: { cellWidth: 28 },
              4: { cellWidth: 16, halign: "center", fontStyle: "bold" },
              5: { cellWidth: "auto" },
            },
            margin: { left: margin, right: margin },
          });
          y = ((doc as JsPDFWithPlugin).lastAutoTable?.finalY ?? y) + 3;

          const workedDay = effectiveWorkMinutesEntry(e);
          const { extra: extraDay } = splitWorkedMinutesOrdinaryAndExtra(
            workedDay,
            capWorkMinutesPerDay,
          );
          const diffParteVsFichaje = Math.abs(totalLineMin - workedDay);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...PDF_SLATE);
          doc.text(
            `Total imputado en tareas: ${formatMinutesShort(totalLineMin)} · Horas extra del día: ${extraDay > 0 ? formatMinutesShort(extraDay) : "—"} · Cuadre fichaje: ${diffParteVsFichaje <= 1 ? "OK" : `Δ ${formatMinutesShort(diffParteVsFichaje)}`}`,
            margin,
            y,
          );
          y += 6;
        } else {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(...PDF_MUTED);
          doc.text("Parte sin líneas en el servidor.", margin, y);
          y += 6;
        }

        const sigUrl = report.signatureUrl?.trim();
        if (sigUrl) {
          const sigData = await fetchImageAsDataUrl(sigUrl);
          if (sigData) {
            ensureSpace(36);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(...PDF_SLATE);
            doc.text("Firma", margin, y);
            y += 4;
            const sigW = 64;
            const sigH = 26;
            if (!addImageSafe(doc, sigData, margin, y, sigW, sigH)) {
              doc.setFontSize(7);
              doc.setTextColor(...PDF_MUTED);
              doc.text("(No se pudo incrustar la imagen de firma)", margin, y);
            }
            y += sigH + 4;
          }
        }
      } catch {
        ensureSpace(10);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(180, 60, 60);
        doc.text("No se pudo cargar el detalle del parte para este día.", margin, y);
        y += 6;
      }
    } else {
      ensureSpace(10);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_MUTED);
      doc.text("Sin parte de trabajo en servidor para este día.", margin, y);
      y += 6;
    }

    y += 4;
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_MUTED);
    doc.text(
      `Página ${p} de ${pageCount}`,
      pageW - margin,
      pageH - 8,
      { align: "right" },
    );
  }

  const safeBase = fileBaseName.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 180);
  doc.save(`${safeBase}.pdf`);
}
