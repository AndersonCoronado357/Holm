// Banco de casos del trazado (GUIA-LINEAS.md §9). Se ejecuta sin interfaz y
// cuenta, por caso: tramos que atraviesan, que rozan y diagonales. Debe dar 0/0/0.
//   npx tsx client/src/canvas/lineRouter.bench.ts
import type { Point } from '../api/types';
import type { Box } from './connectors';
import {
  alinearCarriles,
  diagnosticar,
  ejeDeTramo,
  engancharElemento,
  elegirLados,
  forzarOrtogonal,
  limpiar,
  limpiarSuave,
  moverTramo,
  puntoDeLado,
  trazar,
} from './lineRouter';

const N = (x: number, y: number, w = 180, h = 100): Box => ({ x, y, w, h });

interface Caso {
  nombre: string;
  from: Box;
  to: Box;
  otros?: Box[];
}

const CASOS: Caso[] = [
  { nombre: 'enfrentados y alineados', from: N(100, 300), to: N(600, 300) },
  { nombre: 'enfrentados y desalineados', from: N(100, 200), to: N(600, 460) },
  { nombre: 'ambos salen por el mismo lado', from: N(100, 300), to: N(100, 560) },
  { nombre: 'lados que se alejan', from: N(600, 300), to: N(100, 300) },
  { nombre: 'un elemento justo en medio', from: N(100, 300), to: N(800, 300), otros: [N(430, 260)] },
  {
    nombre: 'hueco estrecho entre dos',
    from: N(100, 300),
    to: N(900, 300),
    otros: [N(430, 80, 180, 190), N(430, 340, 180, 190)],
  },
  {
    nombre: 'tres en columna, el del medio estorba',
    from: N(400, 60),
    to: N(400, 620),
    otros: [N(400, 340)],
  },
  { nombre: 'elementos superpuestos', from: N(300, 300), to: N(360, 340) },
  { nombre: 'muy juntos (menos que la zona segura)', from: N(300, 300), to: N(495, 300) },
  { nombre: 'diagonal cercana', from: N(200, 200), to: N(420, 380) },
  { nombre: 'destino arriba a la izquierda', from: N(700, 500), to: N(180, 120) },
  {
    nombre: 'dos estorbos en L',
    from: N(80, 500),
    to: N(880, 120),
    otros: [N(400, 420), N(620, 180)],
  },
];

let fallos = 0;
let totalDobleces = 0;
console.log('caso                                        atrav  roza  diag  dobleces');
console.log('─'.repeat(78));

for (const c of CASOS) {
  const otros = c.otros ?? [];
  // Obstáculos = todos los elementos, incluidos origen y destino (§1: tampoco
  // se pasa por debajo del propio).
  const obstaculos = [c.from, c.to, ...otros];
  const { pts } = elegirLados(c.from, c.to, obstaculos);
  const d = diagnosticar(pts, obstaculos);
  totalDobleces += d.dobleces;
  const mal = d.atraviesa > 0 || d.roza > 0 || d.diagonales > 0;
  if (mal) fallos++;
  console.log(
    `${c.nombre.padEnd(42)}${String(d.atraviesa).padStart(5)}${String(d.roza).padStart(6)}` +
      `${String(d.diagonales).padStart(6)}${String(d.dobleces).padStart(10)}  ${mal ? '← FALLA' : ''}`,
  );
}

console.log('─'.repeat(78));
console.log(`${CASOS.length} casos · ${totalDobleces} dobleces en total`);
console.log(fallos === 0 ? 'TODO 0/0/0 ✔' : `${fallos} CASOS FALLAN`);

// Dos costes distintos:
//  · elegir lados  → sólo al crear la línea y al reordenar (16 combinaciones)
//  · retrazar      → en cada movimiento del ratón, con los lados YA fijos (§4)
// El que tiene que estar en el orden de 1 ms es el segundo.
const REP = 200;

let t0 = performance.now();
for (let i = 0; i < REP; i++) {
  for (const c of CASOS) elegirLados(c.from, c.to, [c.from, c.to, ...(c.otros ?? [])]);
}
const msCrear = (performance.now() - t0) / (REP * CASOS.length);

// Con lados fijos, como pasa al arrastrar un elemento.
const fijos = CASOS.map((c) => {
  const obst = [c.from, c.to, ...(c.otros ?? [])];
  const { fromSide, toSide } = elegirLados(c.from, c.to, obst);
  return { c, obst, A: puntoDeLado(c.from, fromSide), B: puntoDeLado(c.to, toSide) };
});
t0 = performance.now();
for (let i = 0; i < REP; i++) {
  for (const f of fijos) trazar(f.A.p, f.A.dir, f.B.p, f.B.dir, f.obst);
}
const msMover = (performance.now() - t0) / (REP * CASOS.length);

console.log(`\nal crear la línea (elige lado): ${msCrear.toFixed(2)} ms`);
console.log(`al mover un elemento (retraza): ${msMover.toFixed(2)} ms  ${msMover < 2 ? '✔' : '← LENTO'}`);

