const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/time-tracking/page.tsx', 'utf8');
const lines = content.split('\n');

const patterns = [
  'periodo', 'equipoPeriodo', 'equipoDia', 'equipoMes', 'equipoTrim', 'equipoAnio', 
  'equipoPersona', 'opcionesMes', 'opcionesTrim', 'opcionesAnio',
  'totalMinutos', 'totalHoras', 'rowsFiltradas', 'diasLaborables', 'personasEnObjetivo',
  'horasObjetivo', 'hDonut', 'horasImputadas', 'horasFalta', 'fichajeTipo',
  'horasSinImputar', 'diasSinImputar', 'partesEquipoStats', 'diasCalendario', 'filasOrdenadas',
  'equipoSort', 'tablaScrollRef', 'editModal', 'editForm',
  'setEquipoPeriodo', 'setEquipoDia', 'setEquipoMes', 'setSortColumn', 'guardarVac',
  'guardarHorario', 'openEquipoEdit', 'closeEquipoEdit',
];

patterns.forEach(pat => {
  const matches = [];
  lines.forEach((line, i) => {
    if (line.includes(pat) && (line.includes('const ') || line.includes('useState') || line.includes('useMemo') || line.includes('useRef'))) {
      matches.push({ ln: i+1, text: line.trim().substring(0, 120) });
    }
  });
  if (matches.length > 0) {
    console.log('\n-- ' + pat + ' --');
    matches.slice(0, 3).forEach(m => console.log(m.ln + ': ' + m.text));
  }
});
