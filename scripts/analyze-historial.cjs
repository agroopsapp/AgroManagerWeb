const src = require('fs').readFileSync('src/app/dashboard/time-tracking/page.tsx', 'utf8');
const lines = src.split('\n');

const symbols = ['RAZON_NO_LABORAL', 'RAZON_SIN_IMPUTAR', 'RAZON_IMPUTACION_AUTOMATICA', 'MODIFICADO_POR_SISTEMA', 'RAZON_LABELS', 'formatRazon', 'historicoFilaSinImputarPasado', 'HistoricoPersonalFila', 'workPartSummaryByDate'];

symbols.forEach(sym => {
  const hits = [];
  lines.forEach((l, i) => { if (l.includes(sym)) hits.push(i+1); });
  console.log(`${sym}: lines ${hits.join(', ')} (${hits.length} hits)`);
});
