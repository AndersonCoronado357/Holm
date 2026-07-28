import { Router } from 'express';
import { getDb } from '../db.js';
import { ah, toClient, toClientMany, oid, isValidId } from '../http.js';
import type { AuthedRequest } from '../auth.js';

const MODES = ['binary', 'quantity'];
const FREQ_TYPES = ['daily', 'weekdays', 'timesPerWeek'];

function normFrequency(raw: any): any {
  const type = FREQ_TYPES.includes(raw?.type) ? raw.type : 'daily';
  if (type === 'weekdays') {
    const days = Array.isArray(raw?.weekdays)
      ? raw.weekdays.filter((d: number) => d >= 0 && d <= 6)
      : [1, 2, 3, 4, 5];
    return { type, weekdays: days };
  }
  if (type === 'timesPerWeek') {
    const times = Math.max(1, Math.min(7, Number(raw?.timesPerWeek ?? 3)));
    return { type, timesPerWeek: times };
  }
  return { type: 'daily' };
}

const router = Router();

router.get(
  '/',
  ah(async (req: AuthedRequest, res) => {
    const habits = await getDb()
      .collection('habits')
      .find({ userId: req.userId })
      .sort({ order: 1 })
      .toArray();
    res.json(toClientMany(habits));
  }),
);

router.post(
  '/',
  ah(async (req: AuthedRequest, res) => {
    const b = req.body ?? {};
    if (typeof b.name !== 'string' || !b.name.trim()) {
      res.status(400).json({ error: 'el nombre es obligatorio' });
      return;
    }
    const db = getDb();
    const order = await db.collection('habits').countDocuments({ userId: req.userId });
    const mode = MODES.includes(b.mode) ? b.mode : 'binary';
    const doc = {
      userId: req.userId,
      name: b.name.trim(),
      mode,
      unit: mode === 'quantity' ? String(b.unit ?? '').trim() || 'uds' : null,
      target: mode === 'quantity' ? Math.max(1, Number(b.target ?? 1)) : null,
      frequency: normFrequency(b.frequency),
      color: typeof b.color === 'string' ? b.color : null,
      order,
      createdAt: new Date(),
    };
    const r = await db.collection('habits').insertOne(doc);
    res.status(201).json(toClient({ _id: r.insertedId, ...doc }));
  }),
);

router.patch(
  '/:id',
  ah(async (req: AuthedRequest, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'id inválido' });
      return;
    }
    const b = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim();
    if (MODES.includes(b.mode)) patch.mode = b.mode;
    if (b.unit !== undefined) patch.unit = String(b.unit).trim() || 'uds';
    if (b.target !== undefined) patch.target = Math.max(1, Number(b.target));
    if (b.frequency !== undefined) patch.frequency = normFrequency(b.frequency);
    if (b.color !== undefined) patch.color = b.color;
    if (b.order !== undefined) patch.order = Number(b.order);
    const db = getDb();
    await db.collection('habits').updateOne({ _id: oid(id), userId: req.userId }, { $set: patch });
    const updated = await db.collection('habits').findOne({ _id: oid(id), userId: req.userId });
    res.json(toClient(updated));
  }),
);

router.delete(
  '/:id',
  ah(async (req: AuthedRequest, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'id inválido' });
      return;
    }
    const db = getDb();
    await db.collection('habitLogs').deleteMany({ userId: req.userId, habitId: id });
    await db.collection('habits').deleteOne({ _id: oid(id), userId: req.userId });
    res.status(204).end();
  }),
);

export default router;
