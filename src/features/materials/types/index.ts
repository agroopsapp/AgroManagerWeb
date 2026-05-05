/** DTO alineado con GET/POST `/api/Materials`. */
export type Material = {
  id: string;
  companyId: string;
  name: string;
  unitOfMeasure: string | null;
  createdAt: string;
};

export type MaterialCreateBody = {
  companyId: string;
  name: string;
  /** Opcional: omitir o `null` si no aplica. */
  unitOfMeasure?: string | null;
};

export type MaterialUpdateBody = {
  name: string;
  unitOfMeasure?: string | null;
};
