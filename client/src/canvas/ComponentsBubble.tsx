import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { CanvasView, ElementContent, ElementType } from '../api/types';
import { IslaButton } from '../components/IslaButton';
import { useIslaOpen } from '../components/useIslaOpen';
import {
  IconBlocks,
  IconStickyNote,
  IconCard,
  IconType,
  IconList,
  IconImage,
  IconShape,
  IconFrame,
  IconArrow,
  IconDatabase,
} from '../components/icons';
import type { ComponentType, SVGProps } from 'react';
import { COLOR_BASE, TAMANO } from './viewport';

// Un preset aplica color/contenido por defecto al crear, así cada isla ofrece
// elementos con su propia identidad (no el mismo bloque genérico en todas).
export interface Preset {
  color?: string | null;
  content?: Partial<ElementContent>;
}
type Tool = {
  type: ElementType;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  color?: string | null;
  content?: Partial<ElementContent>;
};

// Paleta propia y temática de cada isla.
const VIEW_TOOLS: Record<CanvasView, Tool[]> = {
  tasks: [
    { type: 'list', label: 'Lista de tareas', Icon: IconList, content: { title: 'Por hacer' } },
    { type: 'card', label: 'Tarea', Icon: IconCard, color: '#93C5FD' },
    { type: 'note', label: 'Recordatorio', Icon: IconStickyNote, color: '#FDE68A' },
    { type: 'shape', label: 'Etiqueta', Icon: IconShape, color: '#86EFAC', content: { shape: 'rect', text: '' } },
    { type: 'frame', label: 'Sprint', Icon: IconFrame, content: { title: 'Sprint' } },
    { type: 'arrow', label: 'Flecha', Icon: IconArrow },
  ],
  projects: [
    { type: 'card', label: 'Proyecto', Icon: IconCard, color: '#A5B4FC' },
    { type: 'frame', label: 'Fase', Icon: IconFrame, content: { title: 'Fase' } },
    { type: 'shape', label: 'Hito', Icon: IconShape, color: '#FCA5A5', content: { shape: 'triangle', text: '' } },
    { type: 'list', label: 'Entregables', Icon: IconList, content: { title: 'Entregables' } },
    { type: 'image', label: 'Adjunto', Icon: IconImage },
    { type: 'arrow', label: 'Dependencia', Icon: IconArrow },
  ],
  notes: [
    { type: 'note', label: 'Nota', Icon: IconStickyNote },
    { type: 'text', label: 'Texto', Icon: IconType },
    { type: 'card', label: 'Cita', Icon: IconCard, color: '#FBCFE8' },
    { type: 'image', label: 'Imagen', Icon: IconImage },
    { type: 'list', label: 'Lista', Icon: IconList },
  ],
  ideas: [
    { type: 'note', label: 'Idea', Icon: IconStickyNote, color: '#DDD6FE' },
    { type: 'shape', label: 'Concepto', Icon: IconShape, color: '#99E4F0', content: { shape: 'ellipse', text: '' } },
    { type: 'text', label: 'Título', Icon: IconType },
    { type: 'image', label: 'Referencia', Icon: IconImage },
    { type: 'arrow', label: 'Conexión', Icon: IconArrow },
    { type: 'frame', label: 'Grupo', Icon: IconFrame, content: { title: 'Grupo' } },
  ],
  models: [
    { type: 'model', label: 'Tabla', Icon: IconDatabase },
    { type: 'arrow', label: 'Relación', Icon: IconArrow },
    { type: 'shape', label: 'Vista', Icon: IconShape, color: '#94A3B8', content: { shape: 'rect', text: 'Vista' } },
    { type: 'note', label: 'Nota', Icon: IconStickyNote },
    { type: 'frame', label: 'Esquema', Icon: IconFrame, content: { title: 'Esquema' } },
  ],
};

const spring = { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 } as const;

/**
 * Miniatura de lo que vas a soltar: cada tipo se dibuja con SU forma, no con un
 * rectángulo genérico. Es la misma pinta que tendrá una vez en el lienzo.
 */
