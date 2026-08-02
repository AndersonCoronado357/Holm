import { Router } from 'express';
import { getDb } from '../db.js';
import { ah } from '../http.js';
import type { AuthedRequest } from '../auth.js';

const THEMES = ['system', 'light', 'dark'];
const DEFAULTS = { theme: 'system' };

const router = Router();

router.get(
  '/',
  ah(async (req: AuthedRequest, res) => {
    const doc = await getDb().collection('settings').findOne({ userId: req.userId });
    const { _id, userId, ...rest } = (doc ?? {}) as any;
    res.json({ ...DEFAULTS, ...rest });
  }),
);

router.put(
  '/',
  ah(async (req: AuthedRequest, res) => {
    const patch: Record<string, unknown> = {};
    if (THEMES.includes(req.body?.theme)) patch.theme = req.body.theme;
    const db = getDb();
    await db
      .collection('settings')
      .updateOne({ userId: req.userId }, { $set: { userId: req.userId, ...patch } }, { upsert: true });
    const doc = await db.collection('settings').findOne({ userId: req.userId });
    const { _id, userId, ...rest } = (doc ?? {}) as any;
    res.json({ ...DEFAULTS, ...rest });
  }),
);

export default router;
