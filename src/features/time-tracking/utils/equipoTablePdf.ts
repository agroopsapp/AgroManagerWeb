import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";
import type { EquipoTablaFila } from "@/features/time-tracking/types";
import { buildEquipoTableExportRows } from "@/features/time-tracking/utils/formatters";

/**
 * Descarga un PDF en horizontal con la misma rejilla que la exportación CSV/PDF del equipo.
 * Solo en cliente (navegador).
 */
export function downloadEquipoTablePdf(opts: {
  filas: EquipoTablaFila[];
  nameByPersonKey?: Map<string, string>;
  /** Minutos de jornada objetivo por día (p. ej. `hoursPerWorkingDay` × 60 del summary). */
  capWorkMinutesPerDay?: number;
  title: string;
  fileBaseName: string;
}): void {
  const { filas, nameByPersonKey, capWorkMinutesPerDay, title, fileBaseName } = opts;
  const { headers, rows } = buildEquipoTableExportRows(filas, nameByPersonKey, capWorkMinutesPerDay);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado: ${new Date().toLocaleString("es-ES")}`, 14, 16);

  autoTable(doc, {
    startY: 19,
    head: [headers],
    body: rows,
    styles: {
      fontSize: 6,
      cellPadding: 0.8,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [22, 101, 70],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 6.5,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 10, right: 10, top: 19 },
    showHead: "everyPage",
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.1,
  });

  const safeBase = fileBaseName.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 180);
  doc.save(`${safeBase}.pdf`);
}
