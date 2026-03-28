// Utilidades puras de fecha y hora del proyecto.
// No dependen de tipos de feature ni de estado React.
// Usadas por features/time-tracking, mocks, y cualquier otra feature que necesite manipulación de fechas.

export function yesterdayISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function localCalendarISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localCalendarISO(d);
}

/** Día de hoy en calendario local del dispositivo (evita desfase UTC vs España). */
export function localTodayISO(): string {
  return localCalendarISO(new Date());
}

/** Sábado o domingo (calendario local) para una fecha YYYY-MM-DD. */
export function workDateIsWeekend(workDate: string): boolean {
  const [y, m, d] = workDate.split("-").map(Number);
  if (!y || !m || !d) return false;
  const day = new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
  return day === 0 || day === 6;
}

export function workDateWithinLastNDays(workDate: string, n: number, ref: Date = new Date()): boolean {
  const end = localCalendarISO(ref);
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - (n - 1), 12, 0, 0, 0);
  const startStr = localCalendarISO(start);
  return workDate >= startStr && workDate <= end;
}

export function utcToLocalHHMM(utcIso: string): string {
  const d = new Date(utcIso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** workDate (YYYY-MM-DD) + HH:mm local → ISO UTC */
export function dateTimeLocalToUtcIso(workDate: string, timeHHMM: string): string {
  const [Y, M, D] = workDate.split("-").map(Number);
  const [h, m] = timeHHMM.split(":").map(Number);
  return new Date(Y, M - 1, D, h, m, 0, 0).toISOString();
}

/** Hora de fin el mismo día laborable; si es ≤ entrada, se asume día siguiente. */
export function checkoutLocalIsoAfterCheckin(
  workDate: string,
  checkInUtcIso: string,
  endTimeHHMM: string
): string {
  const [Y, M, D] = workDate.split("-").map(Number);
  const [eh, em] = endTimeHHMM.split(":").map(Number);
  let end = new Date(Y, M - 1, D, eh, em, 0, 0);
  const start = new Date(checkInUtcIso);
  if (end.getTime() <= start.getTime()) {
    end = new Date(Y, M - 1, D + 1, eh, em, 0, 0);
  }
  return end.toISOString();
}

/** Minutos entre hora de entrada y salida (mismo criterio que al guardar la jornada). */
export function minutesGrossWorkDay(workDate: string, startHM: string, endHM: string): number {
  const inIso = dateTimeLocalToUtcIso(workDate, startHM);
  const outIso = checkoutLocalIsoAfterCheckin(workDate, inIso, endHM);
  return Math.round((new Date(outIso).getTime() - new Date(inIso).getTime()) / 60000);
}

export function parseForgotBreakCustom(raw: string): number {
  const s = raw.trim().toLowerCase();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  let total = 0;
  const hourMatch = s.match(/(\d+)\s*h/);
  if (hourMatch) total += parseInt(hourMatch[1], 10) * 60;
  const minMatch = s.match(/(\d+)\s*m/);
  if (minMatch) total += parseInt(minMatch[1], 10);
  if (total === 0) {
    const num = parseInt(s.replace(/[^\d]/g, ""), 10);
    if (!Number.isNaN(num)) total = num;
  }
  return Number.isNaN(total) || total < 0 ? 0 : total;
}

export function parseHHMM(hm: string): { h: number; m: number } {
  const parts = hm.split(":");
  const h = Math.min(23, Math.max(0, parseInt(parts[0] ?? "0", 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(parts[1] ?? "0", 10) || 0));
  return { h, m };
}

export function toHHMM(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatMinutesShort(totalMinutes: number | null): string {
  if (totalMinutes === null || totalMinutes <= 0) return "0 min";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function formatDateES(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTimeLocal(utcIso: string | null): string {
  if (!utcIso) return "—";
  const d = new Date(utcIso);
  return d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTiempoAnterior(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—";
  return formatTimeLocal(iso);
}

/** Fecha y hora local de la última modificación del registro (API: updatedAt). */
export function formatFechaModificacionUtc(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function diffDurationMinutes(startUtc: string, endUtc: string | null): number | null {
  if (!endUtc) return null;
  const start = new Date(startUtc).getTime();
  const end = new Date(endUtc).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.round((end - start) / (1000 * 60));
}

/** Mes actual en calendario local (YYYY-MM). */
export function currentMonthLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentYearLocal(): string {
  return String(new Date().getFullYear());
}

export function parseMonthYm(ym: string): { y: number; m: number } | null {
  const parts = ym.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  if (!y || !m || m < 1 || m > 12) return null;
  return { y, m };
}

export function quarterOptions(nYearsBack = 3): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const y0 = new Date().getFullYear();
  for (let y = y0; y >= y0 - nYearsBack; y--) {
    for (let q = 4; q >= 1; q--) {
      out.push({ value: `${y}-Q${q}`, label: `Trimestre ${q} · ${y}` });
    }
  }
  return out;
}

export function yearOptions(nYearsBack = 6): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const y0 = new Date().getFullYear();
  for (let y = y0; y >= y0 - nYearsBack; y--) out.push({ value: String(y), label: String(y) });
  return out;
}

export function quarterToRange(q: string): { start: string; end: string } | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(q);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const qn = parseInt(m[2], 10);
  const startMonth = (qn - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const start = `${y}-${String(startMonth).padStart(2, "0")}-01`;
  const endD = new Date(y, endMonth, 0).getDate();
  const end = `${y}-${String(endMonth).padStart(2, "0")}-${String(endD).padStart(2, "0")}`;
  return { start, end };
}

export function yearToRange(yStr: string): { start: string; end: string } | null {
  const y = parseInt(yStr, 10);
  if (!Number.isFinite(y) || y < 1970) return null;
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

export function clampRangeToToday(range: { start: string; end: string }): { start: string; end: string } | null {
  const today = localTodayISO();
  if (range.start > today) return null;
  return { start: range.start, end: range.end > today ? today : range.end };
}

export function listDaysInRange(start: string, end: string): { workDate: string; isWeekend: boolean }[] {
  if (start > end) return [];
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  if (!ys || !ms || !ds || !ye || !me || !de) return [];
  const out: { workDate: string; isWeekend: boolean }[] = [];
  const d0 = new Date(ys, ms - 1, ds, 12, 0, 0, 0);
  const dn = new Date(ye, me - 1, de, 12, 0, 0, 0);
  for (let t = d0.getTime(); t <= dn.getTime(); ) {
    const d = new Date(t);
    const wd = localCalendarISO(d);
    out.push({ workDate: wd, isWeekend: workDateIsWeekend(wd) });
    d.setDate(d.getDate() + 1);
    t = d.getTime();
  }
  return out;
}

/** Últimos `n` meses para el desplegable (valor YYYY-MM, etiqueta en español). */
export function monthSelectOptions(n = 12): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const raw = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    out.push({ value, label });
  }
  return out;
}

export function weekdaysInCalendarMonth(yyyyMm: string): number {
  const parts = yyyyMm.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  if (!y || !m || m < 1 || m > 12) return 0;
  const lastDay = new Date(y, m, 0).getDate();
  let n = 0;
  for (let d = 1; d <= lastDay; d++) {
    const day = new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
    if (day !== 0 && day !== 6) n++;
  }
  return n;
}

export function minutesToClockParts(totalMinutes: number): { h: number; m: number } {
  const capped = Math.min(8 * 60 + 55, Math.max(0, totalMinutes));
  const h = Math.min(8, Math.floor(capped / 60));
  let m = capped % 60;
  m = Math.round(m / 5) * 5;
  if (m >= 60) return { h: Math.min(8, h + 1), m: 0 };
  return { h, m };
}

/** Último viernes ya pasado (si hoy es viernes, el de hace 7 días). Siempre laborable. */
export function dateOfLastFriday(from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12, 0, 0, 0);
  const day = d.getDay();
  let daysBack: number;
  if (day === 5) daysBack = 7;
  else if (day === 6) daysBack = 1;
  else if (day === 0) daysBack = 2;
  else daysBack = day + 2;
  d.setDate(d.getDate() - daysBack);
  return d;
}

/** Último lunes ya pasado (si hoy es lunes, el de hace 7 días). */
export function dateOfLastMonday(from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12, 0, 0, 0);
  const day = d.getDay();
  let daysBack: number;
  if (day === 1) daysBack = 7;
  else if (day === 0) daysBack = 6;
  else daysBack = day - 1;
  d.setDate(d.getDate() - daysBack);
  return d;
}
