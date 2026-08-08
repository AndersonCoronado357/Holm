// Trazado de las líneas que conectan elementos.
//
// Implementa las reglas de GUIA-LINEAS.md §1: no atravesar ni rozar elementos,
// doblar lo menos posible y, de lo que quede, la más corta. En vez de un
// buscador por rejilla se proponen rutas candidatas y se puntúan; gana la más
// barata. La búsqueda es por etapas porque generar todas siempre es lentísimo.
import type { Point } from '../api/types';
import type { Box } from './connectors';

export const ZONA_SEGURA = 26; // tramo recto pegado al elemento, intocable
export const AIRE = 20; // lo que se aparta al rodear
export const ROCE = 7; // menos que esto se lee como tocar
export const REJILLA = 8;

// Pesos de la puntuación. Atravesar cuesta un millón: ninguna combinación de
// dobleces y longitud puede compensarlo, que es lo que garantiza la regla 1.
const COSTE_ATRAVESAR = 1_000_000;
const COSTE_ROCE = 1_200;
const COSTE_DOBLEZ = 400;

export type Side = 'n' | 's' | 'e' | 'w';

export const SIDE_DIR: Record<Side, Point> = {
  n: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
};

/* ---------- geometría de apoyo ---------- */

const left = (b: Box) => b.x;
const right = (b: Box) => b.x + b.w;
const top = (b: Box) => b.y;
const bottom = (b: Box) => b.y + b.h;

// ¿El segmento ortogonal a-b entra en el INTERIOR de la caja? (bordes no cuentan:
// los extremos de la línea viven justo sobre el borde de su elemento)
function segCruza(a: Point, b: Point, box: Box): boolean {
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  return x2 > left(box) + 0.01 && x1 < right(box) - 0.01 && y2 > top(box) + 0.01 && y1 < bottom(box) - 0.01;
}

// ¿El punto está sobre el borde del rectángulo? Los extremos de la línea viven
// justo ahí: ese contacto es la conexión, no un roce.
function enBorde(p: Point, box: Box): boolean {
  const dentroX = p.x >= left(box) - 0.5 && p.x <= right(box) + 0.5;
  const dentroY = p.y >= top(box) - 0.5 && p.y <= bottom(box) + 0.5;
  if (!dentroX || !dentroY) return false;
  return (
    Math.abs(p.x - left(box)) < 0.5 ||
    Math.abs(p.x - right(box)) < 0.5 ||
    Math.abs(p.y - top(box)) < 0.5 ||
    Math.abs(p.y - bottom(box)) < 0.5
  );
}

// Distancia del segmento ortogonal a-b al rectángulo (0 si lo toca).
function segDist(a: Point, b: Point, box: Box): number {
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  const dx = Math.max(left(box) - x2, x1 - right(box), 0);
  const dy = Math.max(top(box) - y2, y1 - bottom(box), 0);
  return Math.hypot(dx, dy);
}

function largo(pts: Point[]): number {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
  return n;
}

// Quita puntos repetidos y colineales: no cambian la forma pero cuentan como
// dobleces y ensucian el conteo.
export function limpiar(pts: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) out.push({ ...p });
  }
  const res: Point[] = out.length ? [out[0]] : [];
  for (let i = 1; i < out.length - 1; i++) {
    const a = res[res.length - 1];
    const p = out[i];
    const b = out[i + 1];
    const colineal =
      (Math.abs(a.x - p.x) < 0.01 && Math.abs(p.x - b.x) < 0.01) ||
      (Math.abs(a.y - p.y) < 0.01 && Math.abs(p.y - b.y) < 0.01);
    if (!colineal) res.push(p);
  }
  if (out.length > 1) res.push(out[out.length - 1]);
  return res;
}

// Red de seguridad (§8): si dos puntos consecutivos no comparten fila ni
// columna, se mete el codo que falta. Sin esto aparecen diagonales sueltas.
export function forzarOrtogonal(pts: Point[]): Point[] {
  if (pts.length < 2) return pts;
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1];
    const cur = pts[i];
    const mismaCol = Math.abs(prev.x - cur.x) < 0.01;
    const mismaFila = Math.abs(prev.y - cur.y) < 0.01;
    if (!mismaCol && !mismaFila) out.push({ x: cur.x, y: prev.y });
    out.push({ ...cur });
  }
  return limpiar(out);
}

