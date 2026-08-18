// Avisos del navegador para los eventos del calendario (client-side, sin push).
// Modelo tomado del de Hibi:
//  · MAESTRO = interruptor global (permiso del navegador + on/off de la cuenta).
//  · Se programa un aviso por cada evento de HOY cuya hora aún no pasó.
//  · Un evento no avisa dos veces, ni aunque recargues ni aunque tengas la app
//    abierta en dos sitios: el «ya avisado» se reclama al servidor.
//
// Este módulo no guarda nada: el interruptor y los minutos de antelación son
// preferencias de la cuenta y viven en `state/settings`.
import type { CalendarEvent } from '../api/types';

export interface OpcionesAviso {
  /** Interruptor de la cuenta. */
  activados: boolean;
  /** Minutos de antelación (0 = a la hora exacta). */
  minutosAntes: number;
  /**
   * Reclama el aviso de un evento. Devuelve `true` sólo a quien llega primero,
   * de modo que el móvil y el escritorio no avisen los dos de lo mismo.
   */
  reclamar: (id: string, dia: string) => Promise<boolean>;
}

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

// En móvil `new Notification(...)` está prohibido desde la página y hay que ir
// por el Service Worker; en escritorio funcionan los dos. Probamos primero el SW
// (con tope de espera) y si no hay, caemos al constructor.
async function show(title: string, options?: NotificationOptions): Promise<boolean> {
  if (!supported()) return false;
  // PNG y no SVG: Android descarta en silencio los avisos cuyo icono no puede
  // rasterizar.
  const opts: NotificationOptions = { icon: '/icon-192.png', badge: '/icon-192.png', tag: 'holm', ...options };
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

async function fire(e: CalendarEvent, op: OpcionesAviso) {
  if (!op.activados || permission() !== 'granted') return;
  // Se reclama ANTES de mostrar: si esperásemos a después, dos pantallas
  // abiertas mostrarían las dos el aviso antes de que ninguna lo marcara.
  let primero = true;
  try {
    primero = await op.reclamar(e.id, localDay());
  } catch {
    // Sin red no se puede saber si otro sitio ya avisó. Preferimos un aviso
    // repetido a quedarnos callados: el recordatorio es el objetivo.
    primero = true;
  }
  if (!primero) return;
  await show(e.title, { body: e.startTime ? `A las ${e.startTime}` : 'Hoy' });
}

// Reprograma los avisos de los eventos de HOY cuya hora aún no llegó.
export function scheduleToday(events: CalendarEvent[], op: OpcionesAviso) {
  clearTimers();
  if (!op.activados || permission() !== 'granted') return;
  const today = localDay();
  const now = Date.now();
  const lead = op.minutosAntes * 60_000;
  for (const e of events) {
    if (!e || e.eventDate !== today || !e.startTime) continue;
    const [h, m] = e.startTime.split(':').map(Number);
    if (Number.isNaN(h)) continue;
    const at = new Date();
    at.setHours(h, m || 0, 0, 0);
    const delay = at.getTime() - lead - now;
    if (delay <= 0) continue; // ya pasó: no molestamos en retrospectiva
    timers.push(setTimeout(() => fire(e, op), Math.min(delay, 2_147_483_000)));
  }
}