/* ---- §9: 50 arrastres seguidos ---- */
// Si el número de puntos sube sin parar, hay una fuga.
{
  const from = N(100, 300);
  const to = N(700, 300);
  const obst = [from, to];
  let pts = elegirLados(from, to, obst).pts;
  const p0 = { ...pts[0] };
  const pn = { ...pts[pts.length - 1] };
  const dobleces0 = pts.length - 2;
  let maxPuntos = pts.length;
  // Semilla fija para que la prueba sea reproducible.
  let semilla = 12345;
  const rnd = () => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  for (let k = 0; k < 50; k++) {
    const idx = Math.floor(rnd() * (pts.length - 1));
    const eje = ejeDeTramo(pts[idx], pts[idx + 1]);
    const destino = pts[idx][eje] + (rnd() * 120 - 60);
    pts = limpiarSuave(moverTramo(pts, idx, destino));
    maxPuntos = Math.max(maxPuntos, pts.length);
  }
  pts = limpiar(forzarOrtogonal(pts)); // limpieza al soltar

  const d = diagnosticar(pts, obst);
  const fijo0 = Math.abs(pts[0].x - p0.x) < 0.01 && Math.abs(pts[0].y - p0.y) < 0.01;
  const fijoN =
    Math.abs(pts[pts.length - 1].x - pn.x) < 0.01 && Math.abs(pts[pts.length - 1].y - pn.y) < 0.01;

  console.log('\n50 arrastres seguidos');
  console.log(`  puntos: ${dobleces0 + 2} → ${pts.length} (pico ${maxPuntos})`);
  console.log(`  diagonales: ${d.diagonales} ${d.diagonales === 0 ? '✔' : '← FALLA'}`);
  console.log(`  extremo inicial fijo: ${fijo0 ? '✔' : '← SE MOVIÓ'}`);
  console.log(`  extremo final fijo:   ${fijoN ? '✔' : '← SE MOVIÓ'}`);
  if (d.diagonales || !fijo0 || !fijoN) fallos++;
}

/* ---- §2: carriles ---- */
{
  // Cuatro orígenes apilados y un muro en medio: todas tienen que rodear por el
  // mismo pasillo, que es justo cuando se ven como cuatro rayas casi paralelas.
  const muro = N(430, 60, 160, 620);
  const destino = N(820, 320);
  const origenes = [N(100, 90), N(100, 250), N(100, 410), N(100, 570)];
  const cajas = [...origenes, muro, destino];
  const rutas = origenes.map((o) => elegirLados(o, destino, cajas).pts);
  const carrilesX = (rs: typeof rutas) => {
    const xs = new Set<number>();
    for (const r of rs)
      for (let i = 1; i < r.length - 2; i++)
        if (Math.abs(r[i].x - r[i + 1].x) < 0.01) xs.add(Math.round(r[i].x));
    return xs.size;
  };
  const antes = carrilesX(rutas);
  const juntas = alinearCarriles(rutas, cajas);
  const despues = carrilesX(juntas);
  const sinRoturas = juntas.every((r, i) => diagnosticar(r, cajas).atraviesa === 0);
  console.log('\ncarriles (4 líneas al mismo destino)');
  console.log(`  rayas verticales distintas: ${antes} → ${despues} ${despues <= antes ? '✔' : '← PEOR'}`);
  console.log(`  ninguna atraviesa tras juntar: ${sinRoturas ? '✔' : '← FALLA'}`);
  if (!sinRoturas || despues > antes) fallos++;

  // Caso directo: cuatro tramos verticales dispersos por el mismo pasillo, que
  // es lo que se lee como un borrón. Deben acabar en la misma raya. Ojo: NO se
  // solapan a lo largo, que es justamente el caso más común.
  const dispersas: Point[][] = [
    [{ x: 100, y: 100 }, { x: 292, y: 100 }, { x: 292, y: 160 }, { x: 500, y: 160 }],
    [{ x: 100, y: 240 }, { x: 300, y: 240 }, { x: 300, y: 300 }, { x: 500, y: 300 }],
    [{ x: 100, y: 380 }, { x: 308, y: 380 }, { x: 308, y: 440 }, { x: 500, y: 440 }],
    [{ x: 100, y: 520 }, { x: 315, y: 520 }, { x: 315, y: 580 }, { x: 500, y: 580 }],
  ];
  const xsAntes = new Set(dispersas.map((r) => Math.round(r[1].x)));
  const juntadas = alinearCarriles(dispersas, []);
  const xsDespues = new Set(juntadas.map((r) => Math.round(r[1].x)));
  const ok = xsDespues.size === 1;
  console.log(`  4 tramos dispersos (sin solaparse): ${xsAntes.size} rayas → ${xsDespues.size} ${ok ? '✔' : '← FALLA'}`);
  if (!ok) fallos++;
}

/* ---- §6: imanes al mover un elemento ---- */
{
  const otro = N(600, 300); // 600..780 x 300..400
  // a) el borde de otro elemento a 3 px: se pega.
  const cerca = N(597, 90);
  const a = engancharElemento(cerca, [otro], []);
  const pegaBorde = Math.abs(a.dx - 3) < 0.01 && a.guias.some((g) => g.eje === 'x' && g.valor === 600);

  // b) «que su línea quede recta» gana a cualquier borde, aunque el borde esté
  //    más cerca: el ancla está a 4 px del centro y el borde a 3.
  const caja = N(500, 90); // centro x = 590
  const conAncla = engancharElemento(caja, [otro], [{ x: 594 }]);
  const ganaRecta = Math.abs(conAncla.dx - 4) < 0.01;

  // c) fuera del radio (5 px) no se pega nada.
  const lejos = N(560, 90); // centro 650, borde 560: nada a menos de 5
  const nada = engancharElemento(lejos, [otro], []);
  const noPega = nada.dx === 0 && nada.guias.length === 0;

  console.log('\nimanes al mover un elemento');
  console.log(`  se pega al borde de otro:        ${pegaBorde ? '✔' : '← FALLA'}`);
  console.log(`  «recta» gana al borde más cerca: ${ganaRecta ? '✔' : '← FALLA'}`);
  console.log(`  fuera del radio no engancha:     ${noPega ? '✔' : '← FALLA'}`);
  if (!pegaBorde || !ganaRecta || !noPega) fallos++;
}

console.log(fallos === 0 ? '\nTODO CORRECTO ✔' : `\n${fallos} FALLOS`);
