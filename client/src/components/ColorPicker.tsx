import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { motion } from 'framer-motion';
import { cx } from '../lib/util';
import { IconClose } from './icons';

const SWATCHES = [
  '#FDE68A',
  '#FCA5A5',
  '#FBCFE8',
  '#DDD6FE',
  '#A5B4FC',
  '#93C5FD',
  '#21C2D9',
  '#99E4F0',
  '#86EFAC',
  '#FDBA74',
  '#E5E7EB',
  '#94A3B8',
];

interface Props {
  value: string | null;
  onChange: (color: string | null) => void;
  onClose: () => void;
}

/* ---- HSV <-> hex ---- */
type Hsv = { h: number; s: number; v: number };
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function hexToHsv(hex: string): Hsv {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  let r = 0.13;
  let g = 0.76;
  let b = 0.85;
  if (m) {
    const n = parseInt(m[1], 16);
    r = ((n >> 16) & 255) / 255;
    g = ((n >> 8) & 255) / 255;
    b = (n & 255) / 255;
  }
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g] = [c, x];
  else if (h < 120) [r, g] = [x, c];
  else if (h < 180) [g, b] = [c, x];
  else if (h < 240) [g, b] = [x, c];
  else if (h < 300) [r, b] = [x, c];
  else [r, b] = [c, x];
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Arrastre sobre un área: llama a `onPos` con la posición relativa (0..1).
function useDrag(onPos: (fx: number, fy: number, rect: DOMRect) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = (e: RPointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    onPos(clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height), r);
  };
  const down = (e: RPointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handle(e);
  };
  const move = (e: RPointerEvent) => {
    if (e.buttons !== 1) return;
    handle(e);
  };
  return { ref, onPointerDown: down, onPointerMove: move };
}

function HsvPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const apply = (next: Partial<Hsv>) => {
    const h = { ...hsv, ...next };
    setHsv(h);
    onChange(hsvToHex(h));
  };
  const sv = useDrag((fx, fy) => apply({ s: fx, v: 1 - fy }));
  const hue = useDrag((fx) => apply({ h: fx * 360 }));
  const hueColor = `hsl(${Math.round(hsv.h)}, 100%, 50%)`;
  const hex = hsvToHex(hsv);

  return (
    <div className="mt-3">
      <div
        ref={sv.ref}
        onPointerDown={sv.onPointerDown}
        onPointerMove={sv.onPointerMove}
        className="relative h-28 w-full cursor-crosshair rounded-lg"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
          touchAction: 'none',
        }}
      >
        <span
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, boxShadow: '0 0 0 1px rgba(0,0,0,.35)' }}
        />
      </div>
      <div
        ref={hue.ref}
        onPointerDown={hue.onPointerDown}
        onPointerMove={hue.onPointerMove}
        className="relative mt-2.5 h-3 w-full cursor-pointer rounded-full"
        style={{
          background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
          touchAction: 'none',
        }}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
          style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor, boxShadow: '0 0 0 1px rgba(0,0,0,.35)' }}
        />
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="h-6 w-6 shrink-0 rounded-md" style={{ background: hex }} />
        <input
          value={hex}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
              setHsv(hexToHsv(v));
              onChange(v);
            }
          }}
          className="w-full rounded-md px-2 py-1.5 text-xs outline-none"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
        />
      </div>
    </div>
  );
}

export function ColorPicker({ value, onChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.9 }}
      className="absolute z-50 w-60 rounded-xl p-3"
      style={{ background: 'var(--surface)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
          Color del elemento
        </span>
        <button
          onClick={onClose}
          className="rounded p-0.5 hover:bg-[var(--surface-3)]"
          style={{ color: 'var(--text-soft)' }}
        >
          <IconClose width={14} height={14} />
        </button>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {SWATCHES.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={cx(
              'h-7 w-7 rounded-md transition',
              value?.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-offset-1' : 'hover:scale-110',
            )}
            style={{
              background: c,
              ['--tw-ring-color' as never]: 'var(--color-accent-500)',
              ['--tw-ring-offset-color' as never]: 'var(--surface)',
            }}
            title={c}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setCustom((v) => !v)}
          className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-[var(--surface-3)]"
          style={{ background: custom ? 'var(--surface-3)' : 'var(--surface-2)', color: 'var(--text-soft)' }}
        >
          <span className="h-5 w-5 rounded" style={{ background: value ?? '#21C2D9' }} />
          Personalizado
        </button>
        <button
          onClick={() => onChange(null)}
          className="rounded-md px-2 py-1.5 text-xs hover:bg-[var(--surface-3)]"
          style={{ background: 'var(--surface-2)', color: 'var(--text-soft)' }}
        >
          Sin color
        </button>
      </div>

      {custom && <HsvPicker value={value ?? '#21C2D9'} onChange={onChange} />}
    </motion.div>
  );
}
