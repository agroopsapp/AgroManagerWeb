const src = require('fs').readFileSync('src/app/dashboard/time-tracking/page.tsx', 'utf8');
src.split('\n').forEach((l,i) => { if (l.includes('TimeEntryRazon')) console.log(i+1, l.trim()); });
