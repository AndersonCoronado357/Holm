// Geometría de conectores: puertos (salen de los vértices y lados), enrutado
// recto / ortogonal / curvo y puntos de borde. Portado y simplificado del motor
// de diagramas del proyecto de Apps Script.
import type { Point } from '../api/types';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Routing = 'straight' | 'ortho' | 'curved';
export type ArrowType = 'none' | 'arrow' | 'both' | 'open' | 'circle' | 'diamond';

export interface PortInfo {
  port: string; // 'n_0.000', 'e_0.500', …
  x: number;
  y: number;
  side: 'n' | 's' | 'e' | 'w';
}

// Lista de puertos de un elemento: 4 esquinas siempre + puntos intermedios por
// lado (hasta 5) según el tamaño. Los conectores "salen" de estos puntos.
export function nodePortList(n: Box): PortInfo[] {
  const list: PortInfo[] = [];
  const push = (port: string, x: number, y: number, side: PortInfo['side']) => list.push({ port, x, y, side });

  // Esquinas
  push('n_0.000', n.x, n.y, 'n');
  push('n_1.000', n.x + n.w, n.y, 'n');
  push('s_0.000', n.x, n.y + n.h, 's');
  push('s_1.000', n.x + n.w, n.y + n.h, 's');

  const portsH = Math.min(5, Math.max(1, Math.round(n.w / 44)));
  const portsV = Math.min(5, Math.max(1, Math.round(n.h / 44)));
  for (let i = 0; i < portsH; i++) {
    const t = (i + 1) / (portsH + 1);
    push('n_' + t.toFixed(3), n.x + n.w * t, n.y, 'n');
    push('s_' + t.toFixed(3), n.x + n.w * t, n.y + n.h, 's');
  }
  for (let i = 0; i < portsV; i++) {
    const t = (i + 1) / (portsV + 1);
    push('e_' + t.toFixed(3), n.x + n.w, n.y + n.h * t, 'e');
    push('w_' + t.toFixed(3), n.x, n.y + n.h * t, 'w');
  }
  return list;
}

// Puertos que se muestran como manijas de conexión (menos, para no saturar):
// 4 lados (medio) + 4 esquinas.
export function handlePorts(n: Box): PortInfo[] {
  return [
    { port: 'n_0.500', x: n.x + n.w / 2, y: n.y, side: 'n' },
    { port: 'e_0.500', x: n.x + n.w, y: n.y + n.h / 2, side: 'e' },
    { port: 's_0.500', x: n.x + n.w / 2, y: n.y + n.h, side: 's' },
    { port: 'w_0.500', x: n.x, y: n.y + n.h / 2, side: 'w' },
    { port: 'n_0.000', x: n.x, y: n.y, side: 'n' },
    { port: 'n_1.000', x: n.x + n.w, y: n.y, side: 'n' },
    { port: 's_0.000', x: n.x, y: n.y + n.h, side: 's' },
    { port: 's_1.000', x: n.x + n.w, y: n.y + n.h, side: 's' },
  ];
}

export function portPoint(n: Box, port: string): Point {
  if (!port) return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
  const side = port[0];
  let t = 0.5;
  const parsed = parseFloat(port.slice(2));
  if (!isNaN(parsed)) t = parsed;
  switch (side) {
    case 'n':
      return { x: n.x + n.w * t, y: n.y };
    case 's':
      return { x: n.x + n.w * t, y: n.y + n.h };
    case 'e':
      return { x: n.x + n.w, y: n.y + n.h * t };
    case 'w':
      return { x: n.x, y: n.y + n.h * t };
    default:
      return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
  }
}

// Vector unitario que apunta hacia AFUERA del nodo desde el puerto.
export function portDirection(port: string | null | undefined): Point | null {
  if (!port) return null;
  switch (port[0]) {
    case 'n':
      return { x: 0, y: -1 };
    case 's':
      return { x: 0, y: 1 };
    case 'e':
      return { x: 1, y: 0 };
    case 'w':
      return { x: -1, y: 0 };
    default:
      return null;
  }
}