/* ---------- puntuación ---------- */

export interface Diagnostico {
  atraviesa: number;
  roza: number;
  diagonales: number;
  dobleces: number;
}

export function diagnosticar(pts: Point[], obstaculos: Box[]): Diagnostico {
  let atraviesa = 0;
  let roza = 0;
  let diagonales = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (Math.abs(a.x - b.x) > 0.01 && Math.abs(a.y - b.y) > 0.01) diagonales++;
    for (const box of obstaculos) {
      if (segCruza(a, b, box)) atraviesa++;
      // Si el tramo nace o muere en el borde de esa caja, ese contacto es la
      // conexión en sí; sólo se mira el roce contra las demás.
      else if (!enBorde(a, box) && !enBorde(b, box) && segDist(a, b, box) < ROCE) roza++;
    }
  }
  return { atraviesa, roza, diagonales, dobleces: Math.max(0, pts.length - 2) };
}

export function puntuar(pts: Point[], obstaculos: Box[]): number {
  const d = diagnosticar(pts, obstaculos);
  return (
    d.atraviesa * COSTE_ATRAVESAR + d.roza * COSTE_ROCE + d.dobleces * COSTE_DOBLEZ + largo(pts) + d.diagonales * COSTE_ATRAVESAR
  );
}

/* ---------- generación de candidatas ---------- */

function rutaZvertical(a: Point, b: Point, mx: number): Point[] {
  return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b];
}
function rutaZhorizontal(a: Point, b: Point, my: number): Point[] {
  return [a, { x: a.x, y: my }, { x: b.x, y: my }, b];
}

// Candidatas simples: directa y de un solo doblez.
function candidatasSimples(a: Point, b: Point): Point[][] {
  const out: Point[][] = [];
  if (Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01) out.push([a, b]);
  out.push([a, { x: b.x, y: a.y }, b]); // primero horizontal
  out.push([a, { x: a.x, y: b.y }, b]); // primero vertical
  out.push(rutaZvertical(a, b, (a.x + b.x) / 2));
  out.push(rutaZhorizontal(a, b, (a.y + b.y) / 2));
  return out;
}

// Carriles candidatos: los pasillos que hay junto a cada estorbo, con dos
// márgenes (uno cómodo y otro mínimo: a veces el único hueco es estrecho).
function carriles(cajas: Box[]): { xs: number[]; ys: number[] } {
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (const m of [AIRE, ROCE + 1]) {
    for (const c of cajas) {
      xs.add(left(c) - m);
      xs.add(right(c) + m);
      ys.add(top(c) - m);
      ys.add(bottom(c) + m);
    }
  }
  if (cajas.length) {
    xs.add(Math.min(...cajas.map(left)) - AIRE);
    xs.add(Math.max(...cajas.map(right)) + AIRE);
    ys.add(Math.min(...cajas.map(top)) - AIRE);
    ys.add(Math.max(...cajas.map(bottom)) + AIRE);
  }
  return { xs: [...xs], ys: [...ys] };
}

// Etapa 2: rodeos y pasillos con un solo carril (dos dobleces).
function candidatasPasillo(a: Point, b: Point, cajas: Box[]): Point[][] {
  const { xs, ys } = carriles(cajas);
  const out: Point[][] = [];
  for (const mx of xs) out.push(rutaZvertical(a, b, mx));
  for (const my of ys) out.push(rutaZhorizontal(a, b, my));
  return out;
}

// Etapa 3: rodeos en L larga (tres dobleces). Son cuadráticas, así que sólo se
// generan cuando las anteriores no han conseguido una ruta limpia.
function candidatasRodeo(a: Point, b: Point, cajas: Box[]): Point[][] {
  const { xs, ys } = carriles(cajas);
  const out: Point[][] = [];
  for (const mx of xs) {
    for (const my of ys) {
      out.push([a, { x: mx, y: a.y }, { x: mx, y: my }, { x: b.x, y: my }, b]);
      out.push([a, { x: a.x, y: my }, { x: mx, y: my }, { x: mx, y: b.y }, b]);
    }
  }
  return out;
}

