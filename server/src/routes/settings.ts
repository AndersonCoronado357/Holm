import { Router } from 'express';
import { getDb } from '../db.js';
import { ah } from '../http.js';
import type { AuthedRequest } from '../auth.js';

// Preferencias de la CUENTA, no del navegador: entras desde otro equipo o
// reinstalas la app y las encuentras igual.
const THEMES = ['system', 'light', 'dark'];
const VIEWS = ['tasks', 'projects', 'notes', 'ideas', 'models'];
const MAX_LEAD = 24 * 60; // avisar como mucho un día antes

const DEFAULTS = {
  theme: 'system',
  notifications: { enabled: false, leadMinutes: 10 },
  lastPage: {} as Record<string, string>,
};

type Doc = {
  theme?: string;
  notifications?: { enabled?: boolean; leadMinutes?: number };
  lastPage?: Record<string, string>;
};

/** Documento limpio y completo: nunca devolvemos campos a medias. */
function publico(doc: Doc | null) {
  return {
    theme: THEMES.includes(doc?.theme ?? '') ? doc!.theme : DEFAULTS.theme,
    notifications: {
      enabled: doc?.notifications?.enabled === true,
      leadMinutes:
        typeof doc?.notifications?.leadMinutes === 'number' && doc.notifications.leadMinutes >= 0
          ? Math.min(MAX_LEAD, Math.round(doc.notifications.leadMinutes))
          : DEFAULTS.notifications.leadMinutes,
    },
    lastPage: doc?.lastPage && typeof doc.lastPage === 'object' ? doc.lastPage : {},
  };
}

const router = Router();

const leer = async (userId: string) =>
  publico((await getDb().collection('settings').findOne({ userId })) as Doc | null);

router.get(
  '/',
  ah(async (req: AuthedRequest, res) => {
    res.json(await leer(req.userId!));
  }),
);

/**
 * Guardado PARCIAL. Se escribe campo a campo (rutas con punto) para que mandar
 * sólo el tema no borre los avisos, ni al revés. PUT existe por compatibilidad
 * con el cliente anterior.
 */
const guardar = ah(async (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};

  if (THEMES.includes(b.theme)) set.theme = b.theme;

  if (b.notifications && typeof b.notifications === 'object') {
    const n = b.notifications;
    if (typeof n.enabled === 'boolean') set['notifications.enabled'] = n.enabled;
    if (typeof n.leadMinutes === 'number' && Number.isFinite(n.leadMinutes)) {
      set['notifications.leadMinutes'] = Math.min(MAX_LEAD, Math.max(0, Math.round(n.leadMinutes)));
    }
  }

  // Última pizarra abierta en cada módulo. `null` la olvida.
  if (b.lastPage && typeof b.lastPage === 'object') {
    for (const [view, id] of Object.entries(b.lastPage as Record<string, unknown>)) {
      if (!VIEWS.includes(view)) continue;
      if (id === null) unset[`lastPage.${view}`] = '';
      else if (typeof id === 'string' && id) set[`lastPage.${view}`] = id;
    }
  }

  if (!Object.keys(set).length && !Object.keys(unset).length) {
    res.json(await leer(req.userId!));
    return;
  }

  await getDb()
    .collection('settings')
    .updateOne(
      { userId: req.userId },
      {
        $set: { userId: req.userId, ...set },
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
      { upsert: true },
    );
  res.json(await leer(req.userId!));
});

router.put('/', guardar);
router.patch('/', guardar);
// `navigator.sendBeacon` sólo sabe hacer POST, y es lo único que sobrevive al
// cierre de la pestaña. Misma lógica, otra puerta.
router.post('/beacon', guardar);

/**
 * Reclama el aviso de un evento para el día indicado. Devuelve `first: true`
 * sólo a quien lo pide primero.
 *
 * Va en el servidor y no en el navegador porque «ya te avisé de esto» es un
 * hecho de la cuenta: con el móvil y el escritorio abiertos, el aviso tiene que
 * salir una vez, no una por pantalla.
 */
router.post(
  '/notified',
  ah(async (req: AuthedRequest, res) => {
    const id = String(req.body?.id ?? '');
    const day = String(req.body?.day ?? '');
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      res.status(400).json({ error: 'Falta el evento o el día' });
      return;
    }
    const col = getDb().collection('settings');

    // El upsert va aparte y con filtro de igualdad: hacerlo junto al `$ne` de
    // abajo crearía un segundo documento para el mismo usuario.
    await col.updateOne({ userId: req.userId }, { $setOnInsert: { userId: req.userId } }, { upsert: true });

    // Día distinto al guardado (o primera vez) → la lista empieza de cero y
    // este aviso es el primero.
    const nuevoDia = await col.updateOne(
      { userId: req.userId, 'notified.day': { $ne: day } },
      { $set: { notified: { day, ids: [id] } } },
    );
    if (nuevoDia.modifiedCount) {
      res.json({ first: true });
      return;
    }

    // Mismo día: `$addToSet` sólo modifica si el id no estaba.
    const add = await col.updateOne({ userId: req.userId }, { $addToSet: { 'notified.ids': id } });
    res.json({ first: add.modifiedCount === 1 });
  }),
);

export default router;
