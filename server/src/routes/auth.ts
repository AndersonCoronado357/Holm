import { Router, type Response } from 'express';
import { getDb } from '../db.js';
import { ah, oid, isValidId } from '../http.js';
import {
  hashSecret,
  verifySecret,
  signToken,
  normEmail,
  authRequired,
  COOKIE_NAME,
  COOKIE_OPTS,
  type AuthedRequest,
} from '../auth.js';

const router = Router();

// Setea la cookie de sesion persistente.
function issueSession(res: Response, userId: string) {
  res.cookie(COOKIE_NAME, signToken(userId), COOKIE_OPTS);
}

function publicUser(doc: any) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name ?? null,
    securityQuestion: doc.securityQuestion,
    createdAt: doc.createdAt,
  };
}

// POST /api/auth/signup
router.post(
  '/signup',
  ah(async (req, res) => {
    const b = req.body ?? {};
    const email = normEmail(b.email);
    const password = String(b.password ?? '');
    const name = String(b.name ?? '').trim();
    const securityQuestion = String(b.securityQuestion ?? '').trim();
    const securityAnswer = String(b.securityAnswer ?? '').trim();

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Email inválido' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    if (!securityQuestion || !securityAnswer) {
      res.status(400).json({ error: 'La pregunta y respuesta de seguridad son obligatorias' });
      return;
    }

    const db = getDb();
    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      res.status(409).json({ error: 'Ya existe una cuenta con ese email' });
      return;
    }

    const doc = {
      email,
      name: name || null,
      passwordHash: hashSecret(password),
      securityQuestion,
      securityAnswerHash: hashSecret(securityAnswer.toLowerCase()),
      createdAt: new Date(),
    };
    const r = await db.collection('users').insertOne(doc);
    const user = publicUser({ _id: r.insertedId, ...doc });
    issueSession(res, r.insertedId.toString());
    res.status(201).json({ user });
  }),
);

// POST /api/auth/login
router.post(
  '/login',
  ah(async (req, res) => {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password ?? '');
    const db = getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user || !verifySecret(password, user.passwordHash)) {
      res.status(401).json({ error: 'Email o contraseña incorrectos' });
      return;
    }
    issueSession(res, user._id.toString());
    res.json({ user: publicUser(user) });
  }),
);

// POST /api/auth/recover/question -> devuelve la pregunta de seguridad del email
router.post(
  '/recover/question',
  ah(async (req, res) => {
    const email = normEmail(req.body?.email);
    const db = getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user) {
      res.status(404).json({ error: 'No hay cuenta con ese email' });
      return;
    }
    res.json({ question: user.securityQuestion });
  }),
);

// POST /api/auth/recover/reset -> verifica respuesta y cambia la contraseña
router.post(
  '/recover/reset',
  ah(async (req, res) => {
    const email = normEmail(req.body?.email);
    const answer = String(req.body?.securityAnswer ?? '').trim().toLowerCase();
    const newPassword = String(req.body?.newPassword ?? '');
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
      return;
    }
    const db = getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user || !verifySecret(answer, user.securityAnswerHash)) {
      res.status(401).json({ error: 'La respuesta de seguridad no coincide' });
      return;
    }
    await db
      .collection('users')
      .updateOne({ _id: user._id }, { $set: { passwordHash: hashSecret(newPassword) } });
    issueSession(res, user._id.toString());
    res.json({ user: publicUser(user) });
  }),
);

// POST /api/auth/logout -> borra la cookie de sesion
router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get(
  '/me',
  authRequired,
  ah(async (req: AuthedRequest, res) => {
    if (!isValidId(req.userId)) {
      res.status(401).json({ error: 'no autenticado' });
      return;
    }
    const user = await getDb().collection('users').findOne({ _id: oid(req.userId) });
    if (!user) {
      res.status(401).json({ error: 'no autenticado' });
      return;
    }
    res.json({ user: publicUser(user) });
  }),
);

export default router;