/**
 * Traza la línea entre dos puntos de conexión ya elegidos.
 * `p1`/`p2` están sobre el borde de su elemento y `d1`/`d2` apuntan hacia afuera.
 * Los primeros ZONA_SEGURA píxeles salen rectos y no se tocan (§1).
 */
export function trazar(p1: Point, d1: Point, p2: Point, d2: Point, obstaculos: Box[]): Point[] {
  return trazarConCoste(p1, d1, p2, d2, obstaculos).pts;
}

// Igual que `trazar` pero devuelve también el coste, para no tener que volver a
// puntuar desde fuera.
export function trazarConCoste(
  p1: Point,
  d1: Point,
  p2: Point,
  d2: Point,
  obstaculos: Box[],
  maxEtapa: 1 | 2 | 3 = 3,
): { pts: Point[]; coste: number } {
  const a = { x: p1.x + d1.x * ZONA_SEGURA, y: p1.y + d1.y * ZONA_SEGURA };
  const b = { x: p2.x + d2.x * ZONA_SEGURA, y: p2.y + d2.y * ZONA_SEGURA };

  let mejor: Point[] | null = null;
  let mejorCoste = Infinity;
  const evaluar = (medias: Point[][]) => {
    for (const m of medias) {
      const completa = forzarOrtogonal(limpiar([p1, a, ...m.slice(1, -1), b, p2]));
      const coste = puntuar(completa, obstaculos);
      if (coste < mejorCoste) {
        mejorCoste = coste;
        mejor = completa;
      }
    }
  };

  // Búsqueda por etapas: en cuanto hay una ruta que no atraviesa ni roza, se
  // para. Generar todas siempre sale carísimo y esto corre en cada movimiento.
  evaluar(candidatasSimples(a, b));
  if (mejorCoste < COSTE_ROCE || maxEtapa < 2) return { pts: mejor!, coste: mejorCoste };

  evaluar(candidatasPasillo(a, b, obstaculos));
  if (mejorCoste < COSTE_ROCE || maxEtapa < 3) return { pts: mejor!, coste: mejorCoste };

  evaluar(candidatasRodeo(a, b, obstaculos));
  return { pts: mejor!, coste: mejorCoste };
}

/* ---------- dónde conectó el usuario ---------- */

/** Cuánto del elemento, medido desde el centro, cuenta como «lo soltó al medio». */
const NUCLEO = 0.34;

/**
 * Traduce el punto donde el usuario soltó a un puerto concreto, CONSERVANDO la
 * altura exacta a la que conectó (no el centro del lado).
 *
 * Devuelve null si soltó en el núcleo del elemento: ahí no está señalando ningún
 * sitio en particular, así que decide el trazado (§4).
 */
export function puertoEnPunto(n: Box, p: Point): string | null {
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  const fx = n.w ? (p.x - cx) / (n.w / 2) : 0; // -1..1
  const fy = n.h ? (p.y - cy) / (n.h / 2) : 0;
  if (Math.abs(fx) < NUCLEO && Math.abs(fy) < NUCLEO) return null;

  // El lado al que apunta, y el reparto exacto a lo largo de ese lado.
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const lado: Side = Math.abs(fx) >= Math.abs(fy) ? (fx >= 0 ? 'e' : 'w') : fy >= 0 ? 's' : 'n';
  const t = lado === 'e' || lado === 'w' ? clamp01((p.y - n.y) / (n.h || 1)) : clamp01((p.x - n.x) / (n.w || 1));
  return `${lado}_${t.toFixed(3)}`;
}

/** El puerto que corresponde a un lado, conservando el reparto si ya había uno. */
export function puertoDeLado(side: Side, puertoPrevio?: string): string {
  const t = puertoPrevio && puertoPrevio[1] === '_' ? parseFloat(puertoPrevio.slice(2)) : NaN;
  return `${side}_${(Number.isFinite(t) ? t : 0.5).toFixed(3)}`;
}

