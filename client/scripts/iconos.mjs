// Genera los PNG de la PWA a partir de public/holm.svg.
//
// Hacen falta PNG y no vale sólo el SVG: iOS ignora los SVG en
// `apple-touch-icon` (pone una captura de la página como icono) y varios
// lanzadores de Android tampoco los rasterizan bien.
//
//   node scripts/iconos.mjs
//
// Se ejecuta a mano cuando cambia el logo; los PNG quedan versionados.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(raiz, 'public/holm.svg'));
const FONDO = '#101214'; // el mismo background_color del manifest

/**
 * @param {number} lado  tamaño final del PNG
 * @param {number} zona  fracción del lado que ocupa el logo (1 = a sangre)
 * @param {string} nombre
 */
async function png(lado, zona, nombre) {
  const logo = Math.round(lado * zona);
  const marca = await sharp(svg, { density: 400 }).resize(logo, logo, { fit: 'contain', background: '#0000' }).png().toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 4, background: FONDO } })
    .composite([{ input: marca, gravity: 'center' }])
    .png()
    .toFile(join(raiz, 'public', nombre));
  console.log(nombre, `${lado}x${lado}`);
}

// `any`: el logo casi a sangre. `maskable`: Android recorta hasta un círculo,
// así que el logo se queda dentro del 80 % central (zona segura del formato).
await png(192, 0.82, 'icon-192.png');
await png(512, 0.82, 'icon-512.png');
await png(512, 0.6, 'icon-maskable-512.png');
await png(180, 0.82, 'apple-touch-icon.png');
