/**
 * Contratos de superadministración (empresas padre y registro de errores).
 */

/** Empresa padre — alineado con CompanyDto del backend. */
export interface SuperadminParentCompanyDto {
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

/** Alta de empresa padre — obligatorio en negocio: `name`. */
export type SuperadminCreateCompanyBody = {
  name: string;
  fiscalName?: string;
  taxId?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
};

/** Actualización de empresa padre. */
export type SuperadminUpdateCompanyBody = {
  name: string;
  fiscalName?: string;
  taxId?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
};

export interface ApiErrorLogRecordDto {
  id: string;
  fechaHoraUtc: string;
  usuarioId: string | null;
  companyId: string | null;
  rolNombre: string | null;
  codigoHttp: number;
  metodoHttp: string;
  rutaEndpoint: string;
  traceId: string | null;
  tipoExcepcion: string | null;
  mensajeError: string | null;
}

export interface ApiErrorLogPagedResultDto {
  items: ApiErrorLogRecordDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}
