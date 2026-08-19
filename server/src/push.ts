// Push real (Web Push + VAPID). A diferencia de los avisos del cliente, que
// sólo existen mientras la pestaña esté abierta, esto llega con Holm CERRADO:
// el navegador despierta el Service Worker cuando entra el push y es él quien
// muestra la notificación.
//
// Modelo tomado del de Hibi (server/utils/webPush.ts), con sus dos lecciones
// caras: leer las claves de process.env en caliente, y marcar el evento como
// enviado sólo cuando de verdad salió.
import webpush from 'web-push';
import { getDb } from './db.js';

/** Minutos que el reloj local del usuario va respecto a UTC (Colombia: -300). */
const TZ_OFFSET = Number(process.env.HOLM_TZ_OFFSET_MINUTES ?? -300);

/** Ventana hacia atrás: un reinicio no dispara avisos de hace horas. */
const VENTANA_H = 3;

function ahora() {
  const local = new Date(Date.now() + TZ_OFFSET * 60_000);
  const dia = local.toISOString().slice(0, 10);
  const hhmm = local.toISOString().slice(11, 16);
  return { local, dia, hhmm };
}

/** Minutos desde medianoche de un 'HH:MM'. */
function enMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function pushEnabled(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? '';
}

// Las claves se leen SIEMPRE de process.env, no de una constante de módulo
// calculada al importar: en producción el compose las inyecta al arrancar el
// contenedor, no durante el build.
let configurado = false;
function configurar() {
  if (configurado) return;
  const pub = process.env.VAPID_PUBLIC_KEY ?? '';
  const priv = process.env.VAPID_PRIVATE_KEY ?? '';
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:noreply@acmsy.com';
  if (!pub || !priv) throw new Error('Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY');
  webpush.setVapidDetails(subject, pub, priv);
  configurado = true;
}

export interface Aviso {
  title: string;
  body: string;
  /** Ruta que se abre al tocar la notificación. */
  url?: string;
}

/**
 * Manda un push a TODOS los dispositivos suscritos del usuario. Si el servicio
 * confirma que una suscripción ya no existe (404/410) se borra: son endpoints
 * muertos que si no se acumulan para siempre.
 */
export async function sendPushToUser(userId: string, aviso: Aviso): Promise<{ sent: number; failed: number }> {
  configurar();
  const db = getDb();
  const subs = await db.collection('pushSubscriptions').find({ userId }).toArray();
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(aviso),
          // urgency alta para que despierte un móvil dormido (Doze): sin esto
          // un Android idle no atiende el push hasta que lo desbloqueas.
          // TTL de 12 h: si estuvo apagado un rato aún llega, pero no arrastra
          // avisos de días atrás.
          { urgency: 'high', TTL: 12 * 3600 },
        );
        sent++;
      } catch (err) {
        failed++;
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await db.collection('pushSubscriptions').deleteOne({ _id: s._id });
        }
      }
    }),
  );
  return { sent, failed };
}

/** Interruptor y antelación de la cuenta (`settings.notifications`). */
async function preferencias(userId: string): Promise<{ activados: boolean; minutosAntes: number }> {
  const doc = await getDb().collection('settings').findOne({ userId });
  const n = (doc?.notifications ?? {}) as { enabled?: boolean; leadMinutes?: number };
  return {
    activados: n.enabled === true,
    minutosAntes: typeof n.leadMinutes === 'number' && n.leadMinutes >= 0 ? n.leadMinutes : 10,
  };
}

/**
 * Eventos de HOY cuya hora de aviso ya llegó y que aún no se han enviado.
 *
 * El filtro por hora NO se puede hacer en la consulta porque la antelación es
 * de cada usuario: se trae el día y se descarta en memoria (son pocos: los de
 * hoy de quienes tienen push).
 */
export async function sendDueEvents(): Promise<{ sent: number; matched: number }> {
  const db = getDb();
  const { dia, hhmm } = ahora();
  const ahoraMin = enMinutos(hhmm);
  const desdeMin = ahoraMin - VENTANA_H * 60;

  // Sólo usuarios con algún dispositivo suscrito: al resto no hay a quién avisar.
  const userIds = (await db.collection('pushSubscriptions').distinct('userId')) as string[];
  if (!userIds.length) return { sent: 0, matched: 0 };

  const candidatos = await db
    .collection('events')
    .find({ userId: { $in: userIds }, eventDate: dia, startTime: { $ne: null }, pushedAt: { $exists: false } })
    .toArray();

  const prefs = new Map<string, { activados: boolean; minutosAntes: number }>();
  const marcar = (id: unknown) => db.collection('events').updateOne({ _id: id as never }, { $set: { pushedAt: new Date() } });

  let sent = 0;
  let matched = 0;
  for (const ev of candidatos) {
    const userId = String(ev.userId);
    if (!prefs.has(userId)) prefs.set(userId, await preferencias(userId));
    const pref = prefs.get(userId)!;

    const aviso = enMinutos(String(ev.startTime)) - pref.minutosAntes;
    if (aviso > ahoraMin) continue; // todavía no toca
    matched++;
    if (aviso < desdeMin) {
      // Demasiado viejo (servidor apagado un rato): se descarta, pero se marca
      // para no volver a evaluarlo cada minuto.
      await marcar(ev._id);
      continue;
    }
    if (!pref.activados) {
      await marcar(ev._id);
      continue;
    }
    const cuerpo = pref.minutosAntes > 0 ? `A las ${ev.startTime} (en ${pref.minutosAntes} min)` : `A las ${ev.startTime}`;
    const res = await sendPushToUser(userId, { title: String(ev.title), body: cuerpo, url: '/calendario' });
    // Sólo se marca si SALIÓ. Si en este momento ningún dispositivo era
    // alcanzable, se reintenta al minuto siguiente mientras siga en ventana.
    if (res.sent > 0) {
      await marcar(ev._id);
      sent++;
    }
  }
  return { sent, matched };
}

/** Un ciclo del programador. Segura de llamar en cualquier momento. */
export async function runScheduler(): Promise<{ events: number }> {
  if (!pushEnabled()) return { events: 0 };
  const r = await sendDueEvents().catch(() => ({ sent: 0 }));
  return { events: r.sent };
}

/**
 * Programador interno: un tic por minuto dentro del propio proceso, sin cron
 * externo. Holm corre en un solo contenedor, así que hay una sola instancia.
 */
export function startScheduler(): void {
  if (!pushEnabled()) {
    console.log('Push desactivado (sin claves VAPID): no se programan avisos.');
    return;
  }
  const tic = async () => {
    try {
      await runScheduler();
    } catch (err) {
      // Un fallo de push nunca puede tumbar el servidor.
      console.error('Programador de avisos:', (err as Error).message);
    }
  };
  // El primer ciclo a los 15 s, para no pelear con el arranque de la base.
  setTimeout(() => {
    void tic();
    setInterval(tic, 60_000);
  }, 15_000);
  console.log('Programador de avisos en marcha (cada minuto).');
}
