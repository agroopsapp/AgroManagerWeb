/**
 * Servicios API por dominio.
 * Importar desde aquí o desde el archivo concreto:
 *   import { tasksApi, farmsApi } from "@/services";
 *   import { tasksApi } from "@/services/tasks.service";
 */

export { authApi } from "./auth.service";
export { tasksApi } from "./tasks.service";
export { farmsApi } from "./farms.service";
export { usersApi } from "./users.service";
export { rolesApi } from "./roles.service";
export { animalsApi } from "./animals.service";
export { incidentsApi } from "./incidents.service";
export {
  buildMyCompanyPutBody,
  companiesApi,
  companyLogoUrlForPut,
  getCompaniesFromApi,
  postClientCompanyWithAreas,
  putCompanyOnApi,
} from "./companies.service";
