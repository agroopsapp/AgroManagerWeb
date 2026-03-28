const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/time-tracking/page.tsx', 'utf8');
const lines = content.split('\n');

const patterns = [
  'forgotMode', 'forgotFullBreak', 'forgotBreak', 'forgotError', 'forgotSolo',
  'workPartData', 'equipoPartLoad', 'equipoPartSav', 'equipoPartErr',
  'ayerCompHad', 'initDescanso', 'pdfLoading', 'equipoPartPdf',
  'workPartLoad', 'addWorkPart', 'patchWorkPart', 'removeWorkPart',
  'submitForgot', 'addEquipoPart', 'patchEquipoPart', 'removeEquipoPart', 'saveEquipoPart'
];

patterns.forEach(pat => {
  const matches = [];
  lines.forEach((line, i) => {
    if (line.includes(pat)) {
      matches.push({ ln: i+1, text: line.trim().substring(0, 120) });
    }
  });
  if (matches.length > 0) {
    console.log('\n-- ' + pat + ' --');
    matches.slice(0, 4).forEach(m => console.log(m.ln + ': ' + m.text));
  }
});
