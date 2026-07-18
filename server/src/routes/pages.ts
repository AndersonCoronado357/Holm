import { Router } from 'express';
import { getDb } from '../db.js';
import { ah, toClient, toClientMany, oid, isValidId } from '../http.js';
import type { AuthedRequest } from '../auth.js';

export const VIEWS = ['tasks', 'projects', 'notes', 'ideas', 'models'] as const;

const router = Router();

// GET /api/pages?view=tasks
router.get(
  '/',
  ah(async (req: AuthedRequest, res) => {
    const view = String(req.query.view ?? '');
    if (!VIEWS.includes(view as any)) {
      res.status(400).json({ error: 'view inválida' });
      return;
    }
    const pages = await getDb()
      .collection('pages')
      .find({ userId: req.userId, view })
      .sort({ order: 1, createdAt: 1 })
      .toArray();
    res.json(toClientMany(pages));
  }),
);

// POST /api/pages { view, name }
router.post(
  '/',
  ah(async (req: AuthedRequest, res) => {
    const { view, name } = req.body ?? {};
    if (!VIEWS.includes(view)) {
      res.status(400).json({ error: 'view inválida' });
      return;
    }
    const db = getDb();
    const order = await db.collection('pages').countDocuments({ userId: req.userId, view });
    const doc = {
      userId: req.userId,
      view,
      name: (typeof name === 'string' && name.trim()) || `Página ${order + 1}`,
      order,
      createdAt: new Date(),
    };
    const r = await db.collection('pages').insertOne(doc);
    res.status(201).json(toClient({ _id: r.insertedId, ...doc }));
  }),
);

// PATCH /api/pages/:id { name?, order? }
router.patch(
  '/:id',
  ah(async (req: AuthedRequest, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'id inválido' });
      return;
    }
    const patch: Record<string, unknown> = {};
    if (typeof req.body?.name === 'string') patch.name = req.body.name.trim() || 'Sin título';
    if (typeof req.body?.order === 'number') patch.order = req.body.order;
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'nada que actualizar' });
      return;
    }
    const db = getDb();
    await db.collection('pages').updateOne({ _id: oid(id), userId: req.userId }, { $set: patch });
    const updated = await db.collection('pages').findOne({ _id: oid(id), userId: req.userId });
    res.json(toClient(updated));
  }),
);

// DELETE /api/pages/:id  -> borra la página y sus elementos
router.delete(
  '/:id',
  ah(async (req: AuthedRequest, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'id inválido' });
      return;
    }
    const db = getDb();
    await db.collection('elements').deleteMany({ userId: req.userId, pageId: id });
    await db.collection('pages').deleteOne({ _id: oid(id), userId: req.userId });
    res.status(204).end();
  }),
);

export default router;
