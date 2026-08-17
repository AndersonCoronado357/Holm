import { useState } from 'react';
import type { Frequency, FrequencyType, Habit, HabitMode } from '../api/types';
import { cx, WEEKDAY_LABELS } from '../lib/util';
import { IconCheck, IconMinus, IconTrash } from '../components/icons';

const COLORS = ['#21C2D9', '#FCA5A5', '#FDBA74', '#FDE68A', '#86EFAC', '#93C5FD', '#DDD6FE', '#FBCFE8'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface Props {
  initial?: Habit | null;
  onCancel: () => void;
  onSave: (data: Partial<Habit>) => void;
  onDelete?: () => void;
}

export function HabitForm({ initial, onCancel, onSave, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [mode, setMode] = useState<HabitMode>(initial?.mode ?? 'binary');
  const [unit, setUnit] = useState(initial?.unit ?? 'vasos');
  const [target, setTarget] = useState(initial?.target ?? 8);
  const [color, setColor] = useState(initial?.color ?? '#21C2D9');
  const [freqType, setFreqType] = useState<FrequencyType>(initial?.frequency.type ?? 'daily');
  const [weekdays, setWeekdays] = useState<number[]>(initial?.frequency.weekdays ?? [1, 2, 3, 4, 5]);
  const [timesPerWeek, setTimesPerWeek] = useState(initial?.frequency.timesPerWeek ?? 3);

  const toggleDay = (d: number) =>
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const save = () => {
    if (!name.trim()) return;
    const frequency: Frequency =
      freqType === 'weekdays'
        ? { type: 'weekdays', weekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5] }
        : freqType === 'timesPerWeek'
          ? { type: 'timesPerWeek', timesPerWeek }
          : { type: 'daily' };
    onSave({
      name: name.trim(),
      mode,
      unit: mode === 'quantity' ? unit : null,
      target: mode === 'quantity' ? target : null,
      frequency,
      color,
    });
  };

  return (
    <div className="scroll-area absolute inset-0" style={{ background: 'var(--surface)' }}>
      <div className="safe-bottom mx-auto flex min-h-full max-w-5xl flex-col px-4 pb-16 pt-20 md:px-10 md:pt-24">
        <button onClick={onCancel} className="mb-5 -ml-2 flex h-11 items-center self-start px-2 text-sm hover:underline md:mb-8" style={{ color: 'var(--text-soft)' }}>
          ← Volver a hábitos
        </button>

        {/* Nombre, como gran pregunta */}
        <p className="text-sm uppercase tracking-widest" style={{ color: 'var(--text-soft)' }}>
          {initial ? 'Editar hábito' : 'Nuevo hábito'}
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Beber agua, leer 20 min, salir a correr..."
          className="mt-2 h-12 w-full border-0 bg-transparent text-3xl font-bold leading-tight outline-none placeholder:opacity-30 md:text-4xl"
          style={{ color: 'var(--text)' }}
        />

        <div className="mt-9 grid grid-cols-1 gap-10 md:mt-14 md:gap-14 lg:grid-cols-2">
          {/* Como se marca */}
          <section>
            <SectionLabel>Cómo lo marcas</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <BigChoice active={mode === 'binary'} onClick={() => setMode('binary')} title="Hecho / no" desc="Un check al día" />
              <BigChoice active={mode === 'quantity'} onClick={() => setMode('quantity')} title="Cantidad" desc="Cuentas hacia una meta" />
            </div>
            {mode === 'quantity' && (
              <div className="mt-5 flex flex-wrap items-end gap-4">
                <div>
                  <span className="mb-1 block text-xs" style={{ color: 'var(--text-soft)' }}>
                    Meta diaria
                  </span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setTarget((t) => Math.max(1, t - 1))} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'var(--surface-3)', color: 'var(--text)' }}>
                      <IconMinus width={16} height={16} />
                    </button>
                    <span className="w-10 text-center text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                      {target}
                    </span>
                    <button onClick={() => setTarget((t) => t + 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-white">
                      +
                    </button>
                  </div>
                </div>
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="unidad"
                  className="afield w-40 text-lg"
                />
              </div>
            )}
          </section>

          {/* Frecuencia */}
          <section>
            <SectionLabel>Cada cuánto</SectionLabel>
            <div className="grid grid-cols-3 gap-3">
              <BigChoice active={freqType === 'daily'} onClick={() => setFreqType('daily')} title="Diario" desc="Todos los días" />
              <BigChoice active={freqType === 'weekdays'} onClick={() => setFreqType('weekdays')} title="Días" desc="Eliges cuáles" />
              <BigChoice active={freqType === 'timesPerWeek'} onClick={() => setFreqType('timesPerWeek')} title="Por semana" desc="X veces" />
            </div>
            {freqType === 'weekdays' && (
              <div className="mt-5 flex flex-wrap gap-2">
                {WEEK_ORDER.map((dd) => {
                  const on = weekdays.includes(dd);
                  return (
                    <button
                      key={dd}
                      onClick={() => toggleDay(dd)}
                      className={cx('h-11 w-11 rounded-2xl text-sm font-semibold transition', on ? 'bg-accent-500 text-white' : '')}
                      style={on ? undefined : { background: 'var(--surface-3)', color: 'var(--text-soft)' }}
                    >
                      {WEEKDAY_LABELS[dd]}
                    </button>
                  );
                })}
              </div>
            )}
            {freqType === 'timesPerWeek' && (
              <div className="mt-5 flex items-center gap-3">
                <button onClick={() => setTimesPerWeek((t) => Math.max(1, t - 1))} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'var(--surface-3)', color: 'var(--text)' }}>
                  <IconMinus width={16} height={16} />
                </button>
                <span className="w-10 text-center text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                  {timesPerWeek}
                </span>
                <button onClick={() => setTimesPerWeek((t) => Math.min(7, t + 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-white">
                  +
                </button>
                <span className="text-sm" style={{ color: 'var(--text-soft)' }}>
                  veces por semana
                </span>
              </div>
            )}
          </section>

          {/* Color */}
          <section className="lg:col-span-2">
            <SectionLabel>Color</SectionLabel>
            <div className="flex flex-wrap items-center gap-3">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cx('h-11 w-11 rounded-2xl transition', color === c ? 'scale-110 ring-2 ring-offset-2' : 'hover:scale-105')}
                  style={{ background: c, ['--tw-ring-color' as any]: 'var(--text)', ['--tw-ring-offset-color' as any]: 'var(--surface)' }}
                />
              ))}
              <label className="relative flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-2xl" style={{ background: 'var(--surface-3)' }}>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-11 cursor-pointer border-0 bg-transparent p-0 opacity-0" />
                <span className="pointer-events-none absolute h-6 w-6 rounded-full" style={{ background: color, boxShadow: 'inset 0 0 0 2px var(--surface)' }} />
              </label>
            </div>
          </section>
        </div>

        <div className="mt-10 flex items-center gap-4 md:mt-16">
          <button
            onClick={save}
            disabled={!name.trim()}
            className="rounded-full bg-accent-500 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-accent-600 disabled:opacity-40"
          >
            {initial ? 'Guardar cambios' : 'Crear hábito'}
          </button>
          <button onClick={onCancel} className="flex h-11 items-center px-2 text-sm font-medium hover:underline" style={{ color: 'var(--text-soft)' }}>
            Cancelar
          </button>
          {onDelete && (
            <button onClick={onDelete} className="ml-auto flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-500/10">
              <IconTrash width={16} height={16} /> Eliminar hábito
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-soft)' }}>
      {children}
    </h3>
  );
}

function BigChoice({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cx('rounded-2xl p-4 text-left transition', active ? 'bg-accent-500 text-white' : 'hover:brightness-95')}
      style={active ? undefined : { background: 'var(--surface-2)', color: 'var(--text)' }}
    >
      <span className="flex items-center gap-1.5 font-semibold">
        {active && <IconCheck width={15} height={15} />}
        {title}
      </span>
      <span className="mt-0.5 block text-xs" style={{ color: active ? 'rgba(255,255,255,.8)' : 'var(--text-soft)' }}>
        {desc}
      </span>
    </button>
  );
}
