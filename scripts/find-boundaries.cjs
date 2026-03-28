const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/time-tracking/page.tsx', 'utf8');
const lines = content.split('\n');

// Find key boundaries - search for section-level patterns
const patterns = [
  { name: 'fichadorPanel equipo', test: l => l.includes('fichadorPanel') && l.includes('equipo') },
  { name: 'ayerCompletaStep closed', test: l => l.includes('ayerCompletaStep') && l.includes('closed') },
  { name: 'forgotStep closed', test: l => l.includes('forgotStep') && l.includes('closed') },
  { name: 'equipoPartModal null', test: l => l.includes('equipoPartModal') && l.includes('null') },
  { name: 'restModalStep closed', test: l => l.includes('restModalStep') && l.includes('closed') },
  { name: 'import block', test: l => l.startsWith('import ') },
];

patterns.forEach(p => {
  const matches = [];
  lines.forEach((line, i) => {
    if (p.test(line)) matches.push({ ln: i+1, text: line.trim().substring(0, 120) });
  });
  if (matches.length > 0) {
    console.log('\n--- ' + p.name + ' ---');
    matches.forEach(m => console.log(m.ln + ': ' + m.text));
  }
});
