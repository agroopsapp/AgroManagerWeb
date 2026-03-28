const fs = require("fs");
const filePath = "src/app/dashboard/time-tracking/page.tsx";
const raw = fs.readFileSync(filePath, "utf8");
const content = raw.replace(/\r\n/g, "\n");
let lines = content.split("\n");

// Find the handleGenerateEquipoPartPdf block (starts at the line with "const handleGenerateEquipoPartPdf")
const pdfFnStartIdx = lines.findIndex(l => l.trim().startsWith("const handleGenerateEquipoPartPdf"));
// Find end: the "  };" that closes it (or just the "};")
let pdfFnEndIdx = pdfFnStartIdx + 1;
while (pdfFnEndIdx < lines.length) {
  const l = lines[pdfFnEndIdx].trim();
  if (l === "};") {
    break;
  }
  pdfFnEndIdx++;
}

console.log("PDF fn found at lines:", pdfFnStartIdx+1, "-", pdfFnEndIdx+1);

// Extract the function lines
const fnLines = lines.slice(pdfFnStartIdx, pdfFnEndIdx + 1);
// Remove them from current position (including surrounding blank lines)
let removeStart = pdfFnStartIdx;
while (removeStart > 0 && lines[removeStart - 1].trim() === "") removeStart--;
let removeEnd = pdfFnEndIdx;
while (removeEnd < lines.length - 1 && lines[removeEnd + 1].trim() === "") removeEnd++;

lines.splice(removeStart, removeEnd - removeStart + 1);

// Now find "  return (" which is the return of the main component
const returnIdx = lines.findIndex(l => l.trim() === "return (");
console.log("return ( at line:", returnIdx + 1);

// Insert the function before the return, with proper indentation
// The function should be inside the component (indented by 2 spaces)
const indentedFn = fnLines.map(l => "  " + l).join("\n");
lines.splice(returnIdx, 0, indentedFn, "");

const result = lines.join("\n");
fs.writeFileSync(filePath, result, "utf8");
console.log("Done! Total lines:", lines.length);
