import { useState } from 'react';
import { motion } from 'framer-motion';
import type { CalendarEvent } from '../api/types';
import { DAY_LONG, MONTHS, fromKey, key } from '../lib/calendar';
import { CampoFecha } from '../components/CampoFecha';
import { CampoHora } from '../components/CampoHora';
import { Interruptor, SelectorColor } from '../components/SelectorColor';
import { IconCheck, IconChevronLeft, IconTrash } from '../components/icons';

interface Props {
  initial?: CalendarEvent | null;
  date: Date;
  onCancel: () => void;
  onSave: (data: Partial<CalendarEvent>) => void;
  onDelete?: () => void;
}

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Vista de creación a pantalla completa, con la misma estructura que la de Hibi:
 * barra con volver + guardar, campos en cascada y el selector de color ocupando
 * todo el alto que sobra.
 */
export function EventForm({ initial, date, onCancel, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [eventDate, setEventDate] = useState(initial?.eventDate ?? key(date));
  const [allDay, setAllDay] = useState(initial ? !initial.startTime : false);
  const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '10:00');
  const [color, setColor] = useState(initial?.color ?? '#21C2D9');

  const puedeGuardar = !!title.trim();
  const save = () => {
    if (!puedeGuardar) return;
    onSave({
      title: title.trim(),
      eventDate,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      color,
    });
  };

  const d = fromKey(eventDate);
  const cuando =
    `${DAY_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}` +
    (allDay ? ' · todo el día' : ` · ${startTime} – ${endTime}`);

  // Cada bloque entra en cascada.
  const bloque = (i: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.04 + i * 0.05, duration: 0.32, ease },
  });

  return (
    // Ocupa el módulo entero: sin scroll de página, el formulario reparte el alto.
    <section className="absolute inset-0 flex flex-col gap-4 overflow-hidden px-4 pb-5 pt-20 md:px-7">
      {/* Barra: volver · título · guardar */}
      <header className="flex shrink-0 items-center justify-between gap-3">
        <button
          onClick={onCancel}
          className="inline-flex h-12 items-center gap-2 rounded-full pl-3 pr-5 text-sm font-bold transition-colors hover:brightness-110"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
        >
          <IconChevronLeft width={18} height={18} />
          Volver
        </button>

        <div className="hidden min-w-0 flex-1 text-center md:block">
          <h1 className="truncate text-lg font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
            {initial ? 'Editar evento' : 'Nuevo evento'}
          </h1>
          <p className="truncate text-[12.5px] leading-tight" style={{ color: 'var(--text-soft)' }}>
            {cuando}
          </p>
        </div>

        <button
          onClick={save}
          disabled={!puedeGuardar}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent-500 px-6 text-sm font-bold text-white transition-opacity hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconCheck width={16} height={16} />
          Guardar
        </button>
      </header>

      {/* Título en móvil */}
      <div className="shrink-0 md:hidden">
        <h1 className="text-[22px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
          {initial ? 'Editar evento' : 'Nuevo evento'}
        </h1>
        <p className="mt-0.5 text-[13px] leading-tight" style={{ color: 'var(--text-soft)' }}>
          {cuando}
        </p>
      </div>

      {/* Cuerpo: reparte el alto, el color se queda con lo que sobra */}
      <div className="flex min-h-0 w-full flex-1 flex-col gap-5 overflow-y-auto">
        <motion.div {...bloque(0)} className="flex shrink-0 flex-col gap-2">
          <Etiqueta>Título</Etiqueta>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="¿Qué vas a hacer?"
            className="h-14 w-full rounded-[14px] px-4 text-[18px] font-semibold outline-none placeholder:opacity-40"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          />
        </motion.div>

        <motion.div {...bloque(1)} className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Etiqueta>Fecha</Etiqueta>
            <CampoFecha value={eventDate} onChange={setEventDate} />
          </div>
          <div className="flex flex-col gap-2">
            <Etiqueta>Empieza</Etiqueta>
            <CampoHora value={startTime} onChange={setStartTime} disabled={allDay} />
          </div>
          <div className="flex flex-col gap-2">
            <Etiqueta>Termina</Etiqueta>
            <CampoHora value={endTime} onChange={setEndTime} disabled={allDay} />
          </div>
        </motion.div>

        <motion.div {...bloque(2)} className="flex shrink-0 items-center gap-2.5">
          <Interruptor on={allDay} onToggle={() => setAllDay((v) => !v)} />
          <span
            className="cursor-pointer text-sm font-semibold"
            style={{ color: 'var(--text)' }}
            onClick={() => setAllDay((v) => !v)}
          >
            Todo el día
          </span>
        </motion.div>

        {/* Color: se queda con el alto restante */}
        <motion.div {...bloque(3)} className="flex min-h-0 flex-1 flex-col gap-2">
          <Etiqueta>Color</Etiqueta>
          <div className="min-h-0 flex-1">
            <SelectorColor value={color} onChange={setColor} />
          </div>
        </motion.div>

        {onDelete && (
          <div className="flex shrink-0 justify-end">
            <button
              onClick={onDelete}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold text-red-500 transition-colors hover:bg-red-500/10"
            >
              <IconTrash width={15} height={15} />
              Eliminar evento
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <label className="px-1 text-[12.5px] font-bold" style={{ color: 'var(--text-soft)' }}>
      {children}
    </label>
  );
}
