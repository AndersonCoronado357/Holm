// Utilidades pequenas sin dependencias.

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// Fecha local en formato YYYY-MM-DD (sin desfase de zona horaria).
export function isoDate(d: Date = new Date()): string {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function weekdayOf(iso: string): number {
  return new Date(iso + 'T00:00:00').getDay();
}

export const WEEKDAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const WEEKDAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
