import type { Habit } from '../api/types';
import { addDays, weekdayOf } from './util';

type Getter = (date: string) => number;

export function isScheduled(habit: Habit, iso: string): boolean {
  const f = habit.frequency;
  if (f.type === 'weekdays') return (f.weekdays ?? []).includes(weekdayOf(iso));
  return true;
}

export function isDone(habit: Habit, value: number): boolean {
  if (habit.mode === 'quantity') return value >= (habit.target ?? 1);
  return value >= 1;
}

// Racha de días programados consecutivos cumplidos terminando en hoy (o ayer
// si hoy aún no se marca).
export function computeStreak(habit: Habit, get: Getter, today: string): number {
  let streak = 0;
  let cursor = today;
  if (isScheduled(habit, today) && !isDone(habit, get(today))) cursor = addDays(today, -1);
  for (let i = 0; i < 500; i++) {
    if (isScheduled(habit, cursor)) {
      if (isDone(habit, get(cursor))) streak++;
      else break;
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function startOfWeek(iso: string): string {
  const wd = weekdayOf(iso); // 0 = domingo
  const offset = (wd + 6) % 7; // lunes como inicio
  return addDays(iso, -offset);
}

// Cuantos días cumplidos van esta semana (para "X veces / semana").
export function weeklyCount(habit: Habit, get: Getter, today: string): number {
  let count = 0;
  let cursor = startOfWeek(today);
  for (let i = 0; i < 7; i++) {
    if (cursor > today) break;
    if (isDone(habit, get(cursor))) count++;
    cursor = addDays(cursor, 1);
  }
  return count;
}

export function frequencyLabel(habit: Habit): string {
  const f = habit.frequency;
  if (f.type === 'daily') return 'Todos los días';
  if (f.type === 'timesPerWeek') return `${f.timesPerWeek ?? 0} veces / semana`;
  const names = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order
    .filter((d) => (f.weekdays ?? []).includes(d))
    .map((d) => names[d])
    .join(' ');
}
