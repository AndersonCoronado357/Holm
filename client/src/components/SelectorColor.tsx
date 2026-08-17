import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { IconCheck } from './icons';

// Selector de color en línea: fila de presets + cuadrado de saturación/brillo +
// barra de tono + campo HEX. Réplica del de Hibi.
const PRESETS = ['#21C2D9', '#34936A', '#C5733F', '#DB8AA3', '#7A63C0', '#BF8F2E', '#E0654D', '#56A8A8'];

interface Hsv {
  h: number;
  s: number;
  v: number;
}

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.replace('#', '') ? hex : '#21C2D9');
  let h = (m ? m[1] : '21C2D9').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function rgbToHex(r: number, g: number, b: number) {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbToHsv(r: number, g: number, b: number): Hsv {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, v };
}
function hsvToRgb(h: number, s: number, v: number) {
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
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function SelectorColor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const rgb = hexToRgb(value);
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(rgb.r, rgb.g, rgb.b));
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const emitir = (n: Hsv) => {
    setHsv(n);
    const c = hsvToRgb(n.h, n.s, n.v);
    onChange(rgbToHex(c.r, c.g, c.b));
  };

  const tono = (() => {
    const c = hsvToRgb(hsv.h, 1, 1);
    return rgbToHex(c.r, c.g, c.b);
  })();

  const enSV = (e: RPointerEvent) => {
    const r = svRef.current!.getBoundingClientRect();
    emitir({
      ...hsv,
      s: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      v: 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    });
  };
  const enTono = (e: RPointerEvent) => {
    const r = hueRef.current!.getBoundingClientRect();
    emitir({ ...hsv, h: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 360 });
  };

  const ponerHex = (raw: string) => {
    let h = raw.trim().replace(/^#/, '');
    if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(h)) return;
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const c = hexToRgb('#' + h);
    const n = rgbToHsv(c.r, c.g, c.b);
    setHsv(n.s === 0 ? { ...n, h: hsv.h } : n);
    onChange('#' + h.toLowerCase());
  };

  return (
    <div className="flex h-full min-h-[260px] w-full flex-col gap-3">
      {/* Presets, siempre en una sola fila */}
      <div className="flex shrink-0 items-center gap-2">
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            onClick={() => {
              const x = hexToRgb(c);
              setHsv(rgbToHsv(x.r, x.g, x.b));
              onChange(c);
            }}
            className="grid size-9 shrink-0 place-items-center rounded-full transition-transform hover:scale-110"
            style={{ background: c }}
          >
            {value.toLowerCase() === c.toLowerCase() && <IconCheck width={14} height={14} style={{ color: '#fff' }} />}
          </button>
        ))}
      </div>

      {/* Cuadrado saturación / brillo: ocupa el alto disponible */}
      <div
        ref={svRef}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          enSV(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && enSV(e)}
        className="relative min-h-[120px] w-full flex-1 cursor-crosshair select-none overflow-hidden rounded-xl"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${tono})`,
          touchAction: 'none',
        }}
      >
        <span
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, boxShadow: '0 0 0 1px rgba(0,0,0,.4)' }}
        />
      </div>

      {/* Barra de tono. La barra se ve de 10 px (como en Hibi) pero el agarre
          va en el envoltorio, que mide 30: con el dedo, 10 px no se acierta.
          El ancho es el mismo en los dos, así que la cuenta de la X no cambia. */}
      <div
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          enTono(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && enTono(e)}
        className="-my-2.5 flex w-full shrink-0 cursor-pointer select-none items-center py-2.5"
        style={{ touchAction: 'none' }}
      >
        <div
          ref={hueRef}
          className="relative h-2.5 w-full rounded-full"
          style={{
            background:
              'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
          }}
        >
          <span
            className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{ left: `${(hsv.h / 360) * 100}%`, background: tono }}
          />
        </div>
      </div>

      {/* HEX */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="size-9 shrink-0 rounded-lg" style={{ background: value }} />
        <div className="flex h-9 flex-1 items-center rounded-lg px-3" style={{ background: 'var(--surface-3)' }}>
          <span className="mr-2 text-[11px] font-bold" style={{ color: 'var(--text-soft)' }}>
            HEX
          </span>
          <input
            value={value.toUpperCase()}
            maxLength={7}
            onChange={(e) => ponerHex(e.target.value)}
            className="h-full w-0 flex-1 bg-transparent text-[13px] font-bold uppercase tracking-wide tabular-nums outline-none"
            style={{ color: 'var(--text)' }}
          />
        </div>
      </div>
    </div>
  );
}

/** Interruptor deslizante, como el de Hibi (no un cuadrado de marcar). */
export function Interruptor({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200"
      style={{ background: on ? 'var(--color-accent-500)' : 'var(--surface-3)' }}
    >
      <span
        className="absolute left-0.5 grid size-6 place-items-center rounded-full transition-transform duration-200"
        style={{ background: 'var(--surface)', transform: on ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}
