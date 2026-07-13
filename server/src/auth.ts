import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction, CookieOptions } from 'express';
import { IS_PROD } from './config.js';

// En acmsy la clave estable la inyecta como SESSION_SECRET; en local, HOLM_JWT_SECRET.
const SECRET =
  process.env.HOLM_JWT_SECRET ?? process.env.SESSION_SECRET ?? 'holm-dev-secret-cambia-esto';

// Cookie de sesion: persistente (sobrevive cerrar el navegador / apagar el
// equipo), httpOnly, ~10 años. Nada de localStorage en el cliente.
// `secure` solo en producción (https detrás del proxy); en local va sobre http.
export const COOKIE_NAME = 'holm_session';
export const COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: IS_PROD,
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
};

// --- Hashing de contrasenas (scrypt, sin dependencias nativas) ---

export function hashSecret(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifySecret(plain: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(plain, salt, 64);
  const original = Buffer.from(hash, 'hex');
  if (candidate.length !== original.length) return false;
  return timingSafeEqual(candidate, original);
}

// --- JWT ---

export function signToken(userId: string): string {
  // Sin expiracion: la sesion queda permanente hasta cerrar sesion a mano.
  return jwt.sign({ sub: userId }, SECRET);
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, SECRET) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// --- Middleware: exige token y deja req.userId ---

export interface AuthedRequest extends Request {
  userId?: string;
}

export function authRequired(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const cookieTok = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME] ?? '';
  const token = bearer || cookieTok;
  const userId = token ? verifyToken(token) : null;
  if (!userId) {
    res.status(401).json({ error: 'no autenticado' });
    return;
  }
  req.userId = userId;
  next();
}

// Normaliza el email para usarlo como identificador.
export function normEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}
