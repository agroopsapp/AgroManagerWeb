const src = require('fs').readFileSync('src/app/dashboard/time-tracking/page.tsx', 'utf8');
const lines = src.split('\n');
// Find key JSX structural markers in the return statement
lines.forEach((l, i) => {
  const t = l.trim();
  if (i < 100) return; // skip imports
  if (
    t.startsWith('{/*') ||
    t.startsWith('return (') ||
    (t.startsWith('{') && t.includes('Modal')) ||
    (t.startsWith('{') && t.includes('Panel')) ||
    (t.startsWith('{') && t.includes('Step')) ||
    t.includes('ayerCompStep') && t.includes('!==') ||
    t.includes('forgotStep') && t.includes('!==') ||
    t.includes('restModalStep') && t.includes('!==') ||
    t.includes('equipoModal') && !t.includes('setEquipoModal') ||
    t.includes('fichadorPanel') && t.includes('equipo') ||
    t.includes('<WorkParts') ||
    t.includes('<div className="fixed') ||
    t.includes('</div>') && t.length < 20 && i > 2700
  ) {
    console.log(i+1, l.slice(0,120));
  }
});
