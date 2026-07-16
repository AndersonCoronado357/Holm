import { Router } from 'express';
import { getDb } from '../db.js';
import { ah, toClient, toClientMany, oid, isValidId } from '../http.js';
import type { AuthedRequest } from '../auth.js';

const TYPES = ['note', 'card', 'text', 'list', 'image', 'shape', 'frame', 'model', 'arrow'];
const FIELDS = ['x', 'y', 'w', 'h', 'color', 'zIndex', 'content', 'locked'];

function pick(body: Record<string, any>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

const router = Router();

// GET /api/elements?pageId=...
router.get(
  '/',
  ah(async (req: AuthedRequest, res) => {
    const pageId = String(req.query.pageId ?? '');
    if (!pageId) {
      res.status(400).json({ error: 'falta pageId' });
      return;
    }
    const elements = await getDb()
      .collection('elements')
      .find({ userId: req.userId, pageId })
      .sort({ zIndex: 1 })
      .toArray();
    res.json(toClientMany(elements));
  }),
);

// POST /api/elements
router.post(
  '/',
  ah(async (req: AuthedRequest, res) => {
    const body = req.body ?? {};
    if (!body.pageId || !TYPES.includes(body.type)) {
      res.status(400).json({ error: 'pageId y type validos son obligatorios' });
      return;
    }
    const now = new Date();
    const doc = {
      userId: req.userId,
      pageId: String(body.pageId),
      type: body.type,
      x: Number(body.x ?? 0),
      y: Number(body.y ?? 0),
      w: Number(body.w ?? 200),
      h: Number(body.h ?? 140),
      color: typeof body.color === 'string' ? body.color : null,
      zIndex: Number(body.zIndex ?? 0),
      content: body.content ?? {},
      locked: Boolean(body.locked ?? false),
      createdAt: now,
      updatedAt: now,
    };
    const r = await getDb().collection('elements').insertOne(doc);
    res.status(201).json(toClient({ _id: r.insertedId, ...doc }));
  }),
);

// PATCH /api/elements/:id
router.patch(
  '/:id',
  ah(async (req: AuthedRequest, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'id inválido' });
      return;
    }
    const patch = pick(req.body ?? {}, FIELDS);
    (patch as any).updatedAt = new Date();
    const db = getDb();
    await db.collection('elements').updateOne({ _id: oid(id), userId: req.userId }, { $set: patch });
    const updated = await db.collection('elements').findOne({ _id: oid(id), userId: req.userId });
    res.json(toClient(updated));
  }),
);

// DELETE /api/elements/:id
router.delete(
  '/:id',
  ah(async (req: AuthedRequest, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'id inválido' });
      return;
    }
    await getDb().collection('elements').deleteOne({ _id: oid(id), userId: req.userId });
    res.status(204).end();
  }),
);

export default router;
