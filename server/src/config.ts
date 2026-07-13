// Configuración de entorno. Detrás del proxy de acmsy NUNCA se confía en
// request.url/host: el origen público se fija con ORIGIN (o se deriva del
// subdominio inyectado por acmsy). En local cae a la URL de Vite.
const sub = process.env.ACMSY_SUBDOMAIN;

export const IS_PROD = process.env.NODE_ENV === 'production';

export const ORIGIN =
  process.env.ORIGIN ??
  (sub ? `https://${sub}.acmsy.com` : 'http://localhost:5191');

// Cliente de Google compartido de acmsy (inyectado por useAcmsyAuth en el
// contenedor). En local se leen del .env del servidor.
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';

// URI de callback que DEBE estar registrada en la consola de Google.
export const GOOGLE_REDIRECT_URI = `${ORIGIN}/auth/callback`;