function Miniatura({ tool }: { tool: Tool }) {
  const color = tool.color ?? COLOR_BASE[tool.type] ?? '#21C2D9';
  const forma = tool.content?.shape ?? 'rect';

  switch (tool.type) {
    case 'note':
      return (
        <div className="flex h-full w-full flex-col gap-1.5 rounded-xl p-3" style={{ background: color }}>
          <Renglon w="70%" oscuro />
          <Renglon w="90%" oscuro />
          <Renglon w="45%" oscuro />
        </div>
      );

    case 'card':
      return (
        <div className="flex h-full w-full flex-col overflow-hidden rounded-xl" style={{ background: 'var(--surface-2)' }}>
          <div className="h-1.5 w-full shrink-0" style={{ background: color }} />
          <div className="flex flex-col gap-1.5 p-3">
            <Renglon w="65%" />
            <Renglon w="85%" />
          </div>
        </div>
      );

    case 'text':
      return (
        <div className="flex h-full w-full items-center">
          <span className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Texto
          </span>
        </div>
      );

    case 'list':
      return (
        <div className="flex h-full w-full flex-col overflow-hidden rounded-xl" style={{ background: 'var(--surface-2)' }}>
          <div className="flex shrink-0 items-center gap-2 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            <Renglon w="55%" alto />
          </div>
          <div className="flex flex-col gap-2 px-3 pb-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: 'var(--surface-3)' }} />
                <Renglon w={['70%', '55%', '80%'][i]} />
              </div>
            ))}
          </div>
        </div>
      );

    case 'model':
      return (
        <div className="flex h-full w-full flex-col overflow-hidden rounded-xl" style={{ background: 'var(--surface-2)' }}>
          <div className="flex shrink-0 items-center gap-2 px-3 py-2" style={{ background: color }}>
            <IconDatabase width={14} height={14} style={{ color: '#fff' }} />
            <span className="h-2 w-16 rounded-full" style={{ background: 'rgba(255,255,255,.75)' }} />
          </div>
          <div className="flex flex-col gap-2 px-3 py-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: i === 0 ? color : 'var(--surface-3)' }} />
                <Renglon w={['45%', '60%', '52%'][i]} />
                <span className="ml-auto h-2 w-6 rounded-full" style={{ background: 'var(--surface-3)' }} />
              </div>
            ))}
          </div>
        </div>
      );

    case 'shape':
      if (forma === 'ellipse') return <div className="h-full w-full rounded-full" style={{ background: color }} />;
      if (forma === 'triangle')
        return (
          <div
            className="h-full w-full"
            style={{ background: color, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }}
          />
        );
      return <div className="h-full w-full rounded-[10px]" style={{ background: color }} />;

    case 'image':
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl"
          style={{ background: 'var(--surface-2)', color: 'var(--text-soft)' }}
        >
          <IconImage width={26} height={26} />
          <span className="text-xs">Imagen</span>
        </div>
      );

    case 'frame':
      // Sólo el borde, como es en el lienzo, con su etiqueta encima.
      return (
        <div className="relative h-full w-full">
          <div className="absolute -top-5 left-0 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <span className="text-xs font-semibold" style={{ color }}>
              {tool.content?.title ?? 'Marco'}
            </span>
          </div>
          <div className="absolute inset-0 rounded-xl" style={{ border: `2px solid ${color}` }} />
        </div>
      );

    case 'arrow':
      return (
        <div className="flex h-full w-full items-center">
          <svg width="100%" height="20" viewBox="0 0 160 20" fill="none" preserveAspectRatio="none">
            <path d="M4 10 H140" stroke="var(--conn)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M140,4 L152,10 L140,16 z" fill="var(--conn)" />
          </svg>
        </div>
      );

    default:
      return <div className="h-full w-full rounded-xl" style={{ background: color }} />;
  }
}

