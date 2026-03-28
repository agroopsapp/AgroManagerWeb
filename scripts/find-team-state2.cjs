const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/time-tracking/page.tsx', 'utf8');
const lines = content.split('\n');

const patterns = [
  'equipoMes', 'equipoTrim', 'equipoAnio', 'equipoPersona', 'rowsFiltradas', 'filasOrdenadas',
  'tablaScrollRef', 'editModal', 'editForm', 'guardar', 'closeEquipo',
  'totalMinutos', 'totalEquipo',
];

patterns.forEach(pat => {
  const matches = [];
  lines.forEach((line, i) => {
    if (line.includes(pat)) {
      matches.push({ ln: i+1, text: line.trim().substring(0, 130) });
    }
  });
  if (matches.length > 0) {
    console.log('\n-- ' + pat + ' --');
    matches.slice(0, 5).forEach(m => console.log(m.ln + ': ' + m.text));
  }
});
