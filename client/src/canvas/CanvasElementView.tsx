import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { motion } from 'framer-motion';
import type { CanvasElement, ElementContent, ListItem, ModelField, Point } from '../api/types';
import { cx, uid } from '../lib/util';
import { idealText } from '../lib/color';
import { handlePorts } from './connectors';
import { IconCheck, IconPlus, IconClose, IconImage, IconDatabase } from '../components/icons';

const MIN_W = 80;
const MIN_H = 40;

type Corner = 'nw' | 'ne' | 'sw' | 'se';
const CORNER_DEF: Record<Corner, { fx: number; fy: number; cursor: string }> = {
  nw: { fx: 0, fy: 0, cursor: 'nwse-resize' },
  ne: { fx: 1, fy: 0, cursor: 'nesw-resize' },
  sw: { fx: 0, fy: 1, cursor: 'nesw-resize' },
  se: { fx: 1, fy: 1, cursor: 'nwse-resize' },
};

interface Props {
  el: CanvasElement;
  scale: number;
  selected: boolean;
  onSelect: (id: string) => void;
  patchLocal: (id: string, patch: Partial<CanvasElement>) => void;
  persist: (id: string, patch: Partial<CanvasElement>, debounceMs?: number) => void;
  onConnectStart: (id: string, port: string, e: RPointerEvent) => void;
  onFrameDrag: (id: string, dx: number, dy: number, phase: 'start' | 'move' | 'end') => void;
  toWorld: (clientX: number, clientY: number) => Point;
  /** Se acaba de soltar tras moverlo: sus líneas se revisan. */
  onMoved?: (id: string) => void;
  /** Corrección de alineación mientras se arrastra (imanes + guías). */
  onSnap?: (id: string, caja: { x: number; y: number; w: number; h: number }) => { dx: number; dy: number };
  /** Resaltado al arrastrar un conector encima (destino candidato). */
  linkTarget?: boolean;
  /** Se está tendiendo una conexión: mostrar los puertos aunque no haya hover. */
  linking?: boolean;
}

