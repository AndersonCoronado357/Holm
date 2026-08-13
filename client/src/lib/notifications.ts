// Avisos del navegador para los eventos del calendario (client-side, sin push).
// Modelo tomado del de Hibi:
//  · MAESTRO = interruptor global (permiso + on/off) → isEnabled/setEnabled.
//  · Se programa un aviso por cada evento de HOY cuya hora aún no pasó.
//  · Deduplicación por día: un evento no avisa dos veces aunque recargues.
import type { CalendarEvent } from '../api/types';

const ENABLED_KEY = 'holm.notif.on';
const MINUTES_KEY = 'holm.notif.minutes';

function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function permission(): NotificationPermission {
  return supported() ? Notification.permission : 'denied';
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!supported()) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function isEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setEnabled(on: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? 'true' : 'false');
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
  if (!on) clearTimers();
}

// Cuántos minutos antes avisar (0 = a la hora exacta).
export function leadMinutes(): number {
  try {
    const n = Number(localStorage.getItem(MINUTES_KEY));
    return Number.isFinite(n) && n >= 0 ? n : 10;
  } catch {
    return 10;
  }
}

export function setLeadMinutes(n: number) {
  try {
    localStorage.setItem(MINUTES_KEY, String(Math.max(0, n)));
  } catch {
    /* ignore */
  }
}

const canNotify = () => supported() && Notification.permission === 'granted' && isEnabled();

// En móvil `new Notification(...)` está prohibido desde la página y hay que ir
// por el Service Worker; en escritorio funcionan los dos. Probamos primero el SW
// (con tope de espera) y si no hay, caemos al constructor.
async function show(title: string, options?: NotificationOptions): Promise<boolean> {
  if (!supported()) return false;
  const opts: NotificationOptions = { icon: '/holm.svg?v=4', badge: '/holm.svg?v=4', tag: 'holm', ...options };
  if ('serviceWorker' in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      if (reg) {
        await reg.showNotification(title, opts);
        return true;
      }
    } catch {
      /* cae al constructor */
    }
  }
  try {
    new Notification(title, opts);
    return true;
  } catch {
    return false;
  }
}

const NOTIFIED_KEY = () => 'holm.notified.' + localDay();

function notifiedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY()) || '[]') as string[];
  } catch {
    return [];
  }
}

function markNotified(id: string) {
  try {
    const arr = notifiedIds();
    if (!arr.includes(id)) {
      arr.push(id);
      localStorage.setItem(NOTIFIED_KEY(), JSON.stringify(arr));
    }
  } catch {
    /* ignore */
  }
}

let timers: ReturnType<typeof setTimeout>[] = [];

export function clearTimers() {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
}

// Aviso inmediato (para el botón "probar").
export function notifyNow(title: string, body?: string): Promise<boolean> {
  if (!supported() || Notification.permission !== 'granted') return Promise.resolve(false);
  return show(title, body ? { body } : undefined);
}

function fire(e: CalendarEvent) {
  if (!canNotify() || notifiedIds().includes(e.id)) return;
  const cuando = e.startTime ? `A las ${e.startTime}` : 'Hoy';
  show(e.title, { body: cuando }).then((ok) => ok && markNotified(e.id));
}

// Reprograma los avisos de los eventos de HOY cuya hora aún no llegó.
export function scheduleToday(events: CalendarEvent[]) {
  clearTimers();
  if (!canNotify()) return;
  const today = localDay();
  const now = Date.now();
  const lead = leadMinutes() * 60_000;
  for (const e of events) {
    if (!e || e.eventDate !== today || !e.startTime) continue;
    if (notifiedIds().includes(e.id)) continue;
    const [h, m] = e.startTime.split(':').map(Number);
    if (Number.isNaN(h)) continue;
    const at = new Date();
    at.setHours(h, m || 0, 0, 0);
    const delay = at.getTime() - lead - now;
    if (delay <= 0) continue; // ya pasó: no molestamos en retrospectiva
    timers.push(setTimeout(() => fire(e), Math.min(delay, 2_147_483_000)));
  }
}
