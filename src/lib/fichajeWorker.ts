/**
 * Identificador numérico de trabajador para el fichaje personal (demo).
 * Con API real vendrá del perfil del usuario.
 */
const DEMO_EMAIL_TO_WORKER: Record<string, number> = {
  "juan.perez@empresa.demo": 1,
  "pedro.garcia@empresa.demo": 2,
  "luis.lopez@empresa.demo": 3,
  "ana.martinez@empresa.demo": 4,
};

export function workerIdForLoggedUser(
  user: { id: string; email: string } | null | undefined
): number {
  if (!user?.email?.trim()) return 1;
  const k = user.email.trim().toLowerCase();
  const mapped = DEMO_EMAIL_TO_WORKER[k];
  if (mapped != null) return mapped;
  let h = 0;
  for (let i = 0; i < user.id.length; i++) {
    h = (Math.imul(31, h) + user.id.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 4) + 1;
}
