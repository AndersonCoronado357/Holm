import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CalendarEvent } from '../api/types';
import { api } from '../api/client';
import { cx } from '../lib/util';
import {
  DAY_SHORT,
  MONTHS_SHORT,
  WEEK_LABELS,
  addDays,
  addMonths,
  dayLabel,
  isToday,
  key,
  monthGrid,
  monthYearLabel,
  parseHm,
  sameDay,
  sameMonth,
  weekDays,
  weekRangeLabel,
} from '../lib/calendar';
import { clearTimers, scheduleToday } from '../lib/notifications';
import { EventForm } from './EventForm';
import {
  IconCalendar,
  IconCalendarDays,
  IconCalendarRange,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconList,
  IconPlus,
} from '../components/icons';

const ease = [0.22, 1, 0.36, 1] as const;
type View = 'day' | 'week' | 'month' | 'agenda';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_H = 48; // alto de una hora en la timeline

const VIEWS: { value: View; label: string; Icon: typeof IconClock }[] = [
  { value: 'day', label: 'Día', Icon: IconClock },
  { value: 'week', label: 'Semana', Icon: IconCalendarRange },
  { value: 'month', label: 'Mes', Icon: IconCalendarDays },
  { value: 'agenda', label: 'Agenda', Icon: IconList },
];