// Puerto del nodo más cercano a (px,py). Si se conoce el nodo origen, se penaliza
// el lado opuesto para que la línea entre por el lado natural.
export function closestPort(n: Box, px: number, py: number, source?: Box | null): string {
  const list = nodePortList(n);
  let best = { d: Infinity, port: list[0].port };
  const tcx = n.x + n.w / 2;
  const tcy = n.y + n.h / 2;
  for (const p of list) {
    let d = Math.hypot(p.x - px, p.y - py);
    if (source) {
      const dx = source.x + source.w / 2 - tcx;
      const dy = source.y + source.h / 2 - tcy;
      if (p.side === 'e' && dx < 0) d += 55;
      if (p.side === 'w' && dx > 0) d += 55;
      if (p.side === 's' && dy < 0) d += 55;
      if (p.side === 'n' && dy > 0) d += 55;
    }
    if (d < best.d) best = { d, port: p.port };
  }
  return best.port;
}

// Punto de una conexión FLOTANTE. En vez de la intersección exacta con el borde
// (que cae en los vértices y se ve torcida), se elige el LADO que mira al otro
// nodo y el punto se desliza por ese lado siguiéndolo, sin llegar a las esquinas.
// Es lo que hace draw.io: la línea entra siempre perpendicular y limpia.
export function floatingPoint(n: Box, towards: Point): { p: Point; dir: Point } {
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  const dx = towards.x - cx;
  const dy = towards.y - cy;
  const inset = Math.min(14, n.w / 4, n.h / 4); // margen para no pegarse al vértice
  // Comparamos la pendiente con la de la diagonal para saber si manda el eje X o el Y.
  if (Math.abs(dy) * n.w <= Math.abs(dx) * n.h) {
    const side = dx >= 0 ? 1 : -1;
    const y = Math.max(n.y + inset, Math.min(towards.y, n.y + n.h - inset));
    return { p: { x: cx + (side * n.w) / 2, y }, dir: { x: side, y: 0 } };
  }
  const side = dy >= 0 ? 1 : -1;
  const x = Math.max(n.x + inset, Math.min(towards.x, n.x + n.w - inset));
  return { p: { x, y: cy + (side * n.h) / 2 }, dir: { x: 0, y: side } };
}

// Dirección hacia afuera según en qué lado del rectángulo cae el punto.
export function outwardDir(n: Box, p: Point): Point | null {
  const tol = 0.6;
  if (Math.abs(p.x - n.x) <= tol) return { x: -1, y: 0 };
  if (Math.abs(p.x - (n.x + n.w)) <= tol) return { x: 1, y: 0 };
  if (Math.abs(p.y - n.y) <= tol) return { x: 0, y: -1 };
  if (Math.abs(p.y - (n.y + n.h)) <= tol) return { x: 0, y: 1 };
  return null;
}

// Punto del borde del rectángulo en la línea centro → (tx,ty).
export function edgePoint(n: Box, tx: number, ty: number): Point {
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const half = n.w / 2;
  const halfH = n.h / 2;
  const tx1 = dx > 0 ? half / dx : dx < 0 ? -half / dx : Infinity;
  const ty1 = dy > 0 ? halfH / dy : dy < 0 ? -halfH / dy : Infinity;
  const t = Math.min(tx1, ty1);
  return { x: cx + dx * t, y: cy + dy * t };
}

function dedupe(pts: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.5 || Math.abs(last.y - p.y) > 0.5) out.push(p);
  }
  return out;
}

