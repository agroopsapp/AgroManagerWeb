AWconst src = require('fs').readFileSync('src/app/dashboard/time-tracking/page.tsx', 'utf8');
const lines = src.split('\n');
const idx = lines.findIndex(l => l.includes('const openEquipoEditModal') || l.includes('function openEquipoEditModal'));
if (idx >= 0) {
  console.log('defined at line', idx+1, lines[idx].trim());
} else {
  console.log('NOT defined as standalone - searching...');
  lines.forEach((l, i) => {
    if (l.includes('openEquipoEditModal') && !l.includes('//') && !l.includes('onClick')) {
      console.log(i+1, l.trim().slice(0,100));
    }
  });
}
