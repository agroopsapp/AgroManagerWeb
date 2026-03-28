const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/time-tracking/page.tsx', 'utf8');
const lines = content.split('\n');

// Find all useState and related state variable names
const patterns = [
  'ayerComp', 'ayerMan', 'fechaAyer', 'ayerMin', 
  'forgot', 'equipoPart', 'restModal', 'restAnswer', 'restMinutes', 'restClock', 'askAmount',
  'workPart', 'submitCompletar', 'resetAyer', 'resetForgot',
  'equipoPartSign', 'closeEquipoPart', 'openEquipoPart',
  'workPartOverride', 'confirmWorkPart', 'confirmRest'
];

patterns.forEach(pat => {
  const matches = [];
  lines.forEach((line, i) => {
    if (line.includes(pat) && (line.includes('useState') || line.includes('const ') || line.includes('function '))) {
      matches.push({ ln: i+1, text: line.trim().substring(0, 120) });
    }
  });
  if (matches.length > 0) {
    console.log('\n-- ' + pat + ' --');
    matches.slice(0, 5).forEach(m => console.log(m.ln + ': ' + m.text));
  }
});
