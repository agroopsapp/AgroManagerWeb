/** `userId` de aplicación (GUID). Excluye claves sintéticas `legacy:*`. */
export function isApplicationUserGuid(raw: string | null | undefined): boolean {
  if (raw == null || typeof raw !== "string") return false;
  const s = raw.trim();
  if (!s || s.startsWith("legacy:")) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}
