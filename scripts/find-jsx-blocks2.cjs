const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/time-tracking/page.tsx', 'utf8');
const lines = content.split('\n');

// Find key section endings and starts around line 2800-3400
const ranges = [[2790, 2910], [2960, 3070], [3020, 3050], [3350, 3380], [3640, 3680]];
ranges.forEach(([start, end]) => {
  console.log('\n--- Lines ' + start + '-' + end + ' ---');
  for (let i = start - 1; i < end && i < lines.length; i++) {
    const l = lines[i].trim();
    if (l) console.log((i+1) + ': ' + l.substring(0, 120));
  }
});