// Renglón simulado de texto, para que la miniatura se lea como contenido.
function Renglon({ w, oscuro, alto }: { w: string; oscuro?: boolean; alto?: boolean }) {
  return (
    <span
      className="block rounded-full"
      style={{
        width: w,
        height: alto ? 9 : 7,
        background: oscuro ? 'rgba(27,31,35,.30)' : 'var(--surface-3)',
      }}
    />
  );
}

export function ComponentsBubble({
  view,
  onAdd,
  scale = 1,
}: {
  view: CanvasView;
  onAdd: (type: ElementType, clientX?: number, clientY?: number, preset?: Preset) => void;
  /** Zoom del lienzo, para que la vista previa mida lo que va a medir de verdad. */
  scale?: number;
}) {
  const { open, setOpen, hoverProps } = useIslaOpen();
  const TOOLS = VIEW_TOOLS[view] ?? VIEW_TOOLS.notes;
  const [drag, setDrag] = useState<{ tool: Tool; x: number; y: number; moved: boolean } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  // Sólo se crea arrastrando la herramienta al lienzo y soltándola ahí. Un toque
  // sin arrastrar no crea nada (así ves qué arrastras antes de soltar).
  useEffect(() => {
    if (!drag) return;
    const tool = drag.tool;
    const s = start.current;
    const onMove = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, moved: true } : d));
    const onUp = (e: PointerEvent) => {
      const moved = s ? Math.hypot(e.clientX - s.x, e.clientY - s.y) > 6 : false;
      // La paleta se queda abierta: si se cerrara, el siguiente arrastre caería
      // en el lienzo vacío y movería el tablero en vez de crear otro elemento.
      if (moved) onAdd(tool.type, e.clientX, e.clientY, { color: tool.color, content: tool.content });
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.tool.label]);

  const startDrag = (tool: Tool, e: RPointerEvent) => {
    e.stopPropagation();
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ tool, x: e.clientX, y: e.clientY, moved: false });
  };

  const Ghost = drag?.tool.Icon;

  return (
    <div {...hoverProps} data-isla className="fixed right-5 top-1/2 z-30 flex -translate-y-1/2 flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, x: 4 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.98, x: 4 }}
            transition={spring}
            style={{ transformOrigin: 'right center', background: 'var(--surface)' }}
            className="flex select-none flex-col items-end gap-0.5 rounded-3xl p-1.5"
          >
            {/* El `onPointerDown` va en este envoltorio y NO en el botón: los
                botones son de framer-motion y sus propios gestos se comen el
                handler, así que el arrastre no llegaba a arrancar. */}
            {TOOLS.map((tool) => (
              <div key={tool.label} onPointerDown={(e) => startDrag(tool, e)}>
                <IslaButton side="left" Icon={tool.Icon} label={tool.label} onClick={() => {}} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vista previa de lo que estás soltando: del tamaño real que tendrá y
          pegada al cursor, para no arrastrar «a ciegas».
          Va en un portal al body A PROPÓSITO: el contenedor de la paleta lleva un
          `translate`, y un ancestro con transform hace que `position: fixed` se
          mida respecto a ÉL y no a la ventana — la vista previa acababa dibujada
          fuera de la pantalla. */}
      {drag?.moved && createPortal(
        <div
          className="pointer-events-none fixed z-[60]"
          style={{
            left: drag.x,
            top: drag.y,
            width: TAMANO[drag.tool.type].w * scale,
            height: Math.max(30, TAMANO[drag.tool.type].h * scale),
            transform: 'translate(-50%, -50%)',
            opacity: 0.9,
          }}
        >
          <Miniatura tool={drag.tool} />
          {/* Nombre debajo, para no dejar duda de qué vas a soltar. */}
          <span
            className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-semibold"
            style={{ background: 'var(--surface)', color: 'var(--text)' }}
          >
            {drag.tool.label}
          </span>
        </div>,
        document.body,
      )}

      {!open && (
        <motion.button
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setOpen(true)}
          title="Agregar componente"
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'var(--surface)', color: 'var(--text-soft)' }}
        >
          <IconBlocks width={20} height={20} />
        </motion.button>
      )}
    </div>
  );
}
