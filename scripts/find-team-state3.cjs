const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/time-tracking/page.tsx', 'utf8');
const lines = content.split('\n');

// Search for ALL state vars starting around line 440-810 (state declarations block)
console.log('=== State declarations (lines 440-810) ===');
for (let i = 440; i <= 810 && i < lines.length; i++) {
  const l = lines[i].trim();
  if (l.includes('useState') || l.includes('useRef') || l.includes('useMemo') || l.includes('const equipo')) {
    console.log((i+1) + ': ' + l.substring(0, 130));
  }
}
