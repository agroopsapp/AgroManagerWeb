/** DTO alineado con GET/POST `/api/Materials`. */
export type Material = {
  id: string;
  companyId: string;
  name: string;
  /**
   * Contrato original del feature (`/dashboard/materials`).
   * Se mantiene por compatibilidad con pantallas existentes.
   */
  unitOfMeasure: string | null;
  /**
   * Campos adicionales usados por `/dashboard/materiales`.
   * Se normalizan a `""` si el backend no los devuelve.
   */
  description: string;
  unit: string;
  code: string;
  createdAt: string;
};

export type MaterialCreateBody = {
  companyId: string;
  name: string;
  /** Opcional: omitir o `null` si no aplica. */
  unitOfMeasure?: string | null;
  // Campos opcionales adicionales (si el backend los soporta)
  description?: string | null;
  unit?: string | null;
  code?: string | null;
};

export type MaterialUpdateBody = {
  name: string;
  unitOfMeasure?: string | null;
  // Campos opcionales adicionales (si el backend los soporta)
  description?: string | null;
  unit?: string | null;
  code?: string | null;
};
