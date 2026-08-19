import { Router } from 'express';
import { getDb } from '../db.js';
import { ah, toClient, toClientMany, oid, isValidId } from '../http.js';
import type { AuthedRequest } from '../auth.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

// Hora válida 'HH:MM' o null (evento de todo el día).
function normTime(raw: any): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw);
  return TIME_RE.test(s) ? s : null;
}

const router = Router();

// GET /api/events  → todos los eventos del usuario
router.get(
  '/',
  ah(async (req: AuthedRequest, res) => {
    const events = await getDb()
      .collection('events')
      .find({ userId: req.userId })
      .sort({ eventDate: 1, startTime: 1 })
      .toArray();
    res.json(toClientMany(events));
  }),
);

router.post(
  '/',
  ah(async (req: AuthedRequest, res) => {
    const b = req.body ?? {};
    const title = String(b.title ?? '').trim();
    const eventDate = String(b.eventDate ?? '');
    if (!title) {
      res.status(400).json({ error: 'El título es obligatorio' });
      return;
    }
    if (!DATE_RE.test(eventDate)) {
      res.status(400).json({ error: 'Fecha inválida' });
      return;
    }
    const doc = {
      userId: req.userId,
      title: title.slice(0, 200),
      eventDate,
      startTime: normTime(b.startTime),
      endTime: normTime(b.endTime),
      color: typeof b.color === 'string' && b.color ? b.color : '#21C2D9',
      createdAt: new Date(),
    };
    const r = await getDb().collection('events').insertOne(doc);
    res.status(201).json(toClient({ _id: r.insertedId, ...doc }));
  }),
);

router.patch(
  '/:id',
  ah(async (req: AuthedRequest, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(404).json({ error: 'No encontrado' });
      return;
    }
    const b = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (typeof b.title === 'string' && b.title.trim()) patch.title = b.title.trim().slice(0, 200);
    if (typeof b.eventDate === 'string' && DATE_RE.test(b.eventDate)) patch.eventDate = b.eventDate;
    if ('startTime' in b) patch.startTime = normTime(b.startTime);
    if ('endTime' in b) patch.endTime = normTime(b.endTime);
    if (typeof b.color === 'string' && b.color) patch.color = b.color;

    // Si se mueve la fecha o la hora, el aviso vuelve a estar pendiente: sin
    // esto, adelantar un evento ya avisado no volvería a sonar nunca.
    const movido = 'eventDate' in patch || 'startTime' in patch;

    const db = getDb();
    const r = await db
      .collection('events')
      .findOneAndUpdate(
        { _id: oid(id), userId: req.userId },
        { $set: patch, ...(movido ? { $unset: { pushedAt: '' } } : {}) },
        { returnDocument: 'after' },
      );
    if (!r) {
      res.status(404).json({ error: 'No encontrado' });
      return;
    }
    res.json(toClient(r));
  }),
);

router.delete(
  '/:id',
  ah(async (req: AuthedRequest, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(404).json({ error: 'No encontrado' });
      return;
    }
    await getDb().collection('events').deleteOne({ _id: oid(id), userId: req.userId });
    res.status(204).end();
  }),
);

export default router;
