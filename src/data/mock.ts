import type { Task, Worker, AnimalIncident, Role, User, Farm, Species, Animal, AnimalCase, RecurringTaskSchedule } from "@/types";

/** Plantillas de tareas preconfiguradas para crear nuevas tareas */
export interface TaskTemplate {
  id: string;
  title: string;
  managerDetails: string;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  { id: "tmpl1", title: "Dar de comer a los cerdos", managerDetails: "Dar pienso a los cerdos del corral indicado en dos turnos: mañana 7:00 y tarde 15:00. Revisar que el bebedero esté limpio." },
  { id: "tmpl2", title: "Limpiar establo", managerDetails: "Limpiar boxes y pasillos. Cambiar cama y retirar estiércol al estercolero. Revisar desagües." },
  { id: "tmpl3", title: "Revisar animal enfermo", managerDetails: "Revisar estado general. Si sigue mal, avisar al veterinario." },
  { id: "tmpl4", title: "Preparar pienso", managerDetails: "Preparar mezcla según ficha del almacén. Cantidad para dos días. Guardar sobrante en lugar fresco." },
  { id: "tmpl5", title: "Reparar valla", managerDetails: "Llevar alambre y grapas. Cuidado con el ganado al entrar." },
  { id: "tmpl6", title: "Vacunar terneros", managerDetails: "Vacuna en nevera. Aplicar según calendario a los terneros marcados. Anotar en la hoja de control." },
];

export const MOCK_FARMS: Farm[] = [
  { id: "f1", name: "Granja Norte", location: "Carretera N-1 km 42, Burgos" },
  { id: "f2", name: "Granja Sur", location: "Polígono Industrial Sur, nave 8, Córdoba" },
  { id: "f3", name: "Granja Este", location: "Finca La Vega, 28400 Madrid" },
];

export const MOCK_SPECIES: Species[] = [
  { id: "s1", name: "Vaca" },
  { id: "s2", name: "Cerdo" },
  { id: "s3", name: "Oveja" },
  { id: "s4", name: "Caballo" },
  { id: "s5", name: "Ternero" },
];

export const MOCK_ANIMALS: Animal[] = [
  { id: "a1", name: "Blanca", farmId: "f1", speciesId: "s1", sex: "female", birthDate: "2020-03-15", identification: "ES-V-001" },
  { id: "a2", name: "Manchado", farmId: "f1", speciesId: "s2", sex: "male", birthDate: "2022-01-20", identification: "ES-P-002" },
  { id: "a3", name: "Lola", farmId: "f2", speciesId: "s1", sex: "female", birthDate: "2019-07-10", identification: "ES-V-012" },
  { id: "a4", name: "Curro", farmId: "f2", speciesId: "s4", sex: "male", birthDate: "2018-05-01", identification: "ES-C-003" },
  { id: "a5", name: "Nube", farmId: "f3", speciesId: "s3", sex: "female", birthDate: "2021-11-22", identification: "ES-O-007" },
];

export const MOCK_ROLES: Role[] = [
  { id: "r1", name: "Trabajador" },
  { id: "r2", name: "Manager" },
  { id: "r3", name: "Admin" },
];

export const MOCK_USERS: User[] = [
  { id: "u1", name: "Juan Pérez", email: "juan@agro.local", phone: "+34 612 345 678", roleId: "r1" },
  { id: "u2", name: "Pedro García", email: "pedro@agro.local", phone: "+34 623 456 789", roleId: "r1" },
  { id: "u3", name: "Luis López", email: "luis@agro.local", phone: "+34 634 567 890", roleId: "r1" },
  { id: "u4", name: "Ana Martínez", email: "ana@agro.local", phone: "+34 645 678 901", roleId: "r1" },
  { id: "u5", name: "María Admin", email: "admin@agro.local", phone: "+34 656 789 012", roleId: "r3" },
];

