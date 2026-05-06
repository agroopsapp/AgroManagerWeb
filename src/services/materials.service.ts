/**
 * Punto de entrada dedicado a `/api/Materials`.
 * La implementación vive en `work-services.service.ts` para evitar duplicar helpers HTTP.
 */
export {
  materialsApi,
  buildMaterialCreatePayload,
  buildMaterialUpdatePayload,
  type MaterialCreateBody,
  type MaterialUpdateBody,
} from "./work-services.service";
