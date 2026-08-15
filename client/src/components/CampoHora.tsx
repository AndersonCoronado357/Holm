import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cx } from '../lib/util';
import { IconClock } from './icons';

interface Props {
  value: string; // HH:MM
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Salto de los minutos en la rueda. */
  paso?: number;
}

const dos = (n: number) => String(n).padStart(2, '0');

/** Selector de hora propio: dos ruedas, horas y minutos. */
export function CampoHora({ value, onChange, disabled = false, paso = 5 }: Props) {
  const [abierto, setAbierto] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const colHoras = useRef<HTMLDivElement>(null);
  const colMin = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const m = /^(\d{1,2}):(\d{1,2})$/.exec(value || '');
  const h = m ? Math.min(23, Math.max(0, Number(m[1]))) : 9;
  const mi = m ? Math.min(59, Math.max(0, Number(m[2]))) : 0;

  const HORAS = Array.from({ length: 24 }, (_, i) => i);
  const MINUTOS = Array.from({ length: Math.ceil(60 / paso) }, (_, i) => i * paso);

  useLayoutEffect(() => {
    if (!abierto || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const ancho = 208;
    const alto = 264;
    const abajo = r.bottom + 8 + alto < window.innerHeight;
    setPos({
      top: abajo ? r.bottom + 8 : Math.max(8, r.top - alto - 8),
      left: Math.min(Math.max(8, r.left), window.innerWidth - ancho - 8),
    });
  }, [abierto]);

  // Al abrir, dejar centrado el valor actual en cada rueda.
  useEffect(() => {
    if (!abierto) return;
    const centrar = (col: HTMLDivElement | null, attr: string, val: number) => {
      const btn = col?.querySelector<HTMLElement>(`[data-${attr}="${val}"]`);
      if (col && btn) col.scrollTop = btn.offsetTop - col.clientHeight / 2 + btn.clientHeight / 2;
    };
    requestAnimationFrame(() => {
      centrar(colHoras.current, 'h', h);
      centrar(colMin.current, 'm', MINUTOS.reduce((a, b) => (Math.abs(b - mi) < Math.abs(a - mi) ? b : a), 0));
    });
  }, [abierto, h, mi, MINUTOS]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setAbierto((v) => !v)}
        className="flex h-12 w-full items-center gap-2.5 rounded-xl px-3.5 text-left text-[15px] font-semibold tabular-nums transition-colors hover:brightness-110 disabled:opacity-40"
        style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
      >
        <IconClock width={17} height={17} style={{ color: 'var(--text-soft)' }} />
        {dos(h)}:{dos(mi)}
      </button>

      {createPortal(
        <AnimatePresence>
          {abierto && !disabled && (
            <motion.div
              ref={popRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="fixed z-[200] w-52 rounded-2xl p-2"
              style={{
                top: pos.top,
                left: pos.left,
                background: 'var(--surface-2)',
                boxShadow: 'inset 0 0 0 1px var(--border)',
                transformOrigin: 'top center',
              }}
            >
              <div className="mb-1 grid grid-cols-2 text-center">
                <span className="text-[10.5px] font-bold uppercase" style={{ color: 'var(--text-soft)' }}>
                  Hora
                </span>
                <span className="text-[10.5px] font-bold uppercase" style={{ color: 'var(--text-soft)' }}>
                  Min
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <Rueda
                  colRef={colHoras}
                  items={HORAS}
                  attr="h"
                  activo={h}
                  onPick={(v) => onChange(`${dos(v)}:${dos(mi)}`)}
                />
                <Rueda
                  colRef={colMin}
                  items={MINUTOS}
                  attr="m"
                  activo={mi}
                  onPick={(v) => onChange(`${dos(h)}:${dos(v)}`)}
                />
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="mt-2 w-full rounded-lg py-1.5 text-[12.5px] font-bold"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              >
                Listo
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function Rueda({
  colRef,
  items,
  attr,
  activo,
  onPick,
}: {
  colRef: React.RefObject<HTMLDivElement | null>;
  items: number[];
  attr: string;
  activo: number;
  onPick: (v: number) => void;
}) {
  return (
    <div ref={colRef} className="h-44 overflow-y-auto rounded-xl" style={{ background: 'var(--surface)' }}>
      <div className="flex flex-col gap-0.5 p-1">
        {items.map((v) => {
          const es = v === activo;
          return (
            <button
              key={v}
              type="button"
              {...{ [`data-${attr}`]: v }}
              onClick={() => onPick(v)}
              className={cx(
                'shrink-0 rounded-lg py-1.5 text-center text-[14px] font-semibold tabular-nums transition-colors',
                !es && 'hover:bg-[var(--surface-3)]',
              )}
              style={{ background: es ? 'var(--color-accent-500)' : undefined, color: es ? '#fff' : 'var(--text)' }}
            >
              {String(v).padStart(2, '0')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
