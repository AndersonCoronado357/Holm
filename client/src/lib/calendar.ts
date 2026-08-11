// Utilidades de fecha para el calendario. Todo se maneja con fechas locales y
// claves 'yyyy-MM-dd' para no pelear con zonas horarias.

export const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// La semana empieza en lunes.
export const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const DAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const DAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function key(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromKey(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function addMonths(d: Date, n: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth() + n, 1);
  // conserva el día si cabe en el mes destino
  const last = new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate();
  c.setDate(Math.min(d.getDate(), last));
  return c;
}

// Lunes de la semana de `d`.
export function startOfWeek(d: Date): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (c.getDay() + 6) % 7; // 0 = lunes
  return addDays(c, -day);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isToday(d: Date): boolean {
  return sameDay(d, new Date());
}

// 42 celdas (6 semanas) para que el alto de la rejilla no salte entre meses.
export function monthGrid(cursor: Date): Date[] {
  const gs = startOfWeek(startOfMonth(cursor));
  return Array.from({ length: 42 }, (_, i) => addDays(gs, i));
}

export function weekDays(cursor: Date): Date[] {
  const s = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

// 'HH:MM' → minutos desde medianoche.
export function parseHm(t?: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

// Mayúscula solo en la primera letra (no en cada palabra, para no escribir
// cosas como "Miércoles 12 De Agosto").
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthYearLabel(d: Date): string {
  return cap(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`);
}

export function weekRangeLabel(d: Date): string {
  const s = startOfWeek(d);
  const e = addDays(s, 6);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`;
  }
  return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`;
}

export function dayLabel(d: Date): string {
  return cap(`${DAY_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`);
}