export function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [view, setView] = useState<View>('month');
  const [editing, setEditing] = useState<{ event: CalendarEvent | null; date: Date } | null>(null);

  useEffect(() => {
    api.events
      .list()
      .then(setEvents)
      .catch(() => {});
  }, []);

  // Reprograma los avisos del navegador cada vez que cambian los eventos.
  useEffect(() => {
    scheduleToday(events);
    return clearTimers;
  }, [events]);

  // Índice por día para no filtrar la lista completa en cada celda.
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = m.get(e.eventDate) ?? [];
      list.push(e);
      m.set(e.eventDate, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => (parseHm(a.startTime) ?? -1) - (parseHm(b.startTime) ?? -1));
    }
    return m;
  }, [events]);

  const eventsOn = (d: Date) => byDay.get(key(d)) ?? [];
  const timedOn = (d: Date) => eventsOn(d).filter((e) => e.startTime);
  const allDayOn = (d: Date) => eventsOn(d).filter((e) => !e.startTime);

  const prev = () => setCursor((c) => (view === 'day' ? addDays(c, -1) : view === 'week' ? addDays(c, -7) : addMonths(c, -1)));
  const next = () => setCursor((c) => (view === 'day' ? addDays(c, 1) : view === 'week' ? addDays(c, 7) : addMonths(c, 1)));

  const headerLabel =
    view === 'day' ? dayLabel(cursor) : view === 'week' ? weekRangeLabel(cursor) : monthYearLabel(cursor);

  const save = async (data: Partial<CalendarEvent>) => {
    if (editing?.event) {
      const updated = await api.events.update(editing.event.id, data);
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } else {
      const created = await api.events.create(data);
      setEvents((prev) => [...prev, created]);
    }
    setEditing(null);
  };

  const del = async () => {
    if (!editing?.event) return;
    const id = editing.event.id;
    await api.events.remove(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setEditing(null);
  };

  if (editing) {
    return (
      <EventForm
        initial={editing.event}
        date={editing.date}
        onCancel={() => setEditing(null)}
        onSave={save}
        onDelete={editing.event ? del : undefined}
      />
    );
  }

  // Agenda: próximos eventos agrupados por día.
  const agenda = (() => {
    const from = key(new Date());
    const fut = events.filter((e) => e.eventDate >= from).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    const out: { date: Date; items: CalendarEvent[] }[] = [];
    for (const e of fut) {
      const last = out[out.length - 1];
      if (last && key(last.date) === e.eventDate) last.items.push(e);
      else out.push({ date: new Date(e.eventDate + 'T00:00:00'), items: [e] });
    }
    return out;
  })();

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: 'var(--surface)' }}>
      <header className="cab-corta flex shrink-0 flex-wrap items-end justify-between gap-3 px-4 pb-4 pt-20 md:gap-4 md:px-10 md:pb-5 md:pt-24">
        <div className="min-w-0">
          <p className="text-[13px] md:text-sm" style={{ color: 'var(--text-soft)' }}>
            {events.length === 0 ? 'Sin eventos todavía' : `${events.length} evento${events.length === 1 ? '' : 's'}`}
          </p>
          <h1
            className="mt-0.5 truncate text-2xl font-bold tracking-tight md:mt-1 md:text-4xl"
            style={{ color: 'var(--text)' }}
          >
            {headerLabel}
          </h1>
        </div>

        {/* Escritorio: barra completa con «Hoy» aparte */}
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <div className="flex items-center gap-1">
            <IconBtn onClick={prev} title="Anterior">
              <IconChevronLeft width={17} height={17} />
            </IconBtn>
            <button
              onClick={() => {
                const now = new Date();
                setCursor(now);
                setSelected(now);
              }}
              className="h-10 rounded-xl px-3.5 text-sm font-semibold"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              Hoy
            </button>
            <IconBtn onClick={next} title="Siguiente">
              <IconChevronRight width={17} height={17} />
            </IconBtn>
          </div>

          <div className="flex items-center gap-0.5 rounded-xl p-1" style={{ background: 'var(--surface-2)' }}>
            {VIEWS.map((v) => (
              <button
                key={v.value}
                onClick={() => setView(v.value)}
                title={v.label}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors"
                style={
                  view === v.value
                    ? { background: 'var(--color-accent-500)', color: '#fff' }
                    : { color: 'var(--text-soft)' }
                }
              >
                <v.Icon width={15} height={15} />
                <span>{v.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setEditing({ event: null, date: selected })}
            className="flex h-10 items-center gap-2 rounded-full bg-accent-500 px-4 text-sm font-semibold text-white hover:bg-accent-600"
          >
            <IconPlus width={17} height={17} /> Evento
          </button>
        </div>

        {/* Móvil: una sola fila que cabe en 375 px, con todo del tamaño del dedo.
            El nombre del periodo hace de botón «hoy» para no gastar un hueco. */}
        <div className="flex w-full items-center gap-1.5 md:hidden">
          <IconBtn onClick={prev} title="Anterior">
            <IconChevronLeft width={18} height={18} />
          </IconBtn>
          <button
            onClick={() => {
              const now = new Date();
              setCursor(now);
              setSelected(now);
            }}
            className="h-11 min-w-0 flex-1 truncate rounded-xl px-2 text-[13px] font-bold capitalize"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            Hoy
          </button>
          <IconBtn onClick={next} title="Siguiente">
            <IconChevronRight width={18} height={18} />
          </IconBtn>
          <button
            onClick={() => setEditing({ event: null, date: selected })}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white"
            aria-label="Nuevo evento"
          >
            <IconPlus width={19} height={19} />
          </button>
        </div>

        {/* Móvil: las cuatro vistas, en iconos grandes y en su propia fila */}
        <div className="flex w-full items-center gap-1 rounded-2xl p-1 md:hidden" style={{ background: 'var(--surface-2)' }}>
          {VIEWS.map((v) => (
            <button
              key={v.value}
              onClick={() => setView(v.value)}
              aria-label={v.label}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition-colors"
              style={
                view === v.value ? { background: 'var(--color-accent-500)', color: '#fff' } : { color: 'var(--text-soft)' }
              }
            >
              <v.Icon width={16} height={16} />
              {v.label}
            </button>
          ))}
        </div>
      </header>

      {/* En móvil se apila: la rejilla arriba y los eventos del día debajo. */}
      <div className="safe-bottom flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 md:flex-row md:px-10 md:pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={view + key(cursor)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease }}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl"
            style={{ background: 'var(--surface-2)' }}
          >
            {view === 'month' && (
              <MonthGrid
                cursor={cursor}
                selected={selected}
                eventsOn={eventsOn}
                onPick={setSelected}
                onOpen={(e) => setEditing({ event: e, date: new Date(e.eventDate + 'T00:00:00') })}
              />
            )}
            {view === 'week' && (
              <WeekTimeline
                cursor={cursor}
                timedOn={timedOn}
                allDayOn={allDayOn}
                onOpen={(e) => setEditing({ event: e, date: new Date(e.eventDate + 'T00:00:00') })}
              />
            )}
            {view === 'day' && (
              <DayTimeline
                cursor={cursor}
                timedOn={timedOn}
                allDayOn={allDayOn}
                onOpen={(e) => setEditing({ event: e, date: new Date(e.eventDate + 'T00:00:00') })}
              />
            )}
            {view === 'agenda' && (
              <Agenda
                groups={agenda}
                onOpen={(e) => setEditing({ event: e, date: new Date(e.eventDate + 'T00:00:00') })}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Los eventos del día: columna a la derecha en pantalla ancha, y en
            móvil una sección debajo de la rejilla, que si no tocar un día no
            enseña nada. */}
        {view === 'month' && (
          <div
            className="flex max-h-[38vh] shrink-0 flex-col overflow-hidden rounded-2xl md:max-h-none md:w-[300px]"
            style={{ background: 'var(--surface-2)' }}
          >
            <header className="flex shrink-0 items-baseline gap-2 px-4 pb-2 pt-3 md:block md:px-5 md:pb-3 md:pt-5">
              <p className="text-sm capitalize" style={{ color: 'var(--text-soft)' }}>
                {DAY_SHORT[selected.getDay()]}
              </p>
              <h3 className="text-xl font-bold md:mt-0.5 md:text-2xl" style={{ color: 'var(--text)' }}>
                {selected.getDate()}{' '}
                <span className="text-base font-semibold" style={{ color: 'var(--text-soft)' }}>
                  {MONTHS_SHORT[selected.getMonth()]}
                </span>
              </h3>
            </header>
            <div className="scroll-area min-h-0 flex-1 px-4 pb-4 md:px-5 md:pb-5">
              {eventsOn(selected).length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: 'var(--text-soft)' }}>
                  Nada para este día.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {eventsOn(selected).map((e) => (
                    <li key={e.id}>
                      <button
                        onClick={() => setEditing({ event: e, date: selected })}
                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left"
                        style={{ background: 'var(--surface-3)' }}
                      >
                        <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          {e.title}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--text-soft)' }}>
                          {e.startTime ?? 'Todo el día'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-10 w-10 items-center justify-center rounded-xl"
      style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
    >
      {children}
    </button>
  );
}

/* ---------- Mes ---------- */

function MonthGrid({
  cursor,
  selected,
  eventsOn,
  onPick,
  onOpen,
}: {
  cursor: Date;
  selected: Date;
  eventsOn: (d: Date) => CalendarEvent[];
  onPick: (d: Date) => void;
  onOpen: (e: CalendarEvent) => void;
}) {
  const days = monthGrid(cursor);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-7 gap-1 px-3 pt-3">
        {WEEK_LABELS.map((d, i) => (
          <div key={i} className="py-1.5 text-center text-xs font-bold uppercase" style={{ color: 'var(--text-soft)' }}>
            {d}
          </div>
        ))}
      </div>
      {/* `auto-rows-fr` reparte el alto disponible, pero en una pantalla baja
          las seis semanas se aplastaban hasta 12 px. Con un mínimo por fila la
          rejilla se desborda y se desliza, en vez de volverse ilegible. */}
      <div className="scroll-area grid min-h-0 flex-1 grid-cols-7 gap-1 p-3" style={{ gridAutoRows: 'minmax(2.75rem, 1fr)' }}>
        {days.map((d) => {
          const items = eventsOn(d);
          const inMonth = sameMonth(d, cursor);
          const isSel = sameDay(d, selected);
          return (
            <button
              key={key(d)}
              onClick={() => onPick(d)}
              className={cx('flex flex-col gap-1 overflow-hidden rounded-xl p-1.5 text-left transition-colors')}
              style={{
                background: inMonth ? 'var(--surface-3)' : 'transparent',
                outline: isSel ? '2px solid var(--color-accent-500)' : 'none',
                opacity: inMonth ? 1 : 0.45,
              }}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={
                  isToday(d)
                    ? { background: 'var(--color-accent-500)', color: '#fff' }
                    : { color: 'var(--text)' }
                }
              >
                {d.getDate()}
              </span>
              {/* Móvil: sólo puntos de color. Una píldora con texto en una celda
                  de 39 px no se lee; el detalle se ve al tocar el día. */}
              <div className="flex flex-wrap items-center justify-center gap-1 md:hidden">
                {items.slice(0, 4).map((e) => (
                  <span key={e.id} className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
                ))}
              </div>

              {/* Escritorio: píldoras con título y hora */}
              <div className="hidden min-h-0 flex-col gap-1 overflow-hidden md:flex">
                {items.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpen(e);
                    }}
                    className="flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
                    style={{ background: e.color + '2e', color: e.color }}
                  >
                    <span className="min-w-0 flex-1 truncate">{e.title}</span>
                    {e.startTime && <span className="shrink-0 tabular-nums opacity-80">{e.startTime}</span>}
                  </span>
                ))}
                {items.length > 2 && (
                  <span className="pl-1 text-[10px] font-semibold" style={{ color: 'var(--text-soft)' }}>
                    +{items.length - 2} más
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Timeline (día y semana) ---------- */

function eventTop(e: CalendarEvent): number {
  const s = parseHm(e.startTime);
  return s === null ? 2 : s * (HOUR_H / 60) + 2;
}
function eventHeight(e: CalendarEvent): number {
  const s = parseHm(e.startTime);
  const en = parseHm(e.endTime);
  if (s === null || en === null || en <= s) return 40;
  return Math.max(40, (en - s) * (HOUR_H / 60) - 4);
}

function AllDayStrip({ items, onOpen }: { items: CalendarEvent[]; onOpen: (e: CalendarEvent) => void }) {
  if (!items.length) return null;
  return (
    <div className="flex shrink-0 flex-col gap-1.5 px-4 py-2" style={{ borderBottom: '1px solid var(--surface-3)' }}>
      {items.map((e) => (
        <button
          key={e.id}
          onClick={() => onOpen(e)}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left"
          style={{ background: e.color + '2e', color: e.color }}
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{e.title}</span>
          <span className="shrink-0 text-[11.5px] font-semibold opacity-80">Todo el día</span>
        </button>
      ))}
    </div>
  );
}

function DayTimeline({
  cursor,
  timedOn,
  allDayOn,
  onOpen,
}: {
  cursor: Date;
  timedOn: (d: Date) => CalendarEvent[];
  allDayOn: (d: Date) => CalendarEvent[];
  onOpen: (e: CalendarEvent) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AllDayStrip items={allDayOn(cursor)} onOpen={onOpen} />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ height: HOURS.length * HOUR_H }}>
          {HOURS.map((h) => (
            <div key={h} className="absolute inset-x-0 flex" style={{ top: h * HOUR_H, height: HOUR_H }}>
              <span
                className="w-14 shrink-0 pr-3 pt-0.5 text-right text-[11px] font-semibold tabular-nums"
                style={{ color: 'var(--text-soft)' }}
              >
                {String(h).padStart(2, '0')}:00
              </span>
              <span className="flex-1" style={{ borderTop: '1px solid var(--surface-3)' }} />
            </div>
          ))}
          <div className="absolute bottom-0 left-14 right-4 top-0">
            {timedOn(cursor).map((e) => (
              <button
                key={e.id}
                onClick={() => onOpen(e)}
                className="absolute inset-x-0 flex items-start gap-2 overflow-hidden rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold"
                style={{ background: e.color + '2e', color: e.color, top: eventTop(e), height: eventHeight(e) }}
              >
                <span className="min-w-0 flex-1 truncate font-bold">{e.title}</span>
                <span className="shrink-0 text-[11px] tabular-nums opacity-80">
                  {e.startTime}
                  {e.endTime ? ` – ${e.endTime}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekTimeline({
  cursor,
  timedOn,
  allDayOn,
  onOpen,
}: {
  cursor: Date;
  timedOn: (d: Date) => CalendarEvent[];
  allDayOn: (d: Date) => CalendarEvent[];
  onOpen: (e: CalendarEvent) => void;
}) {
  const days = weekDays(cursor);
  const allDayCount = days.reduce((n, d) => n + allDayOn(d).length, 0);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="grid shrink-0 grid-cols-[56px_repeat(7,1fr)]"
        style={{ borderBottom: '1px solid var(--surface-3)' }}
      >
        <div />
        {days.map((d, i) => (
          <div key={i} className="py-2 text-center">
            <p className="text-[10.5px] font-bold uppercase" style={{ color: 'var(--text-soft)' }}>
              {WEEK_LABELS[i]}
            </p>
            <p
              className="mt-0.5 text-[15px] font-bold"
              style={{ color: isToday(d) ? 'var(--color-accent-500)' : 'var(--text)' }}
            >
              {d.getDate()}
            </p>
          </div>
        ))}
      </div>

      {allDayCount > 0 && (
        <div
          className="grid shrink-0 grid-cols-[56px_repeat(7,1fr)]"
          style={{ borderBottom: '1px solid var(--surface-3)' }}
        >
          <div className="flex items-center justify-end pr-2 text-[9.5px] font-bold uppercase" style={{ color: 'var(--text-soft)' }}>
            Todo el día
          </div>
          {days.map((d, i) => (
            <div key={i} className="flex min-w-0 flex-col gap-1 px-1 py-1.5">
              {allDayOn(d).map((e) => (
                <button
                  key={e.id}
                  onClick={() => onOpen(e)}
                  className="truncate rounded px-1.5 py-0.5 text-left text-[10px] font-bold"
                  style={{ background: e.color + '2e', color: e.color }}
                >
                  {e.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="relative grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: HOURS.length * HOUR_H }}>
          <div className="relative">
            {HOURS.map((h) => (
              <span
                key={h}
                className="absolute right-2 text-[10.5px] font-semibold tabular-nums"
                style={{ top: h * HOUR_H - 6, color: 'var(--text-soft)' }}
              >
                {String(h).padStart(2, '0')}
              </span>
            ))}
          </div>
          {days.map((d, i) => (
            <div key={i} className="relative" style={{ borderLeft: '1px solid var(--surface-3)' }}>
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0"
                  style={{ top: h * HOUR_H, height: HOUR_H, borderTop: '1px solid var(--surface-3)' }}
                />
              ))}
              {timedOn(d).map((e) => (
                <button
                  key={e.id}
                  onClick={() => onOpen(e)}
                  className="absolute inset-x-1 flex items-start gap-1.5 overflow-hidden rounded-lg px-2 py-1 text-left text-[11px] font-bold"
                  style={{ background: e.color + '2e', color: e.color, top: eventTop(e), height: eventHeight(e) }}
                >
                  <span className="min-w-0 flex-1 truncate">{e.title}</span>
                  <span className="shrink-0 text-[10px] tabular-nums opacity-80">{e.startTime}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Agenda ---------- */

function Agenda({
  groups,
  onOpen,
}: {
  groups: { date: Date; items: CalendarEvent[] }[];
  onOpen: (e: CalendarEvent) => void;
}) {
  if (!groups.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3" style={{ color: 'var(--text-soft)' }}>
        <IconCalendar width={34} height={34} />
        <p className="text-sm">No hay eventos próximos.</p>
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto px-5 py-5 md:px-7">
      <ul className="flex flex-col gap-5">
        {groups.map((g) => (
          <li key={key(g.date)}>
            <div className="grid grid-cols-[76px_1fr] items-center gap-4">
              <div
                className="rounded-2xl px-2 py-3 text-center"
                style={{ background: isToday(g.date) ? 'var(--color-accent-500)' : 'var(--surface-3)' }}
              >
                <p
                  className="text-[11px] font-bold uppercase"
                  style={{ color: isToday(g.date) ? '#fff' : 'var(--text-soft)' }}
                >
                  {DAY_SHORT[g.date.getDay()]}
                </p>
                <p
                  className="mt-1 text-[26px] font-extrabold leading-none tabular-nums"
                  style={{ color: isToday(g.date) ? '#fff' : 'var(--text)' }}
                >
                  {g.date.getDate()}
                </p>
                <p
                  className="mt-1 text-[11px] font-bold"
                  style={{ color: isToday(g.date) ? '#fff' : 'var(--text-soft)' }}
                >
                  {MONTHS_SHORT[g.date.getMonth()]}
                </p>
              </div>
              <ul className="flex min-w-0 flex-col gap-2">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <button
                      onClick={() => onOpen(e)}
                      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
                      style={{ background: e.color + '2e', color: e.color }}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: e.color }} />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{e.title}</span>
                      <span className="shrink-0 text-[12.5px] font-semibold tabular-nums opacity-80">
                        {e.startTime ?? 'Todo el día'}
                        {e.endTime ? ` – ${e.endTime}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
