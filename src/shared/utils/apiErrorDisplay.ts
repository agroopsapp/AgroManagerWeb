/**
 * Texto de error legible para UI (sin stack traces ni ruido típico de APIs .NET).
 * Usado por apiClient, login con fetch directo y boundaries de Next.
 */

function textLooksLikeServerStackTrace(s: string): boolean {
  return (
    /\r?\n\s+at\s+/.test(s) ||
    /\r?\n--->\s*/.test(s) ||
    /\r?\nSystem\.\w+Exception/.test(s) ||
    /\r?\nMicrosoft\.AspNetCore\./.test(s)
  );
}

/** Recorta stack / excepciones anidadas; puede devolver cadena vacía. */
export function sanitizeApiErrorText(raw: string): string {
  let t = raw.trim();
  if (!t) return t;

  if (/^\s*at\s+/m.test(t) || /^System\.\w+Exception\b/m.test(t)) {
    return "";
  }

  const stackIdx = /\r?\n\s+at\s+/m.exec(t);
  if (stackIdx && stackIdx.index > 0) t = t.slice(0, stackIdx.index).trim();

  const innerIdx = /\r?\n--->\s*/m.exec(t);
  if (innerIdx && innerIdx.index > 0) t = t.slice(0, innerIdx.index).trim();

  const sysExIdx = /\r?\nSystem\.\w+Exception/m.exec(t);
  if (sysExIdx && sysExIdx.index > 0) t = t.slice(0, sysExIdx.index).trim();

  if (t.length > 600) return `${t.slice(0, 600)}…`;
  return t;
}

function pickUserMessage(raw: string, status: number, statusText: string): string {
  return sanitizeApiErrorText(raw) || `Error ${status}: ${statusText}`;
}

/** Nombres de propiedad ASP.NET → etiqueta en español para mensajes de validación. */
const VALIDATION_KEY_LABEL_ES: Record<string, string> = {
  telefono: "Teléfono",
  Telefono: "Teléfono",
  phone: "Teléfono",
  Phone: "Teléfono",
  email: "Correo",
  Email: "Correo",
  name: "Nombre",
  Name: "Nombre",
  password: "Contraseña",
  Password: "Contraseña",
  roleid: "Rol",
  roleId: "Rol",
  RoleId: "Rol",
  companyid: "Empresa",
  companyId: "Empresa",
};

function humanizeValidationKey(key: string): string {
  const k = key.trim();
  const lower = k.toLowerCase();
  if (VALIDATION_KEY_LABEL_ES[k]) return VALIDATION_KEY_LABEL_ES[k];
  if (VALIDATION_KEY_LABEL_ES[lower]) return VALIDATION_KEY_LABEL_ES[lower];
  return k.replace(/^\$\.?/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * Construye un texto a partir de `errors` / `Errors` (ValidationProblemDetails de ASP.NET).
 * Debe resolverse antes que `message`, porque suele venir el genérico
 * «One or more validation errors occurred.» y el detalle útil solo en `errors`.
 */
function messageFromValidationErrorsRecord(errors: Record<string, unknown>): string {
  const lines = Object.entries(errors).flatMap(([key, val]) => {
    const label = humanizeValidationKey(key);
    if (Array.isArray(val)) {
      return val.filter((x) => x != null && String(x).trim() !== "").map((x) => `${label}: ${String(x).trim()}`);
    }
    if (val != null && String(val).trim() !== "") return [`${label}: ${String(val).trim()}`];
    return [];
  });
  return lines.join(" · ");
}

/**
 * ASP.NET ProblemDetails / validación modelo / cuerpo string plano.
 */
export function messageFromApiErrorJsonBody(
  body: unknown,
  status: number,
  statusText: string,
): string {
  if (body == null || body === "") return `Error ${status}: ${statusText}`;
  if (typeof body === "string") {
    const t = body.trim();
    return pickUserMessage(t, status, statusText);
  }
  if (typeof body !== "object") return `Error ${status}: ${statusText}`;

  const o = body as Record<string, unknown>;

  const errors = o.errors ?? o.Errors;
  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    const fromErrors = messageFromValidationErrorsRecord(errors as Record<string, unknown>);
    if (fromErrors) return pickUserMessage(fromErrors, status, statusText);
  }

  const msg = o.message ?? o.Message;
  const title = o.title ?? o.Title;
  const detail = o.detail ?? o.Detail;
  const msgStr = typeof msg === "string" ? msg.trim() : "";
  const titleStr = typeof title === "string" ? title.trim() : "";
  const detailStr = typeof detail === "string" ? detail.trim() : "";

  if (msgStr) {
    if (detailStr) {
      if (textLooksLikeServerStackTrace(detailStr)) {
        return pickUserMessage(msgStr, status, statusText);
      }
      return pickUserMessage(`${msgStr}: ${detailStr}`, status, statusText);
    }
    return pickUserMessage(msgStr, status, statusText);
  }
  if (detailStr) return pickUserMessage(detailStr, status, statusText);
  if (titleStr) return pickUserMessage(titleStr, status, statusText);

  return `Error ${status}: ${statusText}`;
}

type ApiLikeError = { name: string; message: string; status: number; body?: unknown };

function isApiLikeError(e: unknown): e is ApiLikeError {
  if (typeof e !== "object" || e === null) return false;
  const o = e as { name?: unknown; message?: unknown; status?: unknown };
  return o.name === "ApiError" && typeof o.message === "string" && typeof o.status === "number";
}

/** Mensaje seguro para mostrar ante `catch (unknown)` sin asumir ApiError. */
export function userVisibleMessageFromUnknown(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return sanitizeApiErrorText(error) || fallback;
  }
  if (isApiLikeError(error)) {
    const fromBody = messageFromApiErrorJsonBody(error.body, error.status, "");
    if (fromBody && !/^Error 0:\s*$/.test(fromBody)) return fromBody;
    return sanitizeApiErrorText(error.message) || fromBody || fallback;
  }
  if (error instanceof Error) {
    return sanitizeApiErrorText(error.message) || fallback;
  }
  return fallback;
}
