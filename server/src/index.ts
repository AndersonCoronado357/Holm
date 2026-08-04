import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connect } from './db.js';
import { authRequired } from './auth.js';
import { IS_PROD } from './config.js';
import auth from './routes/auth.js';
import oauth from './routes/oauth.js';
import pages from './routes/pages.js';
import elements from './routes/elements.js';
import habits from './routes/habits.js';
import habitLogs from './routes/habitLogs.js';
import events from './routes/events.js';
import settings from './routes/settings.js';
import summary from './routes/summary.js';

// Puerto propio: NO usamos process.env.PORT/SERVER_PORT porque Spinup los
// inyecta con el puerto del cliente y chocarian con Vite.
const PORT = Number(process.env.HOLM_API_PORT ?? process.env.PORT ?? 5192);
// En el contenedor hay que escuchar en 0.0.0.0 para que Caddy lo alcance por
// nombre; en local seguimos en 127.0.0.1.
const HOST = process.env.HOLM_API_HOST ?? (IS_PROD ? '0.0.0.0' : '127.0.0.1');

async function main() {
  await connect();
  console.log('MongoDB conectado.');

  const app = express();
  // origin reflejado + credenciales para que la cookie viaje.
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '12mb' })); // imagenes como data URL

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'holm-api' }));
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'holm-api' }));

  // Login con Google (flujo por redirección, en el mismo origen que la app).
  app.use('/auth', oauth);

  app.use('/api/auth', auth);

  // De aquí en adelante, todo exige sesión.
  app.use('/api/pages', authRequired, pages);
  app.use('/api/elements', authRequired, elements);
  app.use('/api/habits', authRequired, habits);
  app.use('/api/habit-logs', authRequired, habitLogs);
  app.use('/api/events', authRequired, events);
  app.use('/api/settings', authRequired, settings);
  app.use('/api/summary', authRequired, summary);

  // En producción el propio servidor sirve el SPA compilado (un solo origen).
  if (IS_PROD) {
    const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));
    app.use(express.static(clientDist));
    // Cualquier ruta que no sea API/auth devuelve el index (routing del SPA).
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/auth')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'error interno del servidor' });
  });

  app.listen(PORT, HOST, () => {
    console.log(`Holm API escuchando en http://${HOST}:${PORT}`);
  });
}

main().catch((err) => {
  console.error('No se pudo arrancar el servidor:', err.message);
  process.exit(1);
});