// Ruta ortogonal (codos rectos) entre dos extremos con sus direcciones de salida.
export function orthoPoints(
  x1: number,
  y1: number,
  dirA: Point | null,
  x2: number,
  y2: number,
  dirB: Point | null,
): Point[] {
  const offset = 18;
  let ax = x1;
  let ay = y1;
  if (dirA) {
    ax = x1 + dirA.x * offset;
    ay = y1 + dirA.y * offset;
  }
  let bx = x2;
  let by = y2;
  if (dirB) {
    bx = x2 + dirB.x * offset;
    by = y2 + dirB.y * offset;
  }
  const pts: Point[] = [{ x: x1, y: y1 }];
  if (dirA) pts.push({ x: ax, y: ay });

  if (dirA && dirB) {
    const aHorz = dirA.x !== 0;
    const bHorz = dirB.x !== 0;
    if (aHorz && bHorz) {
      // Si los dos stubs apuntan al mismo lado, el tramo vertical va más allá del
      // más lejano (rodea); si se enfrentan, va por el medio.
      const mx = dirA.x === dirB.x ? (dirA.x > 0 ? Math.max(ax, bx) : Math.min(ax, bx)) : (ax + bx) / 2;
      pts.push({ x: mx, y: ay }, { x: mx, y: by });
    } else if (!aHorz && !bHorz) {
      const my = dirA.y === dirB.y ? (dirA.y > 0 ? Math.max(ay, by) : Math.min(ay, by)) : (ay + by) / 2;
      pts.push({ x: ax, y: my }, { x: bx, y: my });
    } else if (aHorz) {
      pts.push({ x: bx, y: ay });
    } else {
      pts.push({ x: ax, y: by });
    }
  } else {
    // Sin direcciones: codo simple por el punto medio.
    const mx = (x1 + x2) / 2;
    pts.push({ x: mx, y: y1 }, { x: mx, y: y2 });
  }

  if (dirB) pts.push({ x: bx, y: by });
  pts.push({ x: x2, y: y2 });
  return dedupe(pts);
}

// Fuerza que una polilínea sea estrictamente ortogonal: inserta codos donde hay
// tramos diagonales y limpia los puntos colineales. El primer/último tramo
// respetan la dirección de salida del puerto.
export function makeOrthogonal(pts: Point[], dirA: Point | null, dirB: Point | null): Point[] {
  if (pts.length < 2) return pts;
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1];
    const cur = pts[i];
    if (Math.abs(prev.x - cur.x) < 0.5 || Math.abs(prev.y - cur.y) < 0.5) {
      out.push({ x: cur.x, y: cur.y });
      continue;
    }
    // Tramo diagonal: insertar un codo. El eje del primer tramo lo marca la
    // dirección del puerto de salida (o la del puerto de llegada al final).
    let horizFirst: boolean;
    if (i === 1 && dirA) horizFirst = dirA.x !== 0;
    else if (i === pts.length - 1 && dirB) horizFirst = dirB.x === 0;
    else horizFirst = Math.abs(cur.x - prev.x) >= Math.abs(cur.y - prev.y);
    out.push(horizFirst ? { x: cur.x, y: prev.y } : { x: prev.x, y: cur.y });
    out.push({ x: cur.x, y: cur.y });
  }
  // Quitar colineales consecutivos para no dejar codos invisibles.
  const cleaned: Point[] = [out[0]];
  for (let i = 1; i < out.length - 1; i++) {
    const a = out[i - 1];
    const p = out[i];
    const b = out[i + 1];
    const collinear =
      (Math.abs(a.x - p.x) < 0.5 && Math.abs(p.x - b.x) < 0.5) ||
      (Math.abs(a.y - p.y) < 0.5 && Math.abs(p.y - b.y) < 0.5);
    if (!collinear) cleaned.push(p);
  }
  if (out.length > 1) cleaned.push(out[out.length - 1]);
  return cleaned;
}

