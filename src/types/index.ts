export type TaskPriority = "high" | "medium" | "low";

/** Lista para empezar → En desarrollo → Finalizada */
export type TaskStatus = "ready" | "in_progress" | "completed";

export interface Task {
  id: string;
  title: string;
  priority: TaskPriority;
  farmName: string;
  workerId: string;
  status: TaskStatus;
  /** Detalles escritos por el manager */
  managerDetails: string;
  comments: string[];
  /** Fecha asignada (YYYY-MM-DD). Si no existe, se considera “hoy”. */
  date?: string;
}

/** Días de la semana: 1 = Lunes, 7 = Domingo */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Tarea periódica: se genera automáticamente en los días indicados */
export interface RecurringTaskSchedule {
  id: string;
  title: string;
  managerDetails: string;
  workerId: string;
  farmName: string;
  priority: TaskPriority;
  /** Días en que se crea la tarea (1=Lun ... 7=Dom) */
  daysOfWeek: DayOfWeek[];
}

export interface Role {
  id: string;
  name: string;
}

// Roles de usuario (deben coincidir con el enum del backend)
export const USER_ROLE = {
  SuperAdmin: "SuperAdmin",
  Worker: "Worker",
  Manager: "Manager",
  Admin: "Admin",
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleId: string;
}

export interface Worker {
  id: string;
  name: string;
}

export interface Farm {
  id: string;
  name: string;
  location: string;
}

export interface Species {
  id: string;
  name: string;
}

export type AnimalSex = "male" | "female";

export interface Animal {
  id: string;
  name: string;
  farmId: string;
  speciesId: string;
  sex: AnimalSex;
  birthDate: string;
  identification: string;
}

/** Estado del caso/incidente (el animal no se recupera en un día) */
export type IncidentStatus = "reported" | "in_treatment" | "resolved";

/** Caso/incidente vinculado a un animal (según modelo AnimalCases) */
export interface AnimalCase {
  id: string;
  animalId: string;
  caseType: string;
  status: IncidentStatus;
  summary: string;
  severity: "critical" | "high" | "medium" | "low";
  date: string;
}

/** @deprecated Usar AnimalCase. Mantenido por compatibilidad. */
export interface AnimalIncident {
  id: string;
  animal: string;
  problem: string;
  severity: "critical" | "high" | "medium" | "low";
  date: string;
}
