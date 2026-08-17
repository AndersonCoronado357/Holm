import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { RecentItem, Summary } from '../api/types';
import { api } from '../api/client';
import { useAuth } from '../state/auth';
import { isoDate, WEEKDAY_NAMES } from '../lib/util';
import { isDone } from '../lib/streak';
import { phraseForDate } from '../lib/phrases';
import { IconTasks, IconProjects, IconNotes, IconHabits, IconCheck } from '../components/icons';
import type { ComponentType, SVGProps } from 'react';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const ease = [0.22, 1, 0.36, 1] as const;
const cardIn = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 + i * 0.06, duration: 0.4, ease },
});

export function HomeView() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const today = isoDate();

  useEffect(() => {
    api.summary.get(today).then(setSummary).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = new Date(today + 'T00:00:00');
  const dateLabel = `${WEEKDAY_NAMES[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  const firstName = (user?.name || '').split(' ')[0];

  const stats = [
    { label: 'Tareas', value: summary?.counts.tasks.elements ?? 0 },
    { label: 'Proyectos', value: summary?.counts.projects.elements ?? 0 },
    { label: 'Notas', value: summary?.counts.notes.elements ?? 0 },
    { label: 'Ideas', value: summary?.counts.ideas.elements ?? 0 },
  ];

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: 'var(--surface)' }}>
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="shrink-0 px-4 pb-4 pt-20 md:px-10 md:pb-5 md:pt-24"
      >
        <p className="text-sm capitalize" style={{ color: 'var(--text-soft)' }}>
          {dateLabel}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl" style={{ color: 'var(--text)' }}>
          {firstName ? `Hola, ${firstName}` : 'Tu día de un vistazo'}
        </h1>
        <p className="mt-2 max-w-2xl text-lg" style={{ color: 'var(--text-soft)' }}>
          {phraseForDate(today)}
        </p>
      </motion.header>

      <div className="scroll-area grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 md:grid-cols-2 md:grid-rows-2 md:gap-4 md:overflow-hidden md:px-10">
        <Card i={0} title="Hábitos de hoy" Icon={IconHabits} count={summary?.habitsToday.length}>
          {summary && summary.habitsToday.length === 0 && <Muted>Hoy no toca ningún hábito.</Muted>}
          <div className="space-y-2.5">
            {summary?.habitsToday.map((h) => {
              const done = isDone(h, h.value);
              return (
                <div key={h.id} className="flex items-center gap-3">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ background: done ? h.color ?? '#21C2D9' : 'var(--surface-3)', color: '#fff' }}
                  >
                    {done && <IconCheck width={13} height={13} />}
                  </span>
                  <span className="flex-1 truncate" style={{ color: 'var(--text)' }}>
                    {h.name}
                  </span>
                  {h.mode === 'quantity' && (
                    <span className="text-sm tabular-nums" style={{ color: 'var(--text-soft)' }}>
                      {h.value}/{h.target} {h.unit}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <RecentCard i={1} title="Tareas recientes" Icon={IconTasks} items={summary?.recent.tasks} empty="Sin tareas todavía." count={summary?.counts.tasks.elements} />
        <RecentCard i={2} title="Proyectos" Icon={IconProjects} items={summary?.recent.projects} empty="Sin proyectos todavía." count={summary?.counts.projects.elements} />
        <Card i={3} title="Notas e ideas" Icon={IconNotes} count={(summary?.counts.notes.elements ?? 0) + (summary?.counts.ideas.elements ?? 0)}>
          <Recents items={summary?.recent.notes} />
          <Recents items={summary?.recent.ideas} fallbackColor="#DDD6FE" />
          {summary && summary.recent.notes.length === 0 && summary.recent.ideas.length === 0 && (
            <Muted>Sin notas ni ideas todavía.</Muted>
          )}
        </Card>
      </div>

      {/* resumen numérico abajo */}
      <div className="safe-bottom grid shrink-0 grid-cols-2 gap-3 px-4 pt-3 md:grid-cols-4 md:gap-4 md:px-10 md:pt-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.05, duration: 0.35, ease }}
            className="rounded-2xl px-4 py-3 text-center"
            style={{ background: 'var(--surface-2)' }}
          >
            <div className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
              {s.value}
            </div>
            <div className="mt-0.5 text-xs uppercase tracking-wide" style={{ color: 'var(--text-soft)' }}>
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Card({
  i,
  title,
  Icon,
  count,
  children,
}: {
  i: number;
  title: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      {...cardIn(i)}
      className="flex min-h-[38vh] flex-col overflow-hidden rounded-3xl p-6 md:min-h-0"
      style={{ background: 'var(--surface-2)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-accent-500">
            <Icon width={19} height={19} />
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-soft)' }}>
            {title}
          </h2>
        </div>
        {count != null && count > 0 && (
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
            {count}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </motion.section>
  );
}

function RecentCard({
  i,
  title,
  Icon,
  items,
  empty,
  count,
}: {
  i: number;
  title: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  items?: RecentItem[];
  empty: string;
  count?: number;
}) {
  return (
    <Card i={i} title={title} Icon={Icon} count={count}>
      {items && items.length === 0 && <Muted>{empty}</Muted>}
      <Recents items={items} />
    </Card>
  );
}

function Recents({ items, fallbackColor }: { items?: RecentItem[]; fallbackColor?: string }) {
  if (!items) return null;
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.color ?? fallbackColor ?? 'var(--surface-3)' }} />
          <span className="truncate" style={{ color: 'var(--text)' }}>
            {it.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p style={{ color: 'var(--text-soft)' }}>{children}</p>;
}
