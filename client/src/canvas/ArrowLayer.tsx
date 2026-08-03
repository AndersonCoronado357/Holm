import { useMemo, useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from 'react';
import type { CanvasElement, ElementContent, Point } from '../api/types';
import {
  type ArrowType,
  type Routing,
  floatingPoint,
  nearestSegment,
  pathFromPoints,
  portDirection,
  portPoint,
  routePoints,
} from './connectors';
import { hitTarget } from './hit';
import {
  type Eje,
  alinearCarriles,
  ejeDeTramo,
  engancharTramo,
  forzarOrtogonal,
  limpiar,
  limpiarSuave,
  moverTramo,
  puertoEnPunto,
  trazar,
} from './lineRouter';

interface Props {
  arrows: CanvasElement[];
  nodeById: Map<string, CanvasElement>;
  scale: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  patchLocal: (id: string, patch: Partial<CanvasElement>) => void;
  persist: (id: string, patch: Partial<CanvasElement>) => void;
  toWorld: (clientX: number, clientY: number) => Point;
}

type Drag =
  | { mode: 'end'; which: 1 | 2 }
  | { mode: 'body'; sx: number; sy: number; o: { x1: number; y1: number; x2: number; y2: number } }
  // Arrastre de un tramo: se guarda la ruta de partida (puntos absolutos, §8) y
  // qué tramo se agarró, según lo que el usuario VE.
  | { mode: 'tramo'; idx: number; base: Point[] };

// Enrutado efectivo (con compatibilidad hacia conectores viejos que usaban lineShape).
function routingOf(c: ElementContent): Routing {
  if (c.routing) return c.routing;
  if (c.lineShape === 'curved') return 'curved';
  return 'straight';
}

export function ArrowLayer({ arrows, nodeById, scale, selectedId, onSelect, patchLocal, persist, toWorld }: Props) {
  const drag = useRef<{ id: string; d: Drag; last?: Partial<CanvasElement> } | null>(null);

  function boxOf(id?: string): CanvasElement | undefined {
    return id ? nodeById.get(id) : undefined;
  }

  // Todos los nodos son obstáculos: la línea no debe pasar por debajo de ninguno
  // (GUIA-LINEAS §1), tampoco de los suyos propios.
  const obstaculos = useMemo(() => [...nodeById.values()].map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h })), [nodeById]);
  // Guía de alineación que se muestra mientras se arrastra un tramo (§6).
  const [guia, setGuia] = useState<{ eje: Eje; valor: number | null } | null>(null);

  // Extremos + direcciones. El punto de conexión queda FIJO en el lado con el que
  // se creó la línea y NO se recalcula al mover (§4): si el trazado eligiera el
  // mejor lado en cada repintado, el punto saltaría de un lado al opuesto
  // mientras arrastras y se sentiría descontrolado.
  function geom(el: CanvasElement) {
    const c = el.content;
    const from = boxOf(c.fromId);
    const to = boxOf(c.toId);
    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;
    let fromDir: Point | null = null;
    let toDir: Point | null = null;

    // Referencia hacia la que "mira" cada extremo flotante: el punto fijo del
    // otro lado si lo hay, o el centro del otro nodo.
    const wpA = c.waypoints?.[0];
    const wpB = c.waypoints?.[c.waypoints.length - 1];
    const refForFrom: Point = wpA
      ? wpA
      : to
        ? c.toPort
          ? portPoint(to, c.toPort)
          : { x: to.x + to.w / 2, y: to.y + to.h / 2 }
        : { x: c.x2 ?? 0, y: c.y2 ?? 0 };
    const refForTo: Point = wpB
      ? wpB
      : from
        ? c.fromPort
          ? portPoint(from, c.fromPort)
          : { x: from.x + from.w / 2, y: from.y + from.h / 2 }
        : { x: c.x1 ?? 0, y: c.y1 ?? 0 };

    if (from) {
      if (c.fromPort) {
        const p = portPoint(from, c.fromPort);
        x1 = p.x;
        y1 = p.y;
        fromDir = portDirection(c.fromPort);
      } else {
        // Línea antigua sin lado guardado: se deduce una vez, con el mismo
        // criterio, y a partir de ahí manda el guardado.
        const f = floatingPoint(from, refForFrom);
        x1 = f.p.x;
        y1 = f.p.y;
        fromDir = f.dir;
      }
    } else {
      x1 = c.x1 ?? 0;
      y1 = c.y1 ?? 0;
    }

    if (to) {
      if (c.toPort) {
        const p = portPoint(to, c.toPort);
        x2 = p.x;
        y2 = p.y;
        toDir = portDirection(c.toPort);
      } else {
        const f = floatingPoint(to, refForTo);
        x2 = f.p.x;
        y2 = f.p.y;
        toDir = f.dir;
      }
    } else {
      x2 = c.x2 ?? 100;
      y2 = c.y2 ?? 0;
    }
    return { x1, y1, x2, y2, fromDir, toDir };
  }

  // Ruta visible de un conector: la que se dibuja y sobre la que se ponen los
  // tiradores. Sin ajustes del usuario manda el trazado automático; con ajustes,
  // manda lo suyo (§3: el automático no pisa lo que el usuario hizo a mano).
  function rutaDe(el: CanvasElement): Point[] {
    const g = geom(el);
    const wps = el.content.waypoints ?? [];
    const routing = routingOf(el.content);
    if (routing === 'ortho' && g.fromDir && g.toDir) {
      if (!wps.length) return trazar({ x: g.x1, y: g.y1 }, g.fromDir, { x: g.x2, y: g.y2 }, g.toDir, obstaculos);
      return forzarOrtogonal([{ x: g.x1, y: g.y1 }, ...wps, { x: g.x2, y: g.y2 }]);
    }
    return routePoints(routing, { x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 }, g.fromDir, g.toDir, wps);
  }

  // Las rutas de todas las líneas, ya agrupadas por carriles. Las que el usuario
  // ha ajustado a mano quedan fuera de la agrupación: lo suyo no se toca (§3).
  const rutasConCarriles = useMemo(() => {
    const base = arrows.map((a) => rutaDe(a));
    const libres = arrows.map((a) => (a.content.waypoints?.length ?? 0) === 0);
    const juntadas = alinearCarriles(
      base.map((r, i) => (libres[i] ? r : [])),
      obstaculos,
    );
    return base.map((r, i) => (libres[i] && juntadas[i]?.length ? juntadas[i] : r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrows, nodeById, obstaculos]);

  // ---- arrastre del cuerpo (solo conectores totalmente libres) ----
  function onBodyDown(e: RPointerEvent, el: CanvasElement) {
    e.stopPropagation();
    onSelect(el.id);
    if (el.locked || el.content.fromId || el.content.toId) return;
    const g = geom(el);
    drag.current = { id: el.id, d: { mode: 'body', sx: e.clientX, sy: e.clientY, o: g } };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  // ---- arrastre de un extremo: se desancla y se puede re-anclar en otro nodo ----
  function onEndDown(e: RPointerEvent, el: CanvasElement, which: 1 | 2, x: number, y: number) {
    e.stopPropagation();
    e.preventDefault();
    onSelect(el.id);
    // Desanclar ese extremo: pasa a coordenadas libres desde su posición actual.
    const patch: Partial<CanvasElement> = {
      content:
        which === 1
          ? { ...el.content, fromId: undefined, fromPort: undefined, x1: Math.round(x), y1: Math.round(y) }
          : { ...el.content, toId: undefined, toPort: undefined, x2: Math.round(x), y2: Math.round(y) },
    };
    patchLocal(el.id, patch);
    drag.current = { id: el.id, d: { mode: 'end', which }, last: patch };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  // ---- edición por tramos (§5) ----
  // Se agarra el tirador que hay en medio de cada tramo y se desliza en su eje
  // perpendicular. Los puntos de conexión no se mueven: si el tramo toca uno,
  // `moverTramo` le inserta un codo al lado (la L pasa a Z).
  function onTramoDown(e: RPointerEvent, el: CanvasElement, idx: number, pts: Point[]) {
    e.stopPropagation();
    e.preventDefault();
    onSelect(el.id);
    if (el.locked) return;
    drag.current = { id: el.id, d: { mode: 'tramo', idx, base: pts.map((p) => ({ ...p })) } };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  // Doble clic en un tirador: ese tramo vuelve al automático.
  function onTramoDouble(e: RMouseEvent, el: CanvasElement, idx: number, pts: Point[]) {
    e.stopPropagation();
    // Quitar los ajustes que definen ese tramo (los puntos intermedios que lo
    // tocan). Si la línea se queda sin ajustes, vuelve al trazado automático.
    const wps = el.content.waypoints ?? [];
    if (!wps.length) return;
    const dentro = (p: Point) =>
      !(
        (Math.abs(p.x - pts[idx].x) < 0.5 && Math.abs(p.y - pts[idx].y) < 0.5) ||
        (Math.abs(p.x - pts[idx + 1].x) < 0.5 && Math.abs(p.y - pts[idx + 1].y) < 0.5)
      );
    const patch: Partial<CanvasElement> = { content: { ...el.content, waypoints: wps.filter(dentro) } };
    patchLocal(el.id, patch);
    persist(el.id, patch);
  }

  function onMove(e: RPointerEvent) {
    const cur = drag.current;
    if (!cur) return;
    const el = arrows.find((a) => a.id === cur.id);
    if (!el) return;
    if (cur.d.mode === 'tramo') {
      const w = toWorld(e.clientX, e.clientY);
      const base = cur.d.base;
      const idx = cur.d.idx;
      const eje = ejeDeTramo(base[idx], base[idx + 1]);
      // Asistencia de alineación: se pega a lo que tenga cerca y se guarda la
      // guía para dibujarla (§6).
      const otras = arrows.filter((a) => a.id !== el.id).map((a) => rutaDe(a));
      const eng = engancharTramo(eje === 'x' ? w.x : w.y, eje, base, idx, otras, obstaculos);
      setGuia({ eje, valor: eng.guia });
      // Durante el arrastre sólo se quitan repetidos exactos: limpiar colineales
      // aquí borraría los dobleces recién hechos (§8).
      const nuevos = limpiarSuave(moverTramo(base, idx, Math.round(eng.valor)));
      const patch = { content: { ...el.content, waypoints: nuevos.slice(1, -1) } };
      cur.last = patch;
      patchLocal(cur.id, patch);
      return;
    }
    if (cur.d.mode === 'end') {
      const w = toWorld(e.clientX, e.clientY);
      const patch = {
        content:
          cur.d.which === 1
            ? { ...el.content, x1: Math.round(w.x), y1: Math.round(w.y) }
            : { ...el.content, x2: Math.round(w.x), y2: Math.round(w.y) },
      };
      cur.last = patch;
      patchLocal(cur.id, patch);
    } else {
      const dx = (e.clientX - cur.d.sx) / scale;
      const dy = (e.clientY - cur.d.sy) / scale;
      const o = cur.d.o;
      const patch = {
        content: {
          ...el.content,
          x1: Math.round(o.x1 + dx),
          y1: Math.round(o.y1 + dy),
          x2: Math.round(o.x2 + dx),
          y2: Math.round(o.y2 + dy),
        },
      };
      cur.last = patch;
      patchLocal(cur.id, patch);
    }
  }

  function onUp(e: RPointerEvent) {
    const cur = drag.current;
    setGuia(null);
    if (!cur) {
      return;
    }
    const el = arrows.find((a) => a.id === cur.id);
    // Al soltar sí se limpian los colineales: durante el arrastre borraría los
    // dobleces recién hechos (§8).
    if (cur.d.mode === 'tramo' && el) {
      const pts = limpiar(forzarOrtogonal(rutaDe(el)));
      const patch: Partial<CanvasElement> = { content: { ...el.content, waypoints: pts.slice(1, -1) } };
      patchLocal(el.id, patch);
      persist(el.id, patch);
      drag.current = null;
      return;
    }
    if (cur.d.mode === 'end' && el) {
      // ¿Se soltó encima de un nodo? Se re-ancla. Usamos hitTarget porque la
      // propia manija va bajo el cursor y taparía al nodo de abajo.
      const hit = hitTarget(e.clientX, e.clientY);
      const which = cur.d.which;
      const otherId = which === 1 ? el.content.toId : el.content.fromId;
      const node = hit.nodeId ? nodeById.get(hit.nodeId) : undefined;
      if (node && hit.nodeId !== otherId) {
        // Queda clavada donde soltaste: si fue sobre un puerto, ese; si fue sobre
        // el elemento, a la altura exacta de la suelta (no al centro del lado).
        const w = toWorld(e.clientX, e.clientY);
        const puerto = hit.port ?? puertoEnPunto(node, w) ?? undefined;
        const content = { ...el.content };
        if (which === 1) {
          content.fromId = hit.nodeId!;
          content.x1 = undefined;
          content.y1 = undefined;
          if (puerto) content.fromPort = puerto;
          else delete content.fromPort;
        } else {
          content.toId = hit.nodeId!;
          content.x2 = undefined;
          content.y2 = undefined;
          if (puerto) content.toPort = puerto;
          else delete content.toPort;
        }
        // El trazado automático vuelve a mandar sobre esta línea.
        content.waypoints = [];
        const patch: Partial<CanvasElement> = { content };
        patchLocal(el.id, patch);
        persist(el.id, patch);
        drag.current = null;
        return;
      }
    }
    if (cur.last) persist(cur.id, cur.last);
    drag.current = null;
  }

  return (
    <svg
      style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', zIndex: 1 }}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      <defs>
        {arrows.map((el) => (
          <ArrowMarkers key={`mk-${el.id}`} id={el.id} color={el.color ?? 'var(--conn)'} type={(el.content.arrowType ?? 'arrow') as ArrowType} />
        ))}
      </defs>
      {/* Guía de alineación: muestra con qué se está cuadrando el tramo (§6). */}
      {guia?.valor != null && (
        <line
          x1={guia.eje === 'x' ? guia.valor : -100000}
          y1={guia.eje === 'x' ? -100000 : guia.valor}
          x2={guia.eje === 'x' ? guia.valor : 100000}
          y2={guia.eje === 'x' ? 100000 : guia.valor}
          stroke="var(--color-accent-500)"
          strokeWidth={1 / scale}
          strokeDasharray={`${4 / scale} ${4 / scale}`}
          opacity={0.7}
          style={{ pointerEvents: 'none' }}
        />
      )}
      {arrows.map((el, ai) => {
        const { x1, y1, x2, y2, fromDir, toDir } = geom(el);
        const sel = selectedId === el.id;
        const stroke = el.color ?? 'var(--conn)';
        const routing = routingOf(el.content);
        const arrow = (el.content.arrowType ?? 'arrow') as ArrowType;
        // Ruta ya pasada por la agrupación de carriles: las que van por el mismo
        // pasillo caen en la misma raya, si no se leen como un borrón (§2).
        const pts = rutasConCarriles[ai] ?? rutaDe(el);
        const d = pathFromPoints(routing, pts, fromDir, toDir);
        const markerEnd = arrow === 'none' ? undefined : `url(#mkE-${el.id})`;
        const markerStart = arrow === 'both' ? `url(#mkS-${el.id})` : undefined;
        // Un tirador en medio de CADA tramo (§5), incluidos los pegados al
        // elemento. Los codos no llevan punto encima: el doblez ya se ve.
        const mids = sel
          ? pts.slice(0, -1).map((a, i) => {
              const b = pts[i + 1];
              return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, seg: i, eje: ejeDeTramo(a, b) };
            })
          : [];
        const r = 5 / scale; // radio visible (constante en pantalla)
        const grab = 13 / scale; // radio de agarre: generoso, para no tener que apuntar fino
        // Un solo tirador que cambia de color según si el tramo está ajustado a
        // mano; nada de dos marcas superpuestas donde sólo una responde (§8).
        const ajustado = (el.content.waypoints?.length ?? 0) > 0;
        return (
          <g key={el.id}>
            {/* zona de impacto */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              style={{ pointerEvents: 'stroke', cursor: el.locked ? 'default' : 'move' }}
              onPointerDown={(e) => onBodyDown(e, el)}
            />
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={sel ? 2.5 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={markerEnd}
              markerStart={markerStart}
              style={{ pointerEvents: 'none' }}
            />
            {sel && (
              <>
                {/* un tirador por tramo: lo desliza en su eje perpendicular */}
                {mids.map((m) => (
                  <Handle
                    key={`t-${m.seg}`}
                    x={m.x}
                    y={m.y}
                    r={r * 0.85}
                    grab={grab}
                    fill={ajustado ? 'var(--color-accent-500)' : 'var(--surface)'}
                    stroke="var(--color-accent-500)"
                    strokeWidth={1.8 / scale}
                    cursor={m.eje === 'x' ? 'ew-resize' : 'ns-resize'}
                    title="Arrastra para mover el tramo · doble clic para devolverlo al automático"
                    onDown={(e) => onTramoDown(e, el, m.seg, pts)}
                    onDouble={(e) => onTramoDouble(e, el, m.seg, pts)}
                  />
                ))}
                <Handle
                  x={x1}
                  y={y1}
                  r={r}
                  grab={grab}
                  fill="var(--color-accent-500)"
                  cursor="crosshair"
                  title="Arrastra para reconectar este extremo"
                  onDown={(e) => onEndDown(e, el, 1, x1, y1)}
                />
                <Handle
                  x={x2}
                  y={y2}
                  r={r}
                  grab={grab}
                  fill="var(--color-accent-500)"
                  cursor="crosshair"
                  title="Arrastra para reconectar este extremo"
                  onDown={(e) => onEndDown(e, el, 2, x2, y2)}
                />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Manija con zona de agarre invisible (grande) y punto visible (pequeño): así se
// ve fino pero se agarra fácil.
function Handle({
  x,
  y,
  r,
  grab,
  fill,
  stroke,
  strokeWidth,
  opacity,
  cursor,
  title,
  onDown,
  onDouble,
}: {
  x: number;
  y: number;
  r: number;
  grab: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  cursor: string;
  title: string;
  onDown: (e: RPointerEvent) => void;
  onDouble?: (e: RMouseEvent) => void;
}) {
  return (
    <g onPointerDown={onDown} onDoubleClick={onDouble} style={{ cursor }}>
      <title>{title}</title>
      <circle cx={x} cy={y} r={grab} fill="transparent" style={{ pointerEvents: 'all' }} />
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}

// Marcadores (flechas) por conector, heredando su color exacto.
function ArrowMarkers({ id, color, type }: { id: string; color: string; type: ArrowType }) {
  const end = () => {
    switch (type) {
      case 'none':
        return null;
      case 'open':
        return (
          <marker id={`mkE-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M1,1 L9,5 L1,9" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        );
      case 'circle':
        return (
          <marker id={`mkE-${id}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <circle cx="5" cy="5" r="3.6" fill={color} />
          </marker>
        );
      case 'diamond':
        return (
          <marker id={`mkE-${id}`} viewBox="0 0 12 10" refX="11" refY="5" markerWidth="9" markerHeight="8" orient="auto-start-reverse">
            <path d="M1,5 L6,1 L11,5 L6,9 z" fill={color} />
          </marker>
        );
      default:
        return (
          <marker id={`mkE-${id}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={color} />
          </marker>
        );
    }
  };
  return (
    <>
      {end()}
      {type === 'both' && (
        <marker id={`mkS-${id}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={color} />
        </marker>
      )}
    </>
  );
}
