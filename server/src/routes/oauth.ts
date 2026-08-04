import { Router, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { getDb } from '../db.js';
import { signToken, normEmail, COOKIE_NAME, COOKIE_OPTS } from '../auth.js';
import {
  IS_PROD,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} from '../config.js';

// Login con Google usando el cliente OAuth compartido de acmsy, pero con la
// sesión propia de Holm (cookie httpOnly + JWT). No usamos los módulos de auth
// SQL de acmsy: Holm guarda sus usuarios en Mongo.
const router = Router();
const STATE_COOKIE = 'holm_oauth_state';

const stateCookieOpts = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: IS_PROD,
  path: '/',
  maxAge: 10 * 60 * 1000, // 10 min para completar el flujo
};

// GET /auth/google -> redirige al consentimiento de Google.
router.get('/google', (_req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(500).send('Acceso con Google no configurado (falta GOOGLE_CLIENT_ID).');
    return;
  }
  const state = randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, stateCookieOpts);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// GET /auth/callback -> intercambia el código, crea/vincula el usuario y abre sesión.
router.get('/callback', async (req: Request, res: Response) => {
  const fail = (reason: string) => res.redirect(`/?auth=${reason}`);
  try {
    const code = String(req.query.code ?? '');
    const state = String(req.query.state ?? '');
    const saved = (req as Request & { cookies?: Record<string, string> }).cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: '/' });

    if (!code || !state || state !== saved) {
      fail('google_state');
      return;
    }

    // 1) código -> tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!tokenRes.ok) {
      fail('google_token');
      return;
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) {
      fail('google_token');
      return;
    }

    // 2) tokens -> perfil
    const profRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profRes.ok) {
      fail('google_profile');
      return;
    }
    const profile = (await profRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    const email = normEmail(profile.email);
    if (!email || profile.email_verified === false) {
      fail('google_email');
      return;
    }

    // 3) buscar o crear usuario (dedupe por email con cuentas de contraseña)
    const db = getDb();
    let user = await db.collection('users').findOne({ email });
    if (!user) {
      const doc = {
        email,
        name: profile.name ?? null,
        googleId: profile.sub ?? null,
        passwordHash: null,
        securityQuestion: null,
        securityAnswerHash: null,
        createdAt: new Date(),
      };
      const r = await db.collection('users').insertOne(doc);
      user = { _id: r.insertedId, ...doc };
    } else if (!user.googleId && profile.sub) {
      await db.collection('users').updateOne({ _id: user._id }, { $set: { googleId: profile.sub } });
    }

    // 4) abrir sesión y volver a la app
    res.cookie(COOKIE_NAME, signToken(user._id.toString()), COOKIE_OPTS);
    res.redirect('/');
  } catch (e) {
    console.error('OAuth Google falló:', (e as Error).message);
    fail('google_error');
  }
});

export default router;
