import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Habit } from '../api/types';
import { api } from '../api/client';
import { addDays, cx, isoDate, WEEKDAY_NAMES } from '../lib/util';
import { computeStreak, frequencyLabel, isDone, isScheduled, weeklyCount } from '../lib/streak';
import { HabitForm } from './HabitForm';
import { IconPlus, IconCheck, IconMinus, IconHabits, IconPencil } from '../components/icons';

const ease = [0.22, 1, 0.36, 1] as const;

type ValueMap = Record<string, Record<string, number>>;

export function HabitsView() {
  const today = isoDate();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [values, setValues] = useState<ValueMap>({});
  const [editing, setEditing] = useState<{ habit: Habit | null } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const list = await api.habits.list();
    const logs = await api.logs.range(addDays(today, -120), today);
    const map: ValueMap = {};
    for (const l of logs) (map[l.habitId] ??= {})[l.date] = l.value;
    setHabits(list);
    setValues(map);
    setLoaded(true);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getter = (habitId: string) => (date: string) => values[habitId]?.[date] ?? 0;

  const setValue = (habit: Habit, value: number) => {
    const v = Math.max(0, value);
    setValues((prev) => ({ ...prev, [habit.id]: { ...prev[habit.id], [today]: v } }));
    api.logs.set(habit.id, today, v).catch(() => {});
  };

  const todays = useMemo(() => habits.filter((h) => isScheduled(h, today)), [habits, today]);

  const save = async (data: Partial<Habit>) => {
    if (editing?.habit) {
      const updated = await api.habits.update(editing.habit.id, data);
      setHabits((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
    } else {
      const created = await api.habits.create(data);
      setHabits((prev) => [...prev, created]);
    }
    setEditing(null);
  };

  const del = async () => {
    if (!editing?.habit) return;
    await api.habits.remove(editing.habit.id);
    setHabits((prev) => prev.filter((h) => h.id !== editing.habit!.id));
    setEditing(null);
  };

  if (editing) {
    return <HabitForm initial={editing.habit} onCancel={() => setEditing(null)} onSave={save} onDelete={editing.habit ? del : undefined} />;
  }

  const dateLabel = `${WEEKDAY_NAMES[new Date(today + 'T00:00:00').getDay()]} ${Number(today.slice(8))}`;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: 'var(--surface)' }}>
      <header className="cab-corta flex shrink-0 items-end justify-between gap-3 px-4 pb-4 pt-20 md:px-10 md:pb-6 md:pt-24">
        <div>
          <p className="text-sm capitalize" style={{ color: 'var(--text-soft)' }}>
            {dateLabel} · hoy
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: 'var(--text)' }}>
            Hábitos
          </h1>
        </div>
        <button
          onClick={() => setEditing({ habit: null })}
          className="flex items-center gap-2 rounded-full bg-accent-500 px-5 py-3 text-sm font-semibold text-white hover:bg-accent-600"
        >
          <IconPlus width={18} height={18} /> Nuevo hábito
        </button>
      </header>

      <div className="safe-bottom scroll-area min-h-0 flex-1 px-4 md:px-10">
        {loaded && habits.length === 0 && <Empty onCreate={() => setEditing({ habit: null })} />}

        {loaded && habits.length > 0 && todays.length === 0 && (
          <p className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface-2)', color: 'var(--text-soft)' }}>
            Hoy no toca ningún hábito. Disfruta el día.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {todays.map((habit, i) => {
            const value = values[habit.id]?.[today] ?? 0;
            const done = isDone(habit, value);
            const streak = computeStreak(habit, getter(habit.id), today);
            const week = habit.frequency.type === 'timesPerWeek' ? weeklyCount(habit, getter(habit.id), today) : null;
            return (
              <motion.div
                key={habit.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 + i * 0.05, duration: 0.35, ease }}
                className="flex items-center gap-4 rounded-2xl p-5"
                style={{ background: 'var(--surface-2)' }}
              >
                <span className="h-12 w-1.5 shrink-0 rounded-full" style={{ background: habit.color ?? '#21C2D9' }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-lg font-semibold" style={{ color: 'var(--text)' }}>
                      {habit.name}
                    </span>
                    <button onClick={() => setEditing({ habit })} className="shrink-0 opacity-40 hover:opacity-100" style={{ color: 'var(--text-soft)' }}>
                      <IconPencil width={15} height={15} />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-sm" style={{ color: 'var(--text-soft)' }}>
                    <span>{frequencyLabel(habit)}</span>
                    {streak > 0 && <span className="font-semibold text-accent-600">racha {streak}</span>}
                    {week !== null && <span>{week}/{habit.frequency.timesPerWeek} esta semana</span>}
                  </div>
                </div>

                {habit.mode === 'binary' ? (
                  <button
                    onClick={() => setValue(habit, done ? 0 : 1)}
                    className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition', done ? 'text-white' : '')}
                    style={done ? { background: habit.color ?? '#21C2D9' } : { background: 'var(--surface-3)', color: 'var(--text-soft)' }}
                  >
                    <IconCheck width={24} height={24} />
                  </button>
                ) : (
                  <Stepper value={value} target={habit.target ?? 1} unit={habit.unit ?? ''} color={habit.color ?? '#21C2D9'} done={done} onChange={(v) => setValue(habit, v)} />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stepper({
  value, target, unit, color, done, onChange,
}: {
  value: number; target: number; unit: string; color: string; done: boolean; onChange: (v: number) => void;
}) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(0, value - 1))} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'var(--surface-3)', color: 'var(--text-soft)' }}>
          <IconMinus width={16} height={16} />
        </button>
        <div className="min-w-16 text-center">
          <span className="text-xl font-bold tabular-nums" style={{ color: done ? color : 'var(--text)' }}>{value}</span>
          <span className="text-sm" style={{ color: 'var(--text-soft)' }}>/{target}</span>
          <div className="text-[10px] uppercase" style={{ color: 'var(--text-soft)' }}>{unit}</div>
        </div>
        <button onClick={() => onChange(value + 1)} className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: color }}>
          <IconPlus width={16} height={16} />
        </button>
      </div>
      <div className="h-1.5 w-32 overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 rounded-3xl py-20 text-center" style={{ background: 'var(--surface-2)' }}>
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-500/10 text-accent-500">
        <IconHabits width={30} height={30} />
      </div>
      <p style={{ color: 'var(--text-soft)' }}>Aún no tienes hábitos. Crea el primero y empieza tu racha.</p>
      <button onClick={onCreate} className="rounded-full bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-600">
        Crear hábito
      </button>
    </div>
  );
}