/* ---------- edición por tramos (§5) ---------- */

export type Eje = 'x' | 'y';

// El eje en el que se desliza un tramo: el perpendicular a su dirección.
export function ejeDeTramo(a: Point, b: Point): Eje {
  return Math.abs(a.y - b.y) < 0.01 ? 'y' : 'x';
}

/**
 * Desliza el tramo `idx` (entre pts[idx] y pts[idx+1]) hasta la coordenada
 * `valor` en su eje perpendicular.
 *
 * Los puntos de conexión (primero y último) NO se mueven nunca (§8). Si el tramo
 * toca uno de ellos hay que insertarle un codo justo al lado y mover de ahí en
 * adelante: la forma pasa de L a Z, que es lo correcto. Mover sólo el otro
 * extremo deformaría el tramo y produciría retrocesos.
 */
export function moverTramo(pts: Point[], idx: number, valor: number): Point[] {
  if (idx < 0 || idx >= pts.length - 1) return pts;
  const eje = ejeDeTramo(pts[idx], pts[idx + 1]);
  const out = pts.map((p) => ({ ...p }));
  let i = idx;
  // Pegado al punto de conexión inicial: se le mete un codo al lado.
  if (i === 0) {
    out.splice(1, 0, { ...out[0] });
    i = 1;
  }
  // Pegado al final: idem por el otro lado.
  if (i + 1 === out.length - 1) {
    out.splice(out.length - 1, 0, { ...out[out.length - 1] });
  }
  out[i][eje] = valor;
  out[i + 1][eje] = valor;
  return out;
}

// Durante el arrastre sólo se quitan los puntos repetidos exactos. Limpiar
// colineales en cada repintado borraría los dobleces recién hechos (§8).
export function limpiarSuave(pts: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) out.push({ ...p });
  }
  return out;
}

/* ---------- asistencias de alineación (§6) ---------- */

export const IMAN = 5; // radio de enganche, corto a propósito

export interface Enganche {
  valor: number;
  /** Coordenada de la guía a dibujar, o null si no se enganchó a nada. */
  guia: number | null;
}

/**
 * Engancha el tramo que se está arrastrando a lo que tenga cerca. El orden es
 * por utilidad y es determinista: si «recta» está a tiro, gana. Competir por
 * distancia entre candidatos de distinto tipo hace que el borde de un elemento
 * gane por dos píxeles y te lleve al sitio equivocado (§6).
 */
export function engancharTramo(
  valor: number,
  eje: Eje,
  pts: Point[],
  idx: number,
  otras: Point[][],
  cajas: Box[],
): Enganche {
  const grupos: number[][] = [[], [], [], []];

  // 1) dejar la línea recta: alinearse con alguno de sus puntos de conexión
  grupos[0].push(pts[0][eje], pts[pts.length - 1][eje]);

  // 2) cuadrar con otro tramo de ella misma (quita los escaloncitos)
  for (let i = 0; i < pts.length - 1; i++) {
    if (i === idx) continue;
    if (ejeDeTramo(pts[i], pts[i + 1]) === eje) grupos[1].push(pts[i][eje]);
  }

  // 3) tramos de otras líneas. Los muy cortos no cuentan: con demasiados imanes
  //    cualquier posición cae en alguno y el tramo se siente agarrotado.
  for (const r of otras) {
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i];
      const b = r[i + 1];
      if (ejeDeTramo(a, b) !== eje) continue;
      const largoTramo = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (largoTramo < 24) continue;
      grupos[2].push(a[eje]);
    }
  }

  // 4) bordes y centro de los elementos
  for (const c of cajas) {
    if (eje === 'x') grupos[3].push(c.x, c.x + c.w, c.x + c.w / 2);
    else grupos[3].push(c.y, c.y + c.h, c.y + c.h / 2);
  }

  for (const grupo of grupos) {
    let mejor: number | null = null;
    for (const cand of grupo) {
      if (Math.abs(cand - valor) > IMAN) continue;
      if (mejor === null || Math.abs(cand - valor) < Math.abs(mejor - valor)) mejor = cand;
    }
    if (mejor !== null) return { valor: mejor, guia: mejor };
  }
  return { valor, guia: null };
}

