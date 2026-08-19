import { Router } from 'express';
import { getDb } from '../db.js';
import { ah } from '../http.js';
import type { AuthedRequest } from '../auth.js';
import { authRequired } from '../auth.js';
import { pushEnabled, runScheduler, sendPushToUser, vapidPublicKey } from '../push.js';

const router = Router();

/**
 * Clave pública VAPID. Es pública por definición (va dentro del cliente), así
 * que no exige sesión. Se lee en caliente: en producción el valor llega al
 * arrancar el contenedor, después del build.
 */
router.get('/vapid-key', (_req, res) => {
  res.json({ publicKey: vapidPublicKey(), enabled: pushEnabled() });
});

/**
 * Dispara un ciclo del programador a mano. Protegido con CRON_SECRET: sirve
 * para probar y como respaldo si algún día se quiere disparar desde fuera.
 */
router.post(
  '/run',
  ah(async (req, res) => {
    const secret = process.env.CRON_SECRET ?? '';
    const dado = String(req.headers['x-cron-secret'] ?? req.query.secret ?? '');
    if (!secret || dado !== secret) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }
    res.json(await runScheduler());
  }),
);

// De aquí en adelante hace falta sesión.
router.use(authRequired);

/** Guarda (o reasigna) la suscripción de ESTE navegador. */
router.post(
  '/subscribe',
  ah(async (req: AuthedRequest, res) => {
    const b = req.body ?? {};
    const endpoint = String(b.endpoint ?? '');
    const p256dh = String(b.keys?.p256dh ?? '');
    const auth = String(b.keys?.auth ?? '');
    if (!/^https?:\/\//.test(endpoint) || !p256dh || !auth) {
      res.status(400).json({ error: 'Suscripción incompleta' });
      return;
    }
    // Clave por endpoint: si el mismo navegador cambia de cuenta, la
    // suscripción pasa a la nueva en vez de duplicarse.
    await getDb()
      .collection('pushSubscriptions')
      .updateOne(
        { endpoint },
        { $set: { userId: req.userId, endpoint, p256dh, auth, updatedAt: new Date() } },
        { upsert: true },
      );
    res.json({ ok: true });
  }),
);

/** Da de baja este navegador (al apagar el interruptor). */
router.post(
  '/unsubscribe',
  ah(async (req: AuthedRequest, res) => {
    const endpoint = String(req.body?.endpoint ?? '');
    if (endpoint) {
      await getDb().collection('pushSubscriptions').deleteOne({ endpoint, userId: req.userId });
    }
    res.json({ ok: true });
  }),
);

/** Push de prueba real: sale por el servidor, no por la pestaña. */
router.post(
  '/test',
  ah(async (req: AuthedRequest, res) => {
    if (!pushEnabled()) {
      res.status(503).json({ error: 'El servidor no tiene configurado el envío de avisos' });
      return;
    }
    const r = await sendPushToUser(req.userId!, {
      title: 'Holm',
      body: 'Listo. Así te avisaré de tus eventos, aunque tengas Holm cerrado.',
      url: '/calendario',
    });
    if (r.sent === 0) {
      res.status(400).json({ error: 'Este dispositivo todavía no está suscrito' });
      return;
    }
    res.json(r);
  }),
);

export default router;