export function CanvasElementView({
  el,
  scale,
  selected,
  onSelect,
  patchLocal,
  persist,
  onConnectStart,
  onFrameDrag,
  toWorld,
  onMoved,
  onSnap,
  linkTarget = false,
  linking = false,
}: Props) {
  const drag = useRef<{
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    wasSelected: boolean;
    last?: { x: number; y: number };
  } | null>(null);
  const resize = useRef<{
    corner: Corner;
    left0: number;
    top0: number;
    right0: number;
    bottom0: number;
    gdx: number;
    gdy: number;
    last?: Partial<CanvasElement>;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<HTMLDivElement>(null);

  // Lista y modelo crecen en alto según su contenido (sin scroll interno).
  const autoH = el.type === 'list' || el.type === 'model';

  // Al deseleccionar, salir del modo edición.
  useEffect(() => {
    if (!selected) setEditing(false);
  }, [selected]);

  // Auto-alto: mide el contenido y ajusta la altura del elemento para que crezca
  // o encoja con sus ítems, en vez de tener scroll.
  const hRef = useRef(el.h);
  hRef.current = el.h;
  useEffect(() => {
    if (!autoH) return;
    const node = elRef.current;
    if (!node) return;
    const sync = () => {
      const h = node.offsetHeight;
      if (h > 0 && Math.abs(h - hRef.current) > 1) {
        patchLocal(el.id, { h });
        persist(el.id, { h }, 400);
      }
    };
    const ro = new ResizeObserver(sync);
    ro.observe(node);
    sync();
    return () => ro.disconnect();
  }, [autoH, el.id, patchLocal, persist]);

  // Al entrar en edición, enfocar el primer campo.
  useEffect(() => {
    if (!editing) return;
    const field = bodyRef.current?.querySelector('textarea, input') as HTMLElement | null;
    field?.focus();
  }, [editing]);

  const setContent = (content: ElementContent) => {
    patchLocal(el.id, { content });
    persist(el.id, { content }, 450);
  };

  function onPointerDown(e: RPointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation(); // evita el pan del canvas
    onSelect(el.id);
    // En edición dejamos pasar el puntero al texto (colocar cursor, seleccionar).
    if (editing || el.locked) return;
    // Mantener presionado = mover.
    drag.current = { sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, wasSelected: selected };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (el.type === 'frame') onFrameDrag(el.id, 0, 0, 'start');
  }
  function onPointerMove(e: RPointerEvent) {
    if (!drag.current) return;
    const dx = (e.clientX - drag.current.sx) / scale;
    const dy = (e.clientY - drag.current.sy) / scale;
    let x = Math.round(drag.current.ox + dx);
    let y = Math.round(drag.current.oy + dy);
    // Asistencia de alineación (§6): se pega a la posición donde alguna de sus
    // líneas queda recta, y si no, a los bordes y centros de los demás.
    if (onSnap) {
      const s = onSnap(el.id, { x, y, w: el.w, h: el.h });
      x = Math.round(x + s.dx);
      y = Math.round(y + s.dy);
    }
    drag.current.last = { x, y };
    patchLocal(el.id, { x, y });
    // El marco arrastra todo lo que tiene adentro.
    if (el.type === 'frame') onFrameDrag(el.id, x - drag.current.ox, y - drag.current.oy, 'move');
  }
  function onPointerUp() {
    const d = drag.current;
    if (d?.last) {
      persist(el.id, d.last);
      // Al SOLTAR (no durante el arrastre) se revisan sus líneas: si alguna
      // quedó dando un rodeo feo, se readapta. Hacerlo mientras arrastras haría
      // saltar los puntos de un lado a otro y se sentiría descontrolado.
      onMoved?.(el.id);
    } else if (
      d?.wasSelected &&
      !editing &&
      !el.locked &&
      el.type !== 'frame' &&
      el.type !== 'list' &&
      el.type !== 'model'
    ) {
      // Clic sobre un elemento ya seleccionado (sin arrastrar) = entrar a editar.
      setEditing(true);
    }
    if (el.type === 'frame') onFrameDrag(el.id, 0, 0, 'end');
    drag.current = null;
  }

  // Resize ABSOLUTO: los bordes fijos no se mueven y el borde agarrado sigue al
  // cursor (en coordenadas de mundo). Esto no acumula error → no "salta".
  function onResizeDown(e: RPointerEvent, corner: Corner) {
    e.stopPropagation();
    e.preventDefault();
    const w = toWorld(e.clientX, e.clientY);
    const cornerX = el.x + (corner.includes('e') ? el.w : 0);
    const cornerY = el.y + (corner.includes('s') ? el.h : 0);
    resize.current = {
      corner,
      left0: el.x,
      top0: el.y,
      right0: el.x + el.w,
      bottom0: el.y + el.h,
      gdx: w.x - cornerX,
      gdy: w.y - cornerY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onResizeMove(e: RPointerEvent) {
    const r = resize.current;
    if (!r) return;
    const w = toWorld(e.clientX, e.clientY);
    const px = w.x - r.gdx; // compensa el punto exacto de agarre
    const py = w.y - r.gdy;
    let left = r.left0;
    let top = r.top0;
    let right = r.right0;
    let bottom = r.bottom0;
    if (r.corner.includes('e')) right = px;
    if (r.corner.includes('w')) left = px;
    // Auto-alto (lista/modelo): sólo se redimensiona el ancho.
    if (!autoH && r.corner.includes('s')) bottom = py;
    if (!autoH && r.corner.includes('n')) top = py;
    if (right - left < MIN_W) {
      if (r.corner.includes('w')) left = right - MIN_W;
      else right = left + MIN_W;
    }
    if (bottom - top < MIN_H) {
      if (r.corner.includes('n')) top = bottom - MIN_H;
      else bottom = top + MIN_H;
    }
    // En auto-alto sólo cambia ancho/x (el alto lo maneja el contenido).
    const patch: Partial<CanvasElement> = autoH
      ? { x: Math.round(left), w: Math.round(right - left) }
      : { x: Math.round(left), y: Math.round(top), w: Math.round(right - left), h: Math.round(bottom - top) };
    r.last = patch;
    patchLocal(el.id, patch);
  }
  function onResizeUp() {
    if (resize.current?.last) persist(el.id, resize.current.last);
    resize.current = null;
  }

  // Lista y modelo son interactivos (checks, agregar, editar campos): siempre
  // reciben el puntero. Se arrastran desde zonas vacías; los controles cortan la
  // propagación para no iniciar un arrastre.
  const interactive = el.type === 'list' || el.type === 'model';
  const isFrame = el.type === 'frame';
  // El marco no recibe el puntero (para no tapar lo que tiene dentro), y por eso
  // el `:hover` de CSS nunca se dispara en él: sus puntos de conexión se
  // muestran con este estado, que activan sus bordes agarrables.
  const [frameHover, setFrameHover] = useState(false);

  // Puertos de conexión (en coords locales). Al seleccionar se muestran los 4
  // puntos medios (las esquinas quedan para redimensionar); si no, los 8
  // (incluidos los vértices) y se revelan por CSS al pasar el cursor — con
  // `:hover` nativo, porque el onMouseEnter de framer-motion no es fiable.
  // Los marcos también tienen puertos para poder sacar flechas de ellos.
  const inv = 1 / scale; // manijas de tamaño constante en pantalla
  const ports = handlePorts({ x: 0, y: 0, w: el.w, h: el.h });
  // Normalmente sólo los 4 puntos de los lados (menos ruido encima del
  // elemento). Los 8, incluidas las esquinas, sólo mientras se tiende una
  // conexión: ahí sí interesa poder apuntar a un vértice concreto.
  const sides = ports.filter((p) => p.port.endsWith('0.500'));
  const connectPorts = linking ? ports : sides;

  // Grosor del borde agarrable del marco (para moverlo fácil desde cualquier lado).
  const ringT = 14 * inv;
  const ringStyles: Record<string, CSSProperties> = {
    top: { left: 0, right: 0, top: -ringT / 2, height: ringT },
    bottom: { left: 0, right: 0, bottom: -ringT / 2, height: ringT },
    left: { top: 0, bottom: 0, left: -ringT / 2, width: ringT },
    right: { top: 0, bottom: 0, right: -ringT / 2, width: ringT },
  };

  return (
    <motion.div
      ref={elRef}
      data-el-id={el.id}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={cx(
        'holm-el absolute',
        (selected || frameHover) && 'holm-el--sel',
        linking && 'holm-el--linking',
        editing ? 'cursor-text' : el.locked ? 'cursor-default' : 'cursor-grab',
      )}
      style={{
        left: el.x,
        top: el.y,
        width: el.w,
        height: autoH ? 'auto' : el.h,
        zIndex: el.zIndex + 1,
        pointerEvents: isFrame ? 'none' : 'auto',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!el.locked) setEditing(true);
      }}
    >
      {/* El contenido sólo recibe el puntero en modo edición; así un clic simple mueve. */}
      <div
        ref={bodyRef}
        className={cx('w-full', autoH ? '' : 'h-full', editing || interactive ? '' : 'select-none')}
        style={{ pointerEvents: isFrame ? 'none' : editing || interactive ? 'auto' : 'none' }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setEditing(false);
        }}
      >
        <Body el={el} setContent={setContent} selected={selected} />
      </div>

      {/* Destino candidato: se ilumina todo el elemento, como en draw.io. */}
      {linkTarget && (
        <div
          className="pointer-events-none absolute rounded-xl"
          style={{
            left: -3 * inv,
            top: -3 * inv,
            right: -3 * inv,
            bottom: -3 * inv,
            border: `${2 * inv}px solid var(--color-accent-500)`,
            background: 'color-mix(in srgb, var(--color-accent-500) 12%, transparent)',
            zIndex: 19,
          }}
        />
      )}

      {/* Marco: borde agarrable en los 4 lados para moverlo fácil. */}
      {isFrame &&
        !el.locked &&
        (['top', 'bottom', 'left', 'right'] as const).map((side) => (
          <div
            key={side}
            className="absolute"
            style={{ ...ringStyles[side], cursor: 'grab', pointerEvents: 'auto', zIndex: 15 }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onMouseEnter={() => setFrameHover(true)}
            onMouseLeave={() => setFrameHover(false)}
          />
        ))}

      {/* Conexión: punto por puerto; arrastra desde ahí hasta otro elemento. */}
      {connectPorts.map((p) => (
        <ConnectHandle
          key={p.port}
          x={p.x}
          y={p.y}
          inv={inv}
          nodeId={el.id}
          port={p.port}
          onDown={(e) => onConnectStart(el.id, p.port, e)}
        />
      ))}

      {/* Redimensionar: cuadradito en cada esquina (tamaño constante en pantalla). */}
      {selected &&
        (['nw', 'ne', 'sw', 'se'] as const).map((c) => (
          <ResizeHandle
            key={c}
            x={CORNER_DEF[c].fx * el.w}
            y={CORNER_DEF[c].fy * (autoH ? (bodyRef.current?.offsetHeight ?? el.h) : el.h)}
            cursor={CORNER_DEF[c].cursor}
            inv={inv}
            onDown={(e) => onResizeDown(e, c)}
            onMove={onResizeMove}
            onUp={onResizeUp}
          />
        ))}
    </motion.div>
  );
}

function ResizeHandle({
  x,
  y,
  cursor,
  inv,
  onDown,
  onMove,
  onUp,
}: {
  x: number;
  y: number;
  cursor: string;
  inv: number;
  onDown: (e: RPointerEvent) => void;
  onMove: (e: RPointerEvent) => void;
  onUp: () => void;
}) {
  const s = 8 * inv;
  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      className="absolute"
      style={{
        left: x,
        top: y,
        width: s,
        height: s,
        // Cuadrado (y no círculo) para distinguirlo de un punto de conexión.
        borderRadius: 1.5 * inv,
        transform: 'translate(-50%, -50%)',
        zIndex: 22,
        cursor,
        background: 'var(--surface)',
        border: `${1.5 * inv}px solid var(--color-accent-500)`,
        pointerEvents: 'auto',
      }}
      title="Redimensionar"
    />
  );
}

function ConnectHandle({
  x,
  y,
  inv,
  nodeId,
  port,
  onDown,
}: {
  x: number;
  y: number;
  inv: number;
  nodeId: string;
  port: string;
  onDown: (e: RPointerEvent) => void;
}) {
  const hit = 22 * inv; // zona de agarre generosa (invisible)
  const dot = 9 * inv; // punto visible
  return (
    <div
      data-port={port}
      data-port-node={nodeId}
      onPointerDown={(e) => {
        e.stopPropagation();
        onDown(e);
      }}
      className="holm-port absolute flex items-center justify-center"
      style={{
        left: x,
        top: y,
        width: hit,
        height: hit,
        transform: 'translate(-50%, -50%)',
        zIndex: 20,
        cursor: 'crosshair',
        pointerEvents: 'auto',
      }}
      title="Arrastra para conectar · suelta en el centro del otro para que se acomode sola"
    >
      <span
        className="holm-port-dot block rounded-full"
        style={{ width: dot, height: dot, background: 'var(--color-accent-500)' }}
      />
    </div>
  );
}

/* ----- cuerpo por tipo ----- */

function Body({
  el,
  setContent,
  selected,
}: {
  el: CanvasElement;
  setContent: (c: ElementContent) => void;
  selected: boolean;
}) {
  switch (el.type) {
    case 'note':
      return <NoteBody el={el} setContent={setContent} />;
    case 'card':
      return <CardBody el={el} setContent={setContent} />;
    case 'text':
      return <TextBody el={el} setContent={setContent} />;
    case 'list':
      return <ListBody el={el} setContent={setContent} />;
    case 'image':
      return <ImageBody el={el} setContent={setContent} />;
    case 'shape':
      return <ShapeBody el={el} setContent={setContent} />;
    case 'model':
      return <ModelBody el={el} setContent={setContent} />;
    case 'frame':
      return <FrameBody el={el} setContent={setContent} selected={selected} />;
    default:
      return null;
  }
}

function NoteBody({ el, setContent }: { el: CanvasElement; setContent: (c: ElementContent) => void }) {
  const bg = el.color ?? '#FDE68A';
  return (
    <div className="h-full w-full rounded-xl p-3" style={{ background: bg }}>
      <textarea
        value={el.content.text ?? ''}
        onChange={(e) => setContent({ ...el.content, text: e.target.value })}
        placeholder="Doble clic para escribir"
        className="h-full w-full resize-none border-0 bg-transparent text-sm leading-snug outline-none placeholder:opacity-40"
        style={{ color: idealText(bg) }}
      />
    </div>
  );
}

function CardBody({ el, setContent }: { el: CanvasElement; setContent: (c: ElementContent) => void }) {
  const accent = el.color ?? 'var(--accent-500, #21C2D9)';
  return (
    <div className="card-body h-full w-full overflow-hidden rounded-xl">
      <div className="h-1.5 w-full" style={{ background: el.color ?? '#21C2D9' }} />
      <textarea
        value={el.content.text ?? ''}
        onChange={(e) => setContent({ ...el.content, text: e.target.value })}
        placeholder="Doble clic para escribir"
        className="h-[calc(100%-6px)] w-full resize-none border-0 bg-transparent p-3 text-sm leading-snug outline-none placeholder:opacity-40"
        style={{ color: 'var(--text)' }}
      />
      <span className="sr-only">{accent}</span>
    </div>
  );
}

function TextBody({ el, setContent }: { el: CanvasElement; setContent: (c: ElementContent) => void }) {
  return (
    <textarea
      value={el.content.text ?? ''}
      onChange={(e) => setContent({ ...el.content, text: e.target.value })}
      placeholder="Doble clic para escribir"
      className="h-full w-full resize-none border-0 bg-transparent text-lg font-medium leading-tight outline-none placeholder:opacity-30"
      style={{ color: el.color ?? 'var(--text)' }}
    />
  );
}

function ListBody({ el, setContent }: { el: CanvasElement; setContent: (c: ElementContent) => void }) {
  const items = el.content.items ?? [];
  const update = (next: Partial<ElementContent>) => setContent({ ...el.content, ...next });
  const setItem = (id: string, patch: Partial<ListItem>) =>
    update({ items: items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  const addItem = () => update({ items: [...items, { id: uid(), text: '', done: false }] });
  const removeItem = (id: string) => update({ items: items.filter((it) => it.id !== id) });

  return (
    <div
      className="card-body flex w-full flex-col overflow-hidden rounded-xl"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('input,textarea,button')) e.stopPropagation();
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: el.color ?? '#21C2D9' }} />
        <input
          value={el.content.title ?? ''}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Lista"
          className="w-full border-0 bg-transparent text-sm font-semibold outline-none"
          style={{ color: 'var(--text)' }}
        />
      </div>
      <div className="p-2">
        {items.map((it) => (
          <div key={it.id} className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-[var(--surface-3)]">
            <button
              onClick={() => setItem(it.id, { done: !it.done })}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-white"
              style={{ background: it.done ? el.color ?? '#21C2D9' : 'var(--surface-3)' }}
            >
              {it.done && <IconCheck width={12} height={12} />}
            </button>
            <input
              value={it.text}
              onChange={(e) => setItem(it.id, { text: e.target.value })}
              placeholder="Item..."
              className={cx(
                'w-full border-0 bg-transparent text-sm outline-none',
                it.done ? 'line-through opacity-50' : '',
              )}
              style={{ color: 'var(--text)' }}
            />
            <button
              onClick={() => removeItem(it.id)}
              className="opacity-0 group-hover:opacity-100"
              style={{ color: 'var(--text-soft)' }}
            >
              <IconClose width={13} height={13} />
            </button>
          </div>
        ))}
        <button
          onClick={addItem}
          className="mt-1 flex items-center gap-1 px-1 text-xs"
          style={{ color: 'var(--text-soft)' }}
        >
          <IconPlus width={13} height={13} /> Agregar
        </button>
      </div>
    </div>
  );
}