/**
 * Enganche al MOVER UN ELEMENTO (§6). Por orden: primero la posición en la que
 * alguna de sus líneas queda recta —y eso gana a cualquier borde—, después los
 * bordes y centros de los demás elementos.
 *
 * Devuelve el desplazamiento corregido y las guías que hay que pintar.
 */
export function engancharElemento(
  caja: Box,
  otros: Box[],
  anclas: { x?: number; y?: number }[],
): { dx: number; dy: number; guias: { eje: Eje; valor: number }[] } {
  const guias: { eje: Eje; valor: number }[] = [];
  let dx = 0;
  let dy = 0;

  const bordes = (eje: Eje) => (eje === 'x' ? [caja.x, caja.x + caja.w / 2, caja.x + caja.w] : [caja.y, caja.y + caja.h / 2, caja.y + caja.h]);

  for (const eje of ['x', 'y'] as Eje[]) {
    const mios = bordes(eje);
    // 1) que una de sus líneas quede recta: alinear el CENTRO con el ancla.
    const centro = eje === 'x' ? caja.x + caja.w / 2 : caja.y + caja.h / 2;
    let mejor: { d: number; valor: number; propio: number } | null = null;
    for (const a of anclas) {
      const v = eje === 'x' ? a.x : a.y;
      if (v == null) continue;
      const d = v - centro;
      if (Math.abs(d) <= IMAN && (!mejor || Math.abs(d) < Math.abs(mejor.d))) mejor = { d, valor: v, propio: centro };
    }
    // 2) sólo si no había ninguna recta a tiro, bordes y centros de los demás.
    if (!mejor) {
      for (const o of otros) {
        const suyos = eje === 'x' ? [o.x, o.x + o.w / 2, o.x + o.w] : [o.y, o.y + o.h / 2, o.y + o.h];
        for (const s of suyos) {
          for (const m of mios) {
            const d = s - m;
            if (Math.abs(d) <= IMAN && (!mejor || Math.abs(d) < Math.abs(mejor.d))) mejor = { d, valor: s, propio: m };
          }
        }
      }
    }
    if (mejor) {
      if (eje === 'x') dx = mejor.d;
      else dy = mejor.d;
      guias.push({ eje, valor: mejor.valor });
    }
  }
  return { dx, dy, guias };
}

/* ---------- carriles compartidos (§2) ---------- */

/**
 * Lleva a una misma raya los tramos del mismo eje que van juntos: cuatro líneas
 * por el mismo pasillo, cada una por su cuenta, se leen como un borrón.
 *
 * No se exige que los tramos se solapen a lo largo (el caso típico es justo que
 * no se solapen), y el cálculo no depende del orden: el carril sale del grupo y
 * de nada más, para que mover un elemento no recoloque líneas que no tocaste.
 */
