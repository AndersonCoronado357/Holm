import { useState } from 'react';
import type { CanvasElement } from '../api/types';
import type { ArrowType, Routing } from './connectors';
import { ColorPicker } from '../components/ColorPicker';
import {
  IconPalette,
  IconTrash,
  IconCopy,
  IconLock,
  IconUnlock,
  IconBringFront,
  IconSendBack,
  IconShape,
} from '../components/icons';

interface Props {
  el: CanvasElement;
  onColor: (color: string | null) => void;
  onShape: (shape: 'rect' | 'ellipse' | 'triangle') => void;
  onRouting: (routing: Routing) => void;
  onArrowType: (arrow: ArrowType) => void;
  onStraighten: () => void;
  onZ: (dir: 'front' | 'back') => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

// Íconos de routing (viewBox 0 0 20 14).
const ROUTING_ICONS: Record<Routing, string> = {
  straight: 'M2 7 H18',
  ortho: 'M2 12 H10 V3 H18',
  curved: 'M2 12 C8 12 8 3 18 3',
};

// Íconos de tipo de flecha: línea + terminación. { d: línea, head: JSX aparte }
const ARROW_TYPES: { type: ArrowType; title: string }[] = [
  { type: 'none', title: 'Sin flecha' },
  { type: 'arrow', title: 'Flecha' },
  { type: 'both', title: 'Doble flecha' },
  { type: 'open', title: 'Flecha abierta' },
  { type: 'circle', title: 'Círculo' },
  { type: 'diamond', title: 'Diamante' },
];

function ArrowTypeIcon({ type }: { type: ArrowType }) {
  const c = 'currentColor';
  return (
    <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
      {type === 'both' && <path d={`M8,2 L2,6 L8,10 z`} fill={c} />}
      <path
        d={type === 'none' ? 'M2 6 H22' : type === 'diamond' ? 'M2 6 H15' : type === 'circle' ? 'M2 6 H16' : 'M4 6 H16'}
        stroke={c}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {type === 'arrow' && <path d="M16,2 L22,6 L16,10 z" fill={c} />}
      {type === 'both' && <path d="M16,2 L22,6 L16,10 z" fill={c} />}
      {type === 'open' && <path d="M16,2 L22,6 L16,10" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
      {type === 'circle' && <circle cx="19" cy="6" r="3" fill={c} />}
      {type === 'diamond' && <path d="M15,6 L19,2 L23,6 L19,10 z" fill={c} />}
    </svg>
  );
}

function TBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--surface-3)]"
      style={{ color: 'var(--text-soft)' }}
    >
      {children}
    </button>
  );
}

export function ElementToolbar({
  el,
  onColor,
  onShape,
  onRouting,
  onArrowType,
  onStraighten,
  onZ,
  onToggleLock,
  onDuplicate,
  onDelete,
}: Props) {
  const [picker, setPicker] = useState(false);
  const swatch = el.color ?? '#94a3b8';
  const routing: Routing = el.content.routing ?? (el.content.lineShape === 'curved' ? 'curved' : 'straight');
  const arrowType: ArrowType = el.content.arrowType ?? 'arrow';

  return (
    <div
      className="relative flex items-center gap-0.5 rounded-xl p-1"
      style={{ background: 'var(--surface)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setPicker((v) => !v)}
        title="Color"
        className="flex h-8 items-center gap-1.5 rounded-lg px-2 hover:bg-[var(--surface-3)]"
        style={{ color: 'var(--text-soft)' }}
      >
        <IconPalette width={17} height={17} />
        <span className="h-4 w-4 rounded-full" style={{ background: swatch }} />
      </button>

      {el.type === 'shape' && (
        <>
          <div className="mx-0.5 h-5 w-px" style={{ background: 'var(--border)' }} />
          {(['rect', 'ellipse', 'triangle'] as const).map((s) => (
            <button
              key={s}
              onClick={() => onShape(s)}
              title={s}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--surface-3)]"
              style={{ color: el.content.shape === s ? 'var(--text)' : 'var(--text-soft)' }}
            >
              {s === 'rect' && <IconShape width={16} height={16} />}
              {s === 'ellipse' && <span className="h-4 w-4 rounded-full border-2 border-current" />}
              {s === 'triangle' && (
                <span
                  className="h-0 w-0"
                  style={{
                    borderLeft: '7px solid transparent',
                    borderRight: '7px solid transparent',
                    borderBottom: '12px solid currentColor',
                  }}
                />
              )}
            </button>
          ))}
        </>
      )}

      {el.type === 'arrow' && (
        <>
          <div className="mx-0.5 h-5 w-px" style={{ background: 'var(--border)' }} />
          {(['straight', 'ortho', 'curved'] as const).map((r) => (
            <button
              key={r}
              onClick={() => onRouting(r)}
              title={r === 'straight' ? 'Recta' : r === 'ortho' ? 'Ortogonal' : 'Curva'}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--surface-3)]"
              style={{ color: routing === r ? 'var(--text)' : 'var(--text-soft)' }}
            >
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                <path d={ROUTING_ICONS[r]} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
          <div className="mx-0.5 h-5 w-px" style={{ background: 'var(--border)' }} />
          {ARROW_TYPES.map(({ type, title }) => (
            <button
              key={type}
              onClick={() => onArrowType(type)}
              title={title}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--surface-3)]"
              style={{ color: arrowType === type ? 'var(--text)' : 'var(--text-soft)' }}
            >
              <ArrowTypeIcon type={type} />
            </button>
          ))}
          <div className="mx-0.5 h-5 w-px" style={{ background: 'var(--border)' }} />
          {/* Red de seguridad: rehace la línea limpia (mejor lado, sin ajustes).
              Sólo a petición; el automático nunca pisa lo hecho a mano (§3). */}
          <TBtn onClick={onStraighten} title="Reordenar la línea">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <path d="M1 11 H6 V3 H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 1 L17 3 L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </TBtn>
        </>
      )}

      <div className="mx-0.5 h-5 w-px" style={{ background: 'var(--border)' }} />
      <TBtn onClick={() => onZ('front')} title="Traer al frente">
        <IconBringFront width={17} height={17} />
      </TBtn>
      <TBtn onClick={() => onZ('back')} title="Enviar atrás">
        <IconSendBack width={17} height={17} />
      </TBtn>
      <TBtn onClick={onToggleLock} title={el.locked ? 'Desbloquear' : 'Bloquear'}>
        {el.locked ? <IconLock width={17} height={17} /> : <IconUnlock width={17} height={17} />}
      </TBtn>
      <TBtn onClick={onDuplicate} title="Duplicar">
        <IconCopy width={17} height={17} />
      </TBtn>
      <div className="mx-0.5 h-5 w-px" style={{ background: 'var(--border)' }} />
      <button
        onClick={onDelete}
        title="Eliminar"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10"
      >
        <IconTrash width={17} height={17} />
      </button>

      {picker && (
        <div className="absolute left-0 top-11">
          <ColorPicker value={el.color} onChange={(c) => onColor(c)} onClose={() => setPicker(false)} />
        </div>
      )}
    </div>
  );
}