// Curva suave (Catmull-Rom → Bézier) que pasa por todos los puntos.
function smoothD(pts: Point[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  const tension = 6;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / tension;
    const c1y = p1.y + (p2.y - p0.y) / tension;
    const c2x = p2.x - (p3.x - p1.x) / tension;
    const c2y = p2.y - (p3.y - p1.y) / tension;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// Path SVG con esquinas ligeramente redondeadas para la ruta ortogonal.
function orthoRoundedD(pts: Point[]): string {
  if (pts.length < 3) return pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
  let d = `M${pts[0].x},${pts[0].y}`;
  const r = 16;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const a = pts[i - 1];
    const b = pts[i + 1];
    const v1x = a.x - p.x;
    const v1y = a.y - p.y;
    const l1 = Math.hypot(v1x, v1y) || 1;
    const v2x = b.x - p.x;
    const v2y = b.y - p.y;
    const l2 = Math.hypot(v2x, v2y) || 1;
    const r1 = Math.min(r, l1 / 2);
    const r2 = Math.min(r, l2 / 2);
    d += ` L${p.x + (v1x / l1) * r1},${p.y + (v1y / l1) * r1}`;
    d += ` Q${p.x},${p.y} ${p.x + (v2x / l2) * r2},${p.y + (v2y / l2) * r2}`;
  }
  d += ` L${pts[pts.length - 1].x},${pts[pts.length - 1].y}`;
  return d;
}

// Puntos efectivos de la línea (extremos + waypoints), ya ortogonalizados si
// hace falta. Es lo que se dibuja y también sobre lo que se ponen las manijas.
export function routePoints(
  routing: Routing,
  p1: Point,
  p2: Point,
  fromDir: Point | null,
  toDir: Point | null,
  waypoints: Point[] = [],
): Point[] {
  if (waypoints.length) {
    const pts = [p1, ...waypoints, p2];
    return routing === 'ortho' ? makeOrthogonal(pts, fromDir, toDir) : pts;
  }
  if (routing === 'ortho') return orthoPoints(p1.x, p1.y, fromDir, p2.x, p2.y, toDir);
  return [p1, p2];
}

// `d` a partir de los puntos ya calculados (respeta waypoints).
export function pathFromPoints(routing: Routing, pts: Point[], fromDir: Point | null, toDir: Point | null): string {
  if (pts.length < 2) return '';
  if (routing === 'ortho') return orthoRoundedD(pts);
  if (routing === 'curved') {
    // Sin quiebres: bézier que sale perpendicular al puerto. Con quiebres:
    // curva suave que pasa por todos ellos.
    if (pts.length === 2) return buildPathD('curved', pts[0].x, pts[0].y, pts[1].x, pts[1].y, fromDir, toDir);
    return smoothD(pts);
  }
  return pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
}

// Índice donde insertar un waypoint nuevo: el segmento más cercano al punto.
export function nearestSegment(pts: Point[], px: number, py: number): number {
  let best = { d: Infinity, idx: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    let t = len2 ? ((px - a.x) * vx + (py - a.y) * vy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t));
    if (d < best.d) best = { d, idx: i };
  }
  return best.idx;
}

// Construye el atributo `d` del path según el enrutado.
export function buildPathD(
  routing: Routing,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  fromDir: Point | null,
  toDir: Point | null,
): string {
  if (routing === 'straight') {
    return `M${x1},${y1} L${x2},${y2}`;
  }
  if (routing === 'ortho') {
    return orthoRoundedD(orthoPoints(x1, y1, fromDir, x2, y2, toDir));
  }
  // curved: bézier que sale perpendicular al lado del puerto.
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const curl = Math.min(Math.max(dist * 0.4, 40), 150);
  let cpx1: number;
  let cpy1: number;
  let cpx2: number;
  let cpy2: number;
  if (fromDir) {
    cpx1 = x1 + fromDir.x * curl;
    cpy1 = y1 + fromDir.y * curl;
  } else if (Math.abs(dx) > Math.abs(dy)) {
    cpx1 = x1 + Math.sign(dx) * curl;
    cpy1 = y1;
  } else {
    cpx1 = x1;
    cpy1 = y1 + Math.sign(dy) * curl;
  }
  if (toDir) {
    cpx2 = x2 + toDir.x * curl;
    cpy2 = y2 + toDir.y * curl;
  } else if (Math.abs(dx) > Math.abs(dy)) {
    cpx2 = x2 - Math.sign(dx) * curl;
    cpy2 = y2;
  } else {
    cpx2 = x2;
    cpy2 = y2 - Math.sign(dy) * curl;
  }
  return `M${x1},${y1} C${cpx1},${cpy1} ${cpx2},${cpy2} ${x2},${y2}`;
}
