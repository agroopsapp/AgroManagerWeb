const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/time-tracking/page.tsx', 'utf8');
const lines = content.split('\n');

// Find key JSX section starts and ends
const keyLines = [1880, 1885, 2800, 2830, 2840, 2870, 2890, 2900, 2910, 2920];
keyLines.forEach(n => {
  const idx = n - 1;
  if (idx >= 0 && idx < lines.length) {
    console.log(n + ': ' + lines[idx].trim().substring(0, 120));
  }
});

// Search for ayerCompletaStep in JSX context
console.log('\n--- ayerCompletaStep usage ---');
lines.forEach((line, i) => {
  if (line.includes('ayerCompletaStep')) {
    console.log((i+1) + ': ' + line.trim().substring(0, 120));
  }
});

// Search for equipoPartModal in JSX context
console.log('\n--- equipoPartModal in JSX ---');
lines.forEach((line, i) => {
  if (line.includes('equipoPartModal') && (line.includes('&&') || line.includes('!== null'))) {
    console.log((i+1) + ': ' + line.trim().substring(0, 120));
  }
});