export function alinearCarriles(rutas: Point[][], cajas: Box[], radio = 60): Point[][] {
  const salida = rutas.map((r) => r.map((p) => ({ ...p })));
  for (const eje of ['x', 'y'] as Eje[]) {
    // Recolectar tramos candidatos: los de este eje, sin contar los pegados a
    // los extremos (esos son la zona segura y no se tocan).
    const tramos: { ruta: number; i: number; valor: number }[] = [];
    salida.forEach((r, ri) => {
      for (let i = 1; i < r.length - 2; i++) {
        if (ejeDeTramo(r[i], r[i + 1]) !== eje) continue;
        const largoTramo = Math.abs(r[i].x - r[i + 1].x) + Math.abs(r[i].y - r[i + 1].y);
        if (largoTramo < 10) continue; // umbral bajo: si no, quedan sueltas al lado de las agrupadas
        tramos.push({ ruta: ri, i, valor: r[i][eje] });
      }
    });
    if (tramos.length < 2) continue;

    // Agrupar por cercanía en el eje.
    const orden = [...tramos].sort((a, b) => a.valor - b.valor);
    const grupos: (typeof tramos)[] = [];
    let actual: typeof tramos = [];
    for (const t of orden) {
      if (actual.length && t.valor - actual[actual.length - 1].valor > radio) {
        grupos.push(actual);
        actual = [];
      }
      actual.push(t);
    }
    if (actual.length) grupos.push(actual);

    for (const g of grupos) {
      if (g.length < 2) continue;
      const medio = g.reduce((s, t) => s + t.valor, 0) / g.length;
      // Si el carril común cae dentro de un elemento no se descarta el grupo
      // entero: se prueba el del medio y, si no vale, la posición de cada una.
      const libre = (v: number) =>
        !cajas.some((c) => (eje === 'x' ? v > c.x && v < c.x + c.w : v > c.y && v < c.y + c.h));
      const carril = libre(medio) ? medio : (g.map((t) => t.valor).find(libre) ?? null);
      if (carril === null) continue;
      for (const t of g) {
        salida[t.ruta][t.i][eje] = carril;
        salida[t.ruta][t.i + 1][eje] = carril;
      }
    }
  }
  return salida.map((r) => forzarOrtogonal(r));
}

/* ---------- elección del lado al crear (§4) ---------- */

export function puntoDeLado(n: Box, side: Side, t = 0.5): { p: Point; dir: Point } {
  switch (side) {
    case 'n':
      return { p: { x: n.x + n.w * t, y: n.y }, dir: SIDE_DIR.n };
    case 's':
      return { p: { x: n.x + n.w * t, y: n.y + n.h }, dir: SIDE_DIR.s };
    case 'e':
      return { p: { x: n.x + n.w, y: n.y + n.h * t }, dir: SIDE_DIR.e };
    default:
      return { p: { x: n.x, y: n.y + n.h * t }, dir: SIDE_DIR.w };
  }
}

/**
 * Elige los lados de salida y llegada PROBANDO todas las combinaciones y
 * quedándose con la que mejor puntúa (§4). Una regla de posición da rodeos
 * enormes cuando el otro elemento está justo pegado.
 * `soloCostados` para elementos con filas (tablas): nunca por arriba ni abajo.
 */
export function elegirLados(
  from: Box,
  to: Box,
  obstaculos: Box[],
  soloCostados = { from: false, to: false },
): { fromSide: Side; toSide: Side; pts: Point[] } {
  const ladosFrom: Side[] = soloCostados.from ? ['e', 'w'] : ['e', 'w', 'n', 's'];
  const ladosTo: Side[] = soloCostados.to ? ['e', 'w'] : ['e', 'w', 'n', 's'];
  type Cand = { fromSide: Side; toSide: Side; pts: Point[]; coste: number };
  const pasada = (maxEtapa: 1 | 2 | 3, soloEstas?: Cand[]): Cand => {
    let mejor: Cand | null = null;
    const combis: [Side, Side][] = soloEstas
      ? soloEstas.map((c) => [c.fromSide, c.toSide])
      : ladosFrom.flatMap((fs) => ladosTo.map((ts) => [fs, ts] as [Side, Side]));
    for (const [fs, ts] of combis) {
      const A = puntoDeLado(from, fs);
      const B = puntoDeLado(to, ts);
      const { pts, coste } = trazarConCoste(A.p, A.dir, B.p, B.dir, obstaculos, maxEtapa);
      if (!mejor || coste < mejor.coste) mejor = { fromSide: fs, toSide: ts, pts, coste };
      // Limpia y recta: no hay nada mejor posible, se corta.
      if (mejor.coste < COSTE_DOBLEZ) return mejor;
    }
    return mejor!;
  };

  // Búsqueda por etapas también aquí: probar las 16 combinaciones con las rutas
  // baratas y sólo profundizar si ninguna sale limpia (§1).
  const rapida = pasada(2);
  if (rapida.coste < COSTE_ROCE) return rapida;
  const honda = pasada(3);
  return honda.coste <= rapida.coste ? honda : rapida;
}
