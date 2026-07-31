import { Router } from 'express';
import { getDb } from '../db.js';
import { ah, toClient } from '../http.js';
import type { AuthedRequest } from '../auth.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CANVAS_VIEWS = ['tasks', 'projects', 'notes', 'ideas', 'models'] as const;

function isoToday(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

function scheduledOn(habit: any, weekday: number): boolean {
  const f = habit.frequency ?? { type: 'daily' };
  if (f.type === 'weekdays') return Array.isArray(f.weekdays) && f.weekdays.includes(weekday);
  return true;
}

function preview(el: any): string {
  const c = el.content ?? {};
  let text = '';
  if (el.type === 'list') {
    text = c.title || (Array.isArray(c.items) ? c.items.map((i: any) => i.text).join(', ') : '');
  } else if (el.type === 'frame') {
    text = c.title || '';
  } else if (el.type === 'image') {
    text = c.alt || 'Imagen';
  } else {
    text = c.text || '';
  }
  text = String(text).replace(/\s+/g, ' ').trim();
  return text.length > 90 ? text.slice(0, 90) + '…' : text;
}

const router = Router();

router.get(
  '/',
  ah(async (req: AuthedRequest, res) => {
    const db = getDb();
    const userId = req.userId;
    const date = DATE_RE.test(String(req.query.date)) ? String(req.query.date) : isoToday();
    const weekday = new Date(date + 'T00:00:00').getDay();

    const habits = await db.collection('habits').find({ userId }).sort({ order: 1 }).toArray();
    const todays = habits.filter((h) => scheduledOn(h, weekday));
    const ids = todays.map((h) => h._id.toString());
    const logs = await db
      .collection('habitLogs')
      .find({ userId, date, habitId: { $in: ids } })
      .toArray();
    const logMap = new Map(logs.map((l) => [l.habitId, l.value]));
    const habitsToday = todays.map((h) => ({
      ...toClient(h),
      value: logMap.get(h._id.toString()) ?? 0,
    }));

    const pages = await db.collection('pages').find({ userId }).toArray();
    const pageView = new Map(pages.map((p) => [p._id.toString(), p.view]));

    const elements = await db
      .collection('elements')
      .find({ userId })
      .sort({ updatedAt: -1 })
      .limit(500)
      .toArray();

    const recent: Record<string, any[]> = { tasks: [], projects: [], notes: [], ideas: [], models: [] };
    for (const el of elements) {
      const view = pageView.get(el.pageId);
      if (!view || !(view in recent)) continue;
      const text = preview(el);
      if (!text) continue;
      if (recent[view].length < 6) {
        recent[view].push({ id: el._id.toString(), type: el.type, color: el.color, text, pageId: el.pageId });
      }
    }

    const counts: Record<string, { pages: number; elements: number }> = {};
    for (const v of CANVAS_VIEWS) {
      const pageIds = pages.filter((p) => p.view === v).map((p) => p._id.toString());
      const elementCount = pageIds.length
        ? await db.collection('elements').countDocuments({ userId, pageId: { $in: pageIds } })
        : 0;
      counts[v] = { pages: pageIds.length, elements: elementCount };
    }

    res.json({ date, habitsToday, recent, counts });
  }),
);

export default router;