function ModelBody({ el, setContent }: { el: CanvasElement; setContent: (c: ElementContent) => void }) {
  const fields = el.content.fields ?? [];
  const accent = el.color ?? '#21C2D9';
  const update = (next: Partial<ElementContent>) => setContent({ ...el.content, ...next });
  const setField = (id: string, patch: Partial<ModelField>) =>
    update({ fields: fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const addField = () => update({ fields: [...fields, { id: uid(), name: '', type: 'text' }] });
  const removeField = (id: string) => update({ fields: fields.filter((f) => f.id !== id) });

  return (
    <div
      className="card-body flex w-full flex-col overflow-hidden rounded-xl"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('input,textarea,button')) e.stopPropagation();
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: accent }}>
        <IconDatabase width={15} height={15} style={{ color: '#fff' }} />
        <input
          value={el.content.title ?? ''}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Tabla"
          className="w-full border-0 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/60"
        />
      </div>
      <div className="p-1.5">
        {fields.map((f) => (
          <div key={f.id} className="group flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-[var(--surface-3)]">
            <button
              onClick={() => setField(f.id, { key: !f.key })}
              title="Marcar como clave"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: f.key ? accent : 'transparent', boxShadow: f.key ? 'none' : 'inset 0 0 0 1.5px var(--surface-3)' }}
              />
            </button>
            <input
              value={f.name}
              onChange={(e) => setField(f.id, { name: e.target.value })}
              placeholder="campo"
              className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text)' }}
            />
            <input
              value={f.type}
              onChange={(e) => setField(f.id, { type: e.target.value })}
              placeholder="tipo"
              className="w-16 shrink-0 border-0 bg-transparent text-right text-xs outline-none"
              style={{ color: 'var(--text-soft)' }}
            />
            <button onClick={() => removeField(f.id)} className="opacity-0 group-hover:opacity-100" style={{ color: 'var(--text-soft)' }}>
              <IconClose width={12} height={12} />
            </button>
          </div>
        ))}
        <button onClick={addField} className="mt-1 flex items-center gap-1 px-1.5 text-xs" style={{ color: 'var(--text-soft)' }}>
          <IconPlus width={13} height={13} /> Campo
        </button>
      </div>
    </div>
  );
}

