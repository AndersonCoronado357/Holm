import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cx } from '../lib/util';
import {
  DAY_LONG,
  MONTHS,
  MONTHS_SHORT,
  WEEK_LABELS,
  addDays,
  addMonths,
  fromKey,
  isToday,
  key,
  sameDay,
  sameMonth,
  startOfMonth,
  startOfWeek,
} from '../lib/calendar';
import { IconCalendar, IconChevronLeft, IconChevronRight } from './icons';

interface Props {
  value: string; // yyyy-MM-dd
  onChange: (v: string) => void;
}

/** Selector de fecha propio: no el del navegador, que no se puede peinar. */
export function CampoFecha({ value, onChange }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [cursor, setCursor] = useState(() => (value ? fromKey(value) : new Date()));
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // El panel va en un portal: si viviera dentro de un contenedor con transform,
  // `fixed` se mediría respecto a él y acabaría fuera de sitio.
  useLayoutEffect(() => {
    if (!abierto || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const ancho = 288;
    const alto = 340;
    const abajo = r.bottom + 8 + alto < window.innerHeight;
    setPos({
      top: abajo ? r.bottom + 8 : Math.max(8, r.top - alto - 8),
      left: Math.min(Math.max(8, r.left), window.innerWidth - ancho - 8),
    });
  }, [abierto]);

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

  const sel = value ? fromKey(value) : null;
  const inicio = startOfWeek(startOfMonth(cursor));
  const dias = Array.from({ length: 42 }, (_, i) => addDays(inicio, i));
  const elegir = (d: Date) => {
    onChange(key(d));
    setAbierto(false);
  };

  const etiqueta = sel ? `${DAY_LONG[sel.getDay()]} ${sel.getDate()} ${MONTHS_SHORT[sel.getMonth()]}` : 'Elegir fecha';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex h-12 w-full items-center gap-2.5 rounded-xl px-3.5 text-left text-[15px] font-semibold transition-colors hover:brightness-110"
        style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
      >
        <IconCalendar width={17} height={17} style={{ color: 'var(--text-soft)' }} />
        <span className="truncate capitalize">{etiqueta}</span>
      </button>

      {createPortal(
        <AnimatePresence>
          {abierto && (
            <motion.div
              ref={popRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="fixed z-[200] w-72 rounded-2xl p-3"
              style={{
                top: pos.top,
                left: pos.left,
                // Un panel flotante tiene que despegarse del fondo: va un tono
                // más claro y con un filo de 1px.
                background: 'var(--surface-2)',
                boxShadow: 'inset 0 0 0 1px var(--border)',
                transformOrigin: 'top center',
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <BotonMes onClick={() => setCursor((c) => addMonths(c, -1))} titulo="Mes anterior">
                  <IconChevronLeft width={16} height={16} />
                </BotonMes>
                <p className="text-sm font-bold capitalize" style={{ color: 'var(--text)' }}>
                  {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
                </p>
                <BotonMes onClick={() => setCursor((c) => addMonths(c, 1))} titulo="Mes siguiente">
                  <IconChevronRight width={16} height={16} />
                </BotonMes>
              </div>

              <div className="mb-1 grid grid-cols-7 gap-0.5 text-center">
                {WEEK_LABELS.map((d, i) => (
                  <span key={i} className="text-[10.5px] font-bold uppercase" style={{ color: 'var(--text-soft)' }}>
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {dias.map((d) => {
                  const esSel = sel && sameDay(d, sel);
                  const delMes = sameMonth(d, cursor);
                  return (
                    <button
                      key={key(d)}
                      type="button"
                      onClick={() => elegir(d)}
                      className={cx(
                        'aspect-square rounded-lg text-[12.5px] font-semibold transition-colors',
                        !esSel && 'hover:bg-[var(--surface-3)]',
                      )}
                      style={{
                        background: esSel ? 'var(--color-accent-500)' : undefined,
                        color: esSel ? '#fff' : delMes ? 'var(--text)' : 'var(--text-soft)',
                        opacity: delMes || esSel ? 1 : 0.45,
                        boxShadow: !esSel && isToday(d) ? 'inset 0 0 0 1.5px var(--color-accent-500)' : undefined,
                      }}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="text-[12.5px] font-bold"
                  style={{ color: 'var(--text-soft)' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => elegir(new Date())}
                  className="text-[12.5px] font-bold hover:underline"
                  style={{ color: 'var(--color-accent-500)' }}
                >
                  Hoy
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function BotonMes({ onClick, titulo, children }: { onClick: () => void; titulo: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--surface-3)]"
      style={{ color: 'var(--text-soft)' }}
    >
      {children}
    </button>
  );
}
