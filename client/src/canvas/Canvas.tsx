import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { motion } from 'framer-motion';
import type { CanvasView, ElementType, Point } from '../api/types';
import { useElements } from './useElements';
import { CanvasElementView } from './CanvasElementView';
import { ArrowLayer } from './ArrowLayer';
import { ComponentsBubble, type Preset } from './ComponentsBubble';
import { ElementToolbar } from './ElementToolbar';
import { screenToWorld, zoomAt, newElement, TACTIL, type Viewport } from './viewport';
import { edgePoint, portDirection, portPoint } from './connectors';
import { hitTarget } from './hit';
import { elegirLados, engancharElemento, puertoDeLado, puertoEnPunto, puntuar, trazarConCoste } from './lineRouter';

const PAN_STEP = 70;

export function Canvas({ pageId, view }: { pageId: string; view: CanvasView }) {
  const { elements, patchLocal, update, persist, add, remove } = useElements(pageId);
  const [vp, setVp] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{
    fromId: string;
    fromPort: string;
    from: Point;
    to: Point;
    /** Nodo bajo el cursor ahora mismo (se resalta como en draw.io). */
    overId: string | null;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number } | null>(null);
  const vpRef = useRef(vp);
  vpRef.current = vp;
  const nodeByIdRef = useRef<Map<string, (typeof elements)[number]>>(new Map());

  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const arrows = useMemo(() => elements.filter((e) => e.type === 'arrow'), [elements]);
  const nodes = useMemo(() => elements.filter((e) => e.type !== 'arrow'), [elements]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  nodeByIdRef.current = nodeById;

  const rect = () => containerRef.current?.getBoundingClientRect();
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const r = rect();
    return screenToWorld(clientX - (r?.left ?? 0), clientY - (r?.top ?? 0), vpRef.current);
  }, []);

  const maxZ = useCallback(() => elements.reduce((m, e) => Math.max(m, e.zIndex), 0), [elements]);
  const minZ = useCallback(() => elements.reduce((m, e) => Math.min(m, e.zIndex), 0), [elements]);

  // Borra un elemento y los conectores que lo referencian.
  const removeWithConnectors = useCallback(
    (id: string) => {
      elements.forEach((e) => {
        if (e.type === 'arrow' && (e.content.fromId === id || e.content.toId === id)) remove(e.id);
      });
      remove(id);
    },
    [elements, remove],
  );

  // Mover un marco arrastra todo lo que tiene adentro. Al empezar capturamos qué
  // elementos caen dentro (por su centro) y sus posiciones; luego los movemos por
  // el mismo delta.
  const frameDrag = useRef<{ kids: { id: string; x: number; y: number }[]; last?: { dx: number; dy: number } } | null>(
    null,
  );
  const onFrameDrag = useCallback(
    (frameId: string, dx: number, dy: number, phase: 'start' | 'move' | 'end') => {
      if (phase === 'start') {
        const f = elements.find((e) => e.id === frameId);
        if (!f) {
          frameDrag.current = null;
          return;
        }
        const inside = (e: (typeof elements)[number]) => {
          const cx = e.x + e.w / 2;
          const cy = e.y + e.h / 2;
          return cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h;
        };
        const kids = elements.filter((e) => e.id !== frameId && e.type !== 'arrow' && inside(e));
        frameDrag.current = { kids: kids.map((k) => ({ id: k.id, x: k.x, y: k.y })) };
      } else if (phase === 'move') {
        if (frameDrag.current) frameDrag.current.last = { dx, dy };
        frameDrag.current?.kids.forEach((k) => patchLocal(k.id, { x: Math.round(k.x + dx), y: Math.round(k.y + dy) }));
      } else {
        const last = frameDrag.current?.last;
        if (last) frameDrag.current?.kids.forEach((k) => persist(k.id, { x: Math.round(k.x + last.dx), y: Math.round(k.y + last.dy) }));
        frameDrag.current = null;
      }
    },
    [elements, patchLocal, persist],
  );

  const zoomAtCenter = useCallback((dir: 1 | -1) => {
    const r = rect();
    setVp((v) => zoomAt(v, (r?.width ?? 800) / 2, (r?.height ?? 600) / 2, v.scale * (dir > 0 ? 1.2 : 1 / 1.2)));
  }, []);

  // Rueda = zoom (sin ctrl), centrado en el cursor.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = node.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setVp((v) => zoomAt(v, px, py, v.scale * factor));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  // Teclado: flechas mueven el lienzo, +/- zoom, 0 reset, supr borra, esc deselecciona.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement;
      const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || (ae as HTMLElement).isContentEditable);
      if (typing) return;
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setVp((v) => ({ ...v, x: v.x - PAN_STEP }));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setVp((v) => ({ ...v, x: v.x + PAN_STEP }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVp((v) => ({ ...v, y: v.y - PAN_STEP }));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVp((v) => ({ ...v, y: v.y + PAN_STEP }));
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomAtCenter(1);
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomAtCenter(-1);
          break;
        case '0':
          e.preventDefault();
          setVp({ x: 0, y: 0, scale: 1 });
          break;
        case 'Escape':
          setSelectedId(null);
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedId) {
            e.preventDefault();
            removeWithConnectors(selectedId);
            setSelectedId(null);
          }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, removeWithConnectors, zoomAtCenter]);

  // Pan arrastrando el fondo (los elementos cortan la propagacion).
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) || 1;

  function onPointerDown(e: RPointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // No capturar el puntero si el click es sobre una isla flotante (paneles).
    if ((e.target as HTMLElement).closest('[data-isla]')) return;
    e.preventDefault();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    containerRef.current?.setPointerCapture(e.pointerId);
    if (pointers.current.size === 1) {
      setSelectedId(null);
      pan.current = { sx: e.clientX, sy: e.clientY, ox: vpRef.current.x, oy: vpRef.current.y };
      pinch.current = null;
    } else if (pointers.current.size === 2) {
      pan.current = null;
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: dist(a, b) };
    }
  }
  function onPointerMove(e: RPointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      // zoom con dos dedos, centrado en el punto medio
      const [a, b] = [...pointers.current.values()];
      const nd = dist(a, b);
      const ratio = nd / pinch.current.dist;
      pinch.current.dist = nd;
      const r = rect();
      const mx = (a.x + b.x) / 2 - (r?.left ?? 0);
      const my = (a.y + b.y) / 2 - (r?.top ?? 0);
      setVp((v) => zoomAt(v, mx, my, v.scale * ratio));
    } else if (pan.current) {
      const p = pan.current;
      setVp((v) => ({ ...v, x: p.ox + (e.clientX - p.sx), y: p.oy + (e.clientY - p.sy) }));
    }
  }
  function endPointer(e: RPointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      pan.current = null;
    } else if (pointers.current.size === 1 && !pan.current) {
      // quedó un dedo tras soltar el pinch: reanudar el arrastre desde ahí
      const [only] = [...pointers.current.values()];
      pan.current = { sx: only.x, sy: only.y, ox: vpRef.current.x, oy: vpRef.current.y };
    }
  }

  // Si se pasan coordenadas de pantalla (suelta del arrastre desde la paleta) se
  // crea ahí; si no, en el centro del lienzo. El preset le da color/contenido
  // propios según la herramienta temática de la isla.
  async function addElement(type: ElementType, clientX?: number, clientY?: number, preset?: Preset) {
    const r = rect();
    const at =
      clientX != null && clientY != null
        ? screenToWorld(clientX - (r?.left ?? 0), clientY - (r?.top ?? 0), vpRef.current)
        : screenToWorld((r?.width ?? 800) / 2, (r?.height ?? 600) / 2, vpRef.current);
    const base = newElement(type, at, maxZ() + 1);
    const el = preset
      ? {
          ...base,
          color: preset.color !== undefined ? preset.color : base.color,
          content: { ...base.content, ...(preset.content ?? {}) },
        }
      : base;
    const created = await add(el);
    if (created) setSelectedId(created.id);
  }

  // Red de seguridad (§5): rehace la línea limpia — vuelve a elegir el mejor
  // lado por ambos extremos y descarta los ajustes manuales. Sólo a petición.
  function reordenarLinea(el: (typeof elements)[number]) {
    const c = el.content;
    const a = c.fromId ? nodeById.get(c.fromId) : undefined;
    const b = c.toId ? nodeById.get(c.toId) : undefined;
    if (!a || !b) {
      update(el.id, { content: { ...c, waypoints: [] } });
      return;
    }
    const obst = [...nodeById.values()].map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
    const { fromSide, toSide } = elegirLados(a, b, obst, {
      from: a.type === 'model' || a.type === 'list',
      to: b.type === 'model' || b.type === 'list',
    });
    update(el.id, {
      content: { ...c, fromPort: `${fromSide}_0.500`, toPort: `${toSide}_0.500`, waypoints: [] },
    });
  }

  // Al soltar un elemento movido, se revisan SUS líneas: las que no tocaste a
  // mano y hayan quedado dando un rodeo se recolocan al lado que ahora toca.
  // Sólo al soltar: si se hiciera durante el arrastre, el punto de salida
  // saltaría de un lado al opuesto y se sentiría descontrolado.
  const readaptar = useCallback(
    (movedId: string) => {
      const nodos = [...nodeByIdRef.current.values()];
      const obst = nodos.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
      for (const el of elements) {
        if (el.type !== 'arrow') continue;
        const c = el.content;
        if (c.fromId !== movedId && c.toId !== movedId) continue;
        if (c.waypoints?.length) continue; // ajustada a mano: no se toca
        const a = c.fromId ? nodeByIdRef.current.get(c.fromId) : undefined;
        const b = c.toId ? nodeByIdRef.current.get(c.toId) : undefined;
        if (!a || !b) continue;

        const dirDe = (p?: string) => (p ? portDirection(p) : null);
        const actual =
          c.fromPort && c.toPort
            ? trazarConCoste(portPoint(a, c.fromPort), dirDe(c.fromPort)!, portPoint(b, c.toPort), dirDe(c.toPort)!, obst)
                .coste
            : Infinity;
        const mejor = elegirLados(a, b, obst, {
          from: a.type === 'model' || a.type === 'list',
          to: b.type === 'model' || b.type === 'list',
        });
        const costeMejor = puntuar(mejor.pts, obst);
        // Sólo se cambia si la mejora es clara: si no, cualquier movimiento
        // menor recolocaría el punto y sería igual de molesto.
        if (actual > costeMejor + 350) {
          update(el.id, {
            content: {
              ...c,
              fromPort: puertoDeLado(mejor.fromSide, c.fromPort),
              toPort: puertoDeLado(mejor.toSide, c.toPort),
            },
          });
        }
      }
    },
    [elements, update],
  );

  // Guías que se pintan mientras se arrastra un elemento.
  const [guias, setGuias] = useState<{ eje: 'x' | 'y'; valor: number }[]>([]);

  // Imanes al mover un elemento: manda «que una de sus líneas quede recta».
  const onSnap = useCallback(
    (id: string, caja: { x: number; y: number; w: number; h: number }) => {
      const nodos = [...nodeByIdRef.current.values()].filter((n) => n.id !== id);
      const otros = nodos.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
      // Anclas: el punto del OTRO extremo de cada línea suya. Alinear el centro
      // con él es lo que deja la línea recta.
      const anclas: { x?: number; y?: number }[] = [];
      for (const el of elements) {
        if (el.type !== 'arrow') continue;
        const c = el.content;
        const otroId = c.fromId === id ? c.toId : c.toId === id ? c.fromId : null;
        if (!otroId) continue;
        const o = nodeByIdRef.current.get(otroId);
        if (!o) continue;
        anclas.push({ x: o.x + o.w / 2, y: o.y + o.h / 2 });
      }
      const r = engancharElemento(caja, otros, anclas);
      setGuias(r.guias);
      return { dx: r.dx, dy: r.dy };
    },
    [elements],
  );

  function duplicate() {
    if (!selected) return;
    const { id, pageId: _p, createdAt, updatedAt, ...rest } = selected;
    add({ ...rest, x: rest.x + 24, y: rest.y + 24, zIndex: maxZ() + 1 }).then((el) => el && setSelectedId(el.id));
  }

  // Conectar: arrastrar desde un puerto (vértice/lado) de un elemento hasta otro
  // crea un conector anclado, entrando por el puerto más cercano del destino.
  function onConnectStart(id: string, port: string, e: RPointerEvent) {
    const el = nodeByIdRef.current.get(id);
    if (!el) return;
    const from = portPoint(el, port);
    setConnecting({ fromId: id, fromPort: port, from, to: toWorld(e.clientX, e.clientY), overId: null });
  }

  // `toPort` null = conexión FLOTANTE: no queda clavada a un punto, elige sola el
  // lado más natural y se reacomoda al mover los elementos (como en draw.io al
  // soltar sobre el cuerpo de una figura).
  async function createConnector(
    fromId: string,
    fromPort: string,
    toId: string,
    toPort: string | null,
    dropAt?: Point,
  ) {
    const a = nodeByIdRef.current.get(fromId);
    const b = nodeByIdRef.current.get(toId);
    if (!a || !b) return;
    // Dónde queda clavado el extremo, por orden:
    //  1. el puerto exacto si soltaste sobre uno,
    //  2. si no, la altura exacta a la que soltaste sobre el elemento,
    //  3. y sólo si soltaste en su centro (no señalabas ningún sitio), lo elige
    //     el trazado probando rutas (§4).
    let finalToPort = toPort ?? (dropAt ? puertoEnPunto(b, dropAt) : null);
    if (!finalToPort) {
      const obst = [...nodeByIdRef.current.values()].map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
      const { toSide } = elegirLados(a, b, obst, { from: false, to: b.type === 'model' || b.type === 'list' });
      finalToPort = puertoDeLado(toSide);
    }
    const src = portPoint(a, fromPort);
    const dst = portPoint(b, finalToPort);
    const created = await add({
      type: 'arrow',
      x: Math.round(Math.min(src.x, dst.x)),
      y: Math.round(Math.min(src.y, dst.y)),
      w: Math.round(Math.abs(dst.x - src.x)),
      h: Math.round(Math.abs(dst.y - src.y)),
      color: null, // sin color propio: usa --conn, que se ve en claro y en oscuro
      zIndex: maxZ() + 1,
      locked: false,
      content: { fromId, fromPort, toId, toPort: finalToPort, routing: 'ortho', arrowType: 'arrow' },
    });
    if (created) setSelectedId(created.id);
  }

  useEffect(() => {
    if (!connecting) return;
    const { fromId, fromPort } = connecting;
    const onMove = (e: PointerEvent) => {
      const w = toWorld(e.clientX, e.clientY);
      const hit = hitTarget(e.clientX, e.clientY);
      const over = hit.nodeId && hit.nodeId !== fromId ? hit.nodeId : null;
      setConnecting((c) => (c ? { ...c, to: w, overId: over } : c));
    };
    const onUp = (e: PointerEvent) => {
      const hit = hitTarget(e.clientX, e.clientY);
      // Se le pasa el punto exacto de suelta para conservar la altura a la que
      // conectaste, no el centro del lado.
      if (hit.nodeId && hit.nodeId !== fromId)
        createConnector(fromId, fromPort, hit.nodeId, hit.port, toWorld(e.clientX, e.clientY));
      setConnecting(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecting?.fromId, toWorld]);

  // La barra se coloca FUERA de lo seleccionado y centrada: pegada encima, y si
  // ahí no cabe, debajo. Así no tapa nunca el contenido.
  const toolbarPos = (() => {
    if (!selected) return null;
    let x0 = selected.x;
    let y0 = selected.y;
    let x1 = selected.x + selected.w;
    let y1 = selected.y + selected.h;
    if (selected.type === 'arrow') {
      const c = selected.content;
      const from = c.fromId ? nodeById.get(c.fromId) : undefined;
      const to = c.toId ? nodeById.get(c.toId) : undefined;
      let p1 = { x: c.x1 ?? 0, y: c.y1 ?? 0 };
      let p2 = { x: c.x2 ?? 0, y: c.y2 ?? 0 };
      if (from) {
        p1 = c.fromPort
          ? portPoint(from, c.fromPort)
          : edgePoint(from, to ? to.x + to.w / 2 : (c.x2 ?? 0), to ? to.y + to.h / 2 : (c.y2 ?? 0));
      }
      if (to) {
        p2 = c.toPort
          ? portPoint(to, c.toPort)
          : edgePoint(to, from ? from.x + from.w / 2 : (c.x1 ?? 0), from ? from.y + from.h / 2 : (c.y1 ?? 0));
      }
      x0 = Math.min(p1.x, p2.x);
      x1 = Math.max(p1.x, p2.x);
      y0 = Math.min(p1.y, p2.y);
      y1 = Math.max(p1.y, p2.y);
    }
    const r = rect();
    const ancho = r?.width ?? window.innerWidth;
    const HUECO = 14;
    const ALTO = TACTIL ? 54 : 44;
    const sxc = vp.x + ((x0 + x1) / 2) * vp.scale;
    const syTop = vp.y + y0 * vp.scale;
    const syBot = vp.y + y1 * vp.scale;
    // Si arriba no hay sitio (se saldría de pantalla o pisaría la isla de nav),
    // la barra pasa debajo del elemento.
    const debajo = syTop - HUECO - ALTO < 84;
    const top = debajo ? syBot + HUECO : syTop - HUECO;
    // Sin salirse por los lados. En un móvil no caben 190 px de margen a cada
    // lado, así que el tope se ajusta al ancho real y la barra queda centrada.
    const MEDIO = Math.min(190, ancho / 2 - 8);
    const left = Math.max(MEDIO, Math.min(sxc, ancho - MEDIO));
    return { left, top, debajo };
  })();

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{
        background: 'var(--canvas)',
        backgroundImage: 'radial-gradient(var(--canvas-dots) 1.1px, transparent 1.1px)',
        backgroundSize: `${24 * vp.scale}px ${24 * vp.scale}px`,
        backgroundPosition: `${vp.x}px ${vp.y}px`,
        cursor: pan.current ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transformOrigin: '0 0',
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.scale})`,
        }}
      >
        {nodes.map((el) => (
          <CanvasElementView
            key={el.id}
            el={el}
            scale={vp.scale}
            selected={selectedId === el.id}
            onSelect={setSelectedId}
            patchLocal={patchLocal}
            persist={persist}
            onConnectStart={onConnectStart}
            onFrameDrag={onFrameDrag}
            toWorld={toWorld}
            onMoved={(mid) => {
              setGuias([]);
              readaptar(mid);
            }}
            onSnap={onSnap}
            linking={!!connecting && connecting.fromId !== el.id}
            linkTarget={connecting?.overId === el.id}
          />
        ))}
        {/* Guías de alineación al mover un elemento (§6). */}
        {guias.length > 0 && (
          <svg
            style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', zIndex: 40, pointerEvents: 'none' }}
          >
            {guias.map((g, i) => (
              <line
                key={i}
                x1={g.eje === 'x' ? g.valor : -100000}
                y1={g.eje === 'x' ? -100000 : g.valor}
                x2={g.eje === 'x' ? g.valor : 100000}
                y2={g.eje === 'x' ? 100000 : g.valor}
                stroke="var(--color-accent-500)"
                strokeWidth={1 / vp.scale}
                strokeDasharray={`${5 / vp.scale} ${4 / vp.scale}`}
                opacity={0.75}
              />
            ))}
          </svg>
        )}
        <ArrowLayer
          arrows={arrows}
          nodeById={nodeById}
          scale={vp.scale}
          selectedId={selectedId}
          onSelect={setSelectedId}
          patchLocal={patchLocal}
          persist={persist}
          toWorld={toWorld}
        />
        {connecting && (
          <svg style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', zIndex: 50, pointerEvents: 'none' }}>
            <line
              x1={connecting.from.x}
              y1={connecting.from.y}
              x2={connecting.to.x}
              y2={connecting.to.y}
              stroke="var(--color-accent-500)"
              strokeWidth={2}
              strokeDasharray="6 5"
              strokeLinecap="round"
            />
            <circle cx={connecting.to.x} cy={connecting.to.y} r={4} fill="var(--color-accent-500)" />
          </svg>
        )}
      </div>

      <ComponentsBubble view={view} onAdd={addElement} scale={vp.scale} />

      {selected && toolbarPos && (
        // El posicionamiento va en un div aparte: si se pusiera en el `motion`,
        // framer-motion escribiría su propio `transform` encima y la barra
        // acabaría pisando el elemento.
        <div
          className="absolute z-30"
          style={{
            left: toolbarPos.left,
            top: toolbarPos.top,
            transform: `translate(-50%, ${toolbarPos.debajo ? '0' : '-100%'})`,
          }}
        >
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, scale: 0.96, y: toolbarPos.debajo ? -4 : 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
          >
          <ElementToolbar
            el={selected}
            onColor={(c) => update(selected.id, { color: c })}
            onShape={(s) => update(selected.id, { content: { ...selected.content, shape: s } })}
            onRouting={(r) => update(selected.id, { content: { ...selected.content, routing: r } })}
            onArrowType={(a) => update(selected.id, { content: { ...selected.content, arrowType: a } })}
            onStraighten={() => reordenarLinea(selected)}
            onZ={(dir) => update(selected.id, { zIndex: dir === 'front' ? maxZ() + 1 : minZ() - 1 })}
            onToggleLock={() => update(selected.id, { locked: !selected.locked })}
            onDuplicate={duplicate}
              onDelete={() => {
                removeWithConnectors(selected.id);
                setSelectedId(null);
              }}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}
