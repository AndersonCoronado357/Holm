import { motion } from 'framer-motion';
import type { ComponentType, PointerEvent as RPointerEvent, SVGProps } from 'react';
import { cx } from '../lib/util';

interface Props {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  active?: boolean;
  danger?: boolean;
  side?: 'right' | 'left';
  onClick: () => void;
  onPointerDown?: (e: RPointerEvent) => void;
}

// Item de isla: un botón SOLO icono. La etiqueta aparece al hacer hover como
// texto flotante (tooltip), sin recuadro, sin deformar el contenedor. Es
// per-item por definición: cada `.isla-chip:hover` muestra su propia `.isla-tip`.
export function IslaButton({ Icon, label, active, danger, side = 'right', onClick, onPointerDown }: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-label={label}
      className={cx(
        // 44 px en móvil: por debajo de eso el dedo falla más de lo que acierta.
        'isla-chip relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors md:h-10 md:w-10',
        active
          ? 'bg-accent-500 text-white'
          : danger
            ? 'text-red-500 hover:bg-red-500/10'
            : 'hover:bg-[var(--surface-3)]',
      )}
      style={active || danger ? undefined : { color: 'var(--text-soft)' }}
    >
      <Icon width={20} height={20} className="shrink-0" />
      <span className={cx('isla-tip', side === 'left' ? 'isla-tip-left' : 'isla-tip-below')}>{label}</span>
    </motion.button>
  );
}
