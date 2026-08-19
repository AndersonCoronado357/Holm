// Web Push real: los avisos los manda el SERVIDOR, así que llegan con Holm
// cerrado. Este módulo sólo se ocupa de suscribir/desuscribir este navegador.
//
// Complementa a `notifications.ts`, que programa avisos con temporizadores y
// por tanto sólo funciona con la pestaña abierta. Ver `tienePush()`.
import { api } from '../api/client';

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** La clave VAPID viaja en base64url; `subscribe` la quiere en bytes. */
function claveABytes(base64: string): Uint8Array {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = atob(b64);
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)));
}

/**
 * Suscribe este dispositivo y guarda la suscripción en la cuenta.
 *
 * Devuelve el motivo del fallo en vez de tragárselo: cuando algo no funciona en
 * un móvil que no se puede inspeccionar, ese texto es lo único que hay.
 */
export async function subscribePush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: 'Este navegador no admite avisos en segundo plano' };
  try {
    const { publicKey, enabled } = await api.push.vapidKey();
    if (!enabled || !publicKey) return { ok: false, error: 'El servidor no tiene configurado el envío de avisos' };
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveABytes(publicKey) as BufferSource,
      });
    }
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
    if (!json.endpoint || !json.keys) return { ok: false, error: 'Suscripción incompleta' };
    await api.push.subscribe(json.endpoint, json.keys);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) };
  }
}

/** Da de baja este dispositivo (al apagar el interruptor). */
export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await api.push.unsubscribe(sub.endpoint).catch(() => {});
    await sub.unsubscribe();
  } catch {
    /* ignorar: si no se puede dar de baja, el servidor limpiará el endpoint
       muerto la primera vez que le devuelvan un 410 */
  }
}

/**
 * ¿Este dispositivo tiene push real?
 *
 * Importa porque si lo tiene, los avisos los manda el servidor y NO hay que
 * programarlos también en la pestaña: llegarían dos veces. Los temporizadores
 * del cliente quedan sólo como respaldo para navegadores sin push.
 */
export async function tienePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}