export const MOCK_WORKERS: Worker[] = [
  { id: "w1", name: "Juan" },
  { id: "w2", name: "Pedro" },
  { id: "w3", name: "Luis" },
  { id: "w4", name: "Ana" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const today = todayISO();

export const MOCK_TASKS: Task[] = [
  { id: "t1", title: "Feed pigs", priority: "high", farmName: "Granja Norte", workerId: "w1", status: "ready", managerDetails: "Dar pienso a los cerdos del corral 3 en dos turnos: mañana 7:00 y tarde 15:00. Revisar que el bebedero esté limpio.", comments: [], date: today },
  { id: "t2", title: "Clean stable", priority: "medium", farmName: "Granja Norte", workerId: "w1", status: "in_progress", managerDetails: "Limpiar boxes y pasillos. Cambiar cama y retirar estiércol al estercolero. Revisar desagües.", comments: [], date: today },
  { id: "t3", title: "Check sick cow", priority: "high", farmName: "Granja Sur", workerId: "w2", status: "in_progress", managerDetails: "Vaca número 12 con posible cojera. Revisar pata y estado general. Si sigue mal, avisar al veterinario.", comments: [], date: addDays(today, 1) },
  { id: "t4", title: "Prepare animal feed", priority: "medium", farmName: "Granja Sur", workerId: "w2", status: "completed", managerDetails: "Preparar mezcla según ficha del almacén. Cantidad para dos días. Guardar sobrante en lugar fresco.", comments: [], date: addDays(today, -1) },
  { id: "t5", title: "Fix fence", priority: "high", farmName: "Granja Este", workerId: "w3", status: "completed", managerDetails: "Tramo norte, postes 5 a 8. Llevar alambre y grapas. Cuidado con el ganado al entrar.", comments: [], date: addDays(today, -2) },
  { id: "t6", title: "Vaccinate calves", priority: "medium", farmName: "Granja Este", workerId: "w3", status: "completed", managerDetails: "Vacuna en nevera. Aplicar según calendario a los terneros marcados. Anotar en la hoja de control.", comments: [], date: today },
  { id: "t7", title: "Revisar bebederos", priority: "low", farmName: "Granja Norte", workerId: "w1", status: "in_progress", managerDetails: "Comprobar caudal y limpieza en todos los corrales.", comments: [], date: addDays(today, 1) },
  { id: "t8", title: "Pesar terneros", priority: "medium", farmName: "Granja Sur", workerId: "w2", status: "completed", managerDetails: "Anotar pesos en la hoja de control. Señalar los que bajen de peso.", comments: [], date: addDays(today, -1) },
  { id: "t9", title: "Reponer paja", priority: "low", farmName: "Granja Este", workerId: "w4", status: "ready", managerDetails: "Llevar fardos al almacén y repartir en boxes vacíos.", comments: [], date: addDays(today, 2) },
  // Tareas adicionales para poblar el dashboard (especialmente el día de hoy)
  { id: "t10", title: "Revisar almacén de pienso", priority: "low", farmName: "Granja Norte", workerId: "w1", status: "ready", managerDetails: "Comprobar existencias de pienso y anotar necesidades de pedido.", comments: [], date: today },
  { id: "t11", title: "Control de nacimientos", priority: "high", farmName: "Granja Sur", workerId: "w2", status: "in_progress", managerDetails: "Revisar parideras y anotar nuevos nacimientos en el sistema.", comments: [], date: today },
  { id: "t12", title: "Limpieza zona de carga", priority: "medium", farmName: "Granja Este", workerId: "w3", status: "ready", managerDetails: "Dejar libre de obstáculos la zona de carga de camiones.", comments: [], date: today },
  { id: "t13", title: "Revisión eléctrica", priority: "high", farmName: "Granja Norte", workerId: "w4", status: "in_progress", managerDetails: "Comprobar cuadro eléctrico y enchufes de la nave principal.", comments: [], date: today },
  { id: "t14", title: "Ordenar herramientas", priority: "low", farmName: "Granja Sur", workerId: "w1", status: "completed", managerDetails: "Colocar herramientas en el panel y etiquetar las más usadas.", comments: [], date: today },
  { id: "t15", title: "Control de ventilación", priority: "medium", farmName: "Granja Este", workerId: "w2", status: "ready", managerDetails: "Revisar ventiladores y abrir/cerrar ventanas según temperatura.", comments: [], date: today },
  { id: "t16", title: "Revisión bebederos nave 2", priority: "low", farmName: "Granja Norte", workerId: "w3", status: "in_progress", managerDetails: "Verificar presión de agua y posibles fugas en nave 2.", comments: [], date: today },
  { id: "t17", title: "Formación en bioseguridad", priority: "medium", farmName: "Granja Sur", workerId: "w4", status: "completed", managerDetails: "Pequeña charla con el equipo sobre protocolos de entrada y salida.", comments: [], date: today },
  { id: "t18", title: "Comprobar cerraduras", priority: "low", farmName: "Granja Este", workerId: "w1", status: "ready", managerDetails: "Revisar que todas las puertas exteriores cierren correctamente.", comments: [], date: today },
];

/** Programación de tareas periódicas (se generan en los días indicados). */
export const MOCK_RECURRING_SCHEDULES: RecurringTaskSchedule[] = [];

/** Plantillas de tipos de incidente preconfigurados. */
export interface IncidentTemplate {
  id: string;
  caseType: string;
  defaultSummary: string;
}

export const INCIDENT_TEMPLATES: IncidentTemplate[] = [
  { id: "it1", caseType: "Cojera", defaultSummary: "Animal con dificultad al andar. Revisar pata y estado general." },
  { id: "it2", caseType: "Infección respiratoria", defaultSummary: "Tos o mucosidad. Aislar y avisar al veterinario." },
  { id: "it3", caseType: "Herida", defaultSummary: "Herida visible. Limpiar y desinfectar; valorar puntos." },
  { id: "it4", caseType: "Desnutrición / no come", defaultSummary: "Animal sin apetito. Controlar peso y temperatura." },
  { id: "it5", caseType: "Control veterinario rutinario", defaultSummary: "Revisión programada. Vacunas, desparasitación o análisis." },
  { id: "it6", caseType: "Parto / atención al nacimiento", defaultSummary: "Seguimiento de parto o cría recién nacida." },
  { id: "it7", caseType: "Problema digestivo", defaultSummary: "Diarrea, cólico o hinchazón. Dieta y observación." },
];

/** Casos/incidentes por animal. Fechas relativas a hoy para que aparezcan en estadísticas (día/semana). */
export const MOCK_ANIMAL_CASES: AnimalCase[] = [
  { id: "c1", animalId: "a1", caseType: "Cojera", status: "reported", summary: "Animal con dificultad al andar.", severity: "medium", date: today },
  { id: "c2", animalId: "a3", caseType: "Infección respiratoria", status: "in_treatment", summary: "Tos y mucosidad. Aislado.", severity: "high", date: today },
  { id: "c3", animalId: "a2", caseType: "Control veterinario rutinario", status: "resolved", summary: "Revisión y vacunas.", severity: "low", date: addDays(today, -2) },
  { id: "c4", animalId: "a5", caseType: "Herida", status: "in_treatment", summary: "Herida en pata. Limpieza y desinfección.", severity: "medium", date: addDays(today, -1) },
];
