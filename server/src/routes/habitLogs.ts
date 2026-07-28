import { Router } from 'express';
import { getDb } from '../db.js';
import { ah, toClientMany } from '../http.js';
import type { AuthedRequest } from '../auth.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const router = Router();

// GET /api/habit-logs?from=YYYY-MM-DD&to=YYYY-MM-DD[&habitId=...]
router.get(
  '/',
  ah(async (req: AuthedRequest, res) => {
    const from = String(req.query.from ?? '');
    const to = String(req.query.to ?? '');
    const habitId = req.query.habitId ? String(req.query.habitId) : undefined;
    const filter: Record<string, unknown> = { userId: req.userId };
    if (DATE_RE.test(from) || DATE_RE.test(to)) {
      filter.date = {};
      if (DATE_RE.test(from)) (filter.date as any).$gte = from;
      if (DATE_RE.test(to)) (filter.date as any).$lte = to;
    }
    if (habitId) filter.habitId = habitId;
    const logs = await getDb().collection('habitLogs').find(filter).toArray();
    res.json(toClientMany(logs));
  }),
);

// PUT /api/habit-logs { habitId, date, value }  -> upsert (0/false borra)
router.put(
  '/',
  ah(async (req: AuthedRequest, res) => {
    const { habitId, date } = req.body ?? {};
    let { value } = req.body ?? {};
    if (typeof habitId !== 'string' || !DATE_RE.test(String(date))) {
      res.status(400).json({ error: 'habitId y date (YYYY-MM-DD) son obligatorios' });
      return;
    }
    const db = getDb();
    const empty = value === false || value === 0 || value === null || value === undefined;
    if (empty) {
      await db.collection('habitLogs').deleteOne({ userId: req.userId, habitId, date });
      res.json({ habitId, date, value: 0 });
      return;
    }
    if (value === true) value = 1;
    await db
      .collection('habitLogs')
      .updateOne(
        { habitId, date },
        { $set: { userId: req.userId, habitId, date, value } },
        { upsert: true },
      );
    res.json({ habitId, date, value });
  }),
);

export default router;
