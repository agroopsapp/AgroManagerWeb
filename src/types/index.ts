export type TaskPriority = "high" | "medium" | "low";

/** Familia de tarea para clasificación (veterinaria, campo, alimentación, limpieza). */
export type TaskFamily = "veterinaria" | "campo" | "alimentacion" | "limpieza";

/** Lista para empezar → En desarrollo → Finalizada */
export type TaskStatus = "ready" | "in_progress" | "completed";

export interface Task {
  id: string;
  /** Número de tarea visible (0001, 0002, ...). Opcional en datos legacy. */
  taskNumber?: number;
  title: string;
  priority: TaskPriority;
  farmName: string;
  workerId: string;
  status: TaskStatus;
  /** Detalles escritos por el manager */
  managerDetails: string;
  comments: string[];
  /** Familia de tarea (veterinaria, campo, alimentación, limpieza). Opcional en datos legacy. */
  family?: TaskFamily;
  /** Fecha de creación (YYYY-MM-DD). Opcional mientras migramos datos antiguos. */
  createdAt?: string;
  /** Fecha asignada (YYYY-MM-DD). Si no existe, se considera “hoy”. */
  date?: string;
}

/** Formatea el número de tarea como ID visible (0001, 0002, ...). */
export function formatTaskId(taskNumber: number): string {
  return String(taskNumber).padStart(4, "0");
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
  roleName?: string;
  companyId?: string;
  companyName?: string;
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

/** Área o zona operativa vinculada a una empresa (parcela, nave, etc.). */
export interface CompanyArea {
  id: string;
  name: string;
  observations: string;
}

/** Área en el cuerpo de POST `/api/ClientCompanies/with-areas`. El backend exige `id: null` en alta. */
export interface ClientCompanyAreaInput {
  id: null;
  name: string;
  observations: string | null;
}

/** Cuerpo de POST `/api/ClientCompanies/with-areas` (`companyId` = empresa del tenant). */
export interface ClientCompanyWithAreasCreateBody {
  companyId: string;
  name: string;
  taxId: string;
  address: string;
  areas: ClientCompanyAreaInput[];
}

/** Fila devuelta por GET `/api/Companies` (datos de la empresa en el tenant). */
export interface CompanyApiRow {
  id: string;
  name: string;
  fiscalName: string;
  taxId: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  logoUrl: string;
  createdAt: string;
}

/** Cuerpo de PUT `/api/Companies/{id}`. */
export interface CompanyApiPutBody {
  name: string;
  fiscalName: string;
  taxId: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  logoUrl: string;
}

/** Empresa / sociedad (contrato típico laboral; CRUD vía `/api/CustomerCompany`). */
export interface Company {
  id: string;
  /**
   * Empresa matriz / tenant (`companyId` en ClientCompany cuando difiere de `id`).
   * GET /api/Users/company/{id} y `User.companyId` suelen usar este GUID, no el id de fila cliente.
   */
  organizationCompanyId?: string | null;
  name: string;
  /** CIF, NIF u otro identificador fiscal (opcional). */
  taxId: string;
  /** Dirección social u oficina (opcional). */
  address: string;
  /** URL del logo (misma web `/ruta.png` o absoluta) para informes/PDF. */
  logoUrl?: string;
  /** Zonas que puede tener la empresa (mock / API). */
  areas: CompanyArea[];
}

/** Servicio que una empresa puede ofrecer (campo / maquinaria). */
export interface WorkService {
  id: string;
  name: string;
  description: string;
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
  /** Número visible de incidencia (#0001, #0002, ...). Opcional en datos legacy. */
  incidentNumber?: number;
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