function ShapeBody({ el, setContent }: { el: CanvasElement; setContent: (c: ElementContent) => void }) {
  const bg = el.color ?? '#99E4F0';
  const shape = el.content.shape ?? 'rect';
  const common = 'flex h-full w-full items-center justify-center';
  const text = (
    <input
      value={el.content.text ?? ''}
      onChange={(e) => setContent({ ...el.content, text: e.target.value })}
      placeholder=""
      className="w-[80%] border-0 bg-transparent text-center text-sm font-medium outline-none"
      style={{ color: idealText(bg) }}
    />
  );
  if (shape === 'ellipse')
    return (
      <div className={common} style={{ background: bg, borderRadius: '50%' }}>
        {text}
      </div>
    );
  if (shape === 'triangle')
    return (
      <div className="relative h-full w-full">
        <div
          className="absolute inset-0"
          style={{ background: bg, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }}
        />
        <div className="absolute inset-x-0 bottom-[15%] flex justify-center">{text}</div>
      </div>
    );
  return (
    <div className={common} style={{ background: bg, borderRadius: 10 }}>
      {text}
    </div>
  );
}

function ImageBody({ el, setContent }: { el: CanvasElement; setContent: (c: ElementContent) => void }) {
  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setContent({ ...el.content, src: String(reader.result) });
    reader.readAsDataURL(file);
  };
  if (!el.content.src) {
    return (
      <label
        className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl text-center"
        style={{ background: 'var(--surface-2)', color: 'var(--text-soft)' }}
      >
        <IconImage width={26} height={26} />
        <span className="text-xs">Subir imagen</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
    );
  }
  return (
    <div className="h-full w-full overflow-hidden rounded-xl">
      <img src={el.content.src} alt={el.content.alt ?? ''} className="h-full w-full object-cover" draggable={false} />
    </div>
  );
}

function FrameBody({
  el,
  setContent,
  selected,
}: {
  el: CanvasElement;
  setContent: (c: ElementContent) => void;
  selected: boolean;
}) {
  const color = el.color ?? '#5c9ea8';
  return (
    <div className="pointer-events-none h-full w-full">
      {/* Solo el borde, sin relleno, en el color del marco. */}
      <div
        className="absolute inset-0 rounded-xl"
        style={{ border: `2px solid ${color}`, opacity: selected ? 1 : 0.85 }}
      />
      <div className="pointer-events-auto absolute -top-7 left-0 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <input
          value={el.content.title ?? ''}
          onChange={(e) => setContent({ ...el.content, title: e.target.value })}
          placeholder="Marco"
          className="border-0 bg-transparent text-sm font-semibold outline-none"
          style={{ color, width: Math.max(80, (el.content.title?.length ?? 4) * 9) }}
        />
      </div>
    </div>
  );
}
