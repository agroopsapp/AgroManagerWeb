const fs = require("fs");
const filePath = "src/app/dashboard/time-tracking/page.tsx";
const raw = fs.readFileSync(filePath, "utf8");
const content = raw.replace(/\r\n/g, "\n");
let lines = content.split("\n");

// 1. Find and remove the PARTIAL function body that was wrongly inserted (lines 1825-1852, 0-indexed: 1824-1851)
//    Identify by looking for "const handleGenerateEquipoPartPdf" 
const partialFnStart = lines.findIndex(l => l.trim().startsWith("const handleGenerateEquipoPartPdf"));
if (partialFnStart === -1) {
  console.error("Could not find partial fn start");
  process.exit(1);
}
// Find how many lines until the recordForPdf closing "};", which is the WRONG end marker
let partialFnEnd = partialFnStart + 1;
while (partialFnEnd < lines.length) {
  if (lines[partialFnEnd].trim() === "};") break;
  partialFnEnd++;
}
console.log("Partial fn: lines", partialFnStart+1, "-", partialFnEnd+1);

// Remove these lines
lines.splice(partialFnStart, partialFnEnd - partialFnStart + 1);
// Remove any trailing blank line
while (lines[partialFnStart] && lines[partialFnStart].trim() === "") {
  lines.splice(partialFnStart, 1);
}

// 2. Find the orphaned tail AFTER the component closing brace
//    The component closes with "}" at some line, then the tail is `await downloadWorkPartPdf...`
//    Find "await downloadWorkPartPdf" 
const tailStart = lines.findIndex(l => l.trim().startsWith("await downloadWorkPartPdf("));
if (tailStart === -1) {
  console.log("No orphaned tail found - might be OK");
} else {
  // Find the end of the tail (the `};` closing the arrow function)
  let tailEnd = tailStart;
  while (tailEnd < lines.length) {
    const l = lines[tailEnd].trim();
    if (l === "};") break;
    tailEnd++;
  }
  console.log("Tail: lines", tailStart+1, "-", tailEnd+1);
  lines.splice(tailStart, tailEnd - tailStart + 1);
  // Remove any leading blank lines
  while (tailStart < lines.length && lines[tailStart].trim() === "") {
    lines.splice(tailStart, 1);
  }
}

// 3. Insert the complete handleGenerateEquipoPartPdf before the return statement
const returnIdx = lines.findIndex(l => l.trim() === "return (");
console.log("return ( at line:", returnIdx + 1);

const fullFn = `  const handleGenerateEquipoPartPdf = async (): Promise<void> => {
    if (!equipoPartModal) return;
    setEquipoPartPdfLoading(true);
    try {
      const tasks =
        buildEquipoPartTasks() ??
        (equipoPartModal.existing
          ? getTasksFromRecord(equipoPartModal.existing)
          : null);
      if (!tasks || tasks.length === 0) {
        setEquipoPartError("No hay tareas válidas para incluir en el PDF.");
        return;
      }
      const nEmp = Array.from(new Set(tasks.map((t) => t.companyId))).length;
      const recordForPdf: WorkPartRecord = {
        id: equipoPartModal.existing?.id ?? \`tmp-\${Date.now()}\`,
        workDate: equipoPartModal.workDate,
        workerId: equipoPartModal.workerId,
        entradaDisplay: formatTimeLocal(equipoPartModal.entry.checkInUtc),
        salidaDisplay: formatTimeLocal(equipoPartModal.entry.checkOutUtc),
        breakMinutes: equipoPartModal.entry.breakMinutes ?? 0,
        workedMinutes: Math.max(0, effectiveWorkMinutesEntry(equipoPartModal.entry) ?? 0),
        companyId: tasks[0].companyId,
        companyName: nEmp === 1 ? tasks[0].companyName : \`Varias empresas (\${nEmp})\`,
        tasks,
        savedAtUtc: equipoPartModal.existing?.savedAtUtc ?? new Date().toISOString(),
        ...(equipoPartSignatureTemp ? { signaturePngDataUrl: equipoPartSignatureTemp } : {}),
      };
      await downloadWorkPartPdf(recordForPdf, tasks, {
        workerDisplayName: workerNameById(equipoPartModal.workerId),
        companies: equipoPartCompanies,
      });
      setEquipoPartError(null);
    } catch {
      setEquipoPartError("No se pudo generar el PDF. Inténtalo de nuevo.");
    } finally {
      setEquipoPartPdfLoading(false);
    }
  };
`;

lines.splice(returnIdx, 0, fullFn);

const result = lines.join("\n");
fs.writeFileSync(filePath, result, "utf8");
console.log("Done! Total lines:", lines.length);
