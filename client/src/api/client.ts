import type {
  AuthUser,
  CalendarEvent,
  CanvasElement,
  CanvasView,
  Habit,
  HabitLog,
  Page,
  Settings,
  SettingsPatch,
  Summary,
} from './types';

const BASE = '/api';

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include', // envia/recibe la cookie de sesion
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error('Sesión no válida');
  }
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* sin cuerpo */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  auth: {
    signup: (data: {
      email: string;
      password: string;
      name?: string;
      securityQuestion: string;
      securityAnswer: string;
    }) => req<{ user: AuthUser }>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
    login: (email: string, password: string) =>
      req<{ user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    recoverQuestion: (email: string) =>
      req<{ question: string }>('/auth/recover/question', { method: 'POST', body: JSON.stringify({ email }) }),
    recoverReset: (email: string, securityAnswer: string, newPassword: string) =>
      req<{ user: AuthUser }>('/auth/recover/reset', {
        method: 'POST',
        body: JSON.stringify({ email, securityAnswer, newPassword }),
      }),
    me: () => req<{ user: AuthUser }>('/auth/me'),
    logout: () => req<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  },
  pages: {
    list: (view: CanvasView) => req<Page[]>(`/pages?view=${view}`),
    create: (view: CanvasView, name?: string) =>
      req<Page>('/pages', { method: 'POST', body: JSON.stringify({ view, name }) }),
    rename: (id: string, name: string) =>
      req<Page>(`/pages/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    remove: (id: string) => req<void>(`/pages/${id}`, { method: 'DELETE' }),
  },
  elements: {
    list: (pageId: string) => req<CanvasElement[]>(`/elements?pageId=${pageId}`),
    create: (el: Partial<CanvasElement> & { pageId: string; type: string }) =>
      req<CanvasElement>('/elements', { method: 'POST', body: JSON.stringify(el) }),
    update: (id: string, patch: Partial<CanvasElement>) =>
      req<CanvasElement>(`/elements/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id: string) => req<void>(`/elements/${id}`, { method: 'DELETE' }),
  },
  habits: {
    list: () => req<Habit[]>('/habits'),
    create: (h: Partial<Habit>) => req<Habit>('/habits', { method: 'POST', body: JSON.stringify(h) }),
    update: (id: string, patch: Partial<Habit>) =>
      req<Habit>(`/habits/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id: string) => req<void>(`/habits/${id}`, { method: 'DELETE' }),
  },
  logs: {
    range: (from: string, to: string) => req<HabitLog[]>(`/habit-logs?from=${from}&to=${to}`),
    set: (habitId: string, date: string, value: number | boolean) =>
      req<HabitLog>('/habit-logs', { method: 'PUT', body: JSON.stringify({ habitId, date, value }) }),
  },
  events: {
    list: () => req<CalendarEvent[]>('/events'),
    create: (e: Partial<CalendarEvent>) =>
      req<CalendarEvent>('/events', { method: 'POST', body: JSON.stringify(e) }),
    update: (id: string, patch: Partial<CalendarEvent>) =>
      req<CalendarEvent>(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id: string) => req<void>(`/events/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => req<Settings>('/settings'),
    set: (patch: SettingsPatch) =>
      req<Settings>('/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
    /** Reclama el aviso de un evento: sólo el primero en pedirlo lo muestra. */
    claimNotified: (id: string, day: string) =>
      req<{ first: boolean }>('/settings/notified', {
        method: 'POST',
        body: JSON.stringify({ id, day }),
      }),
  },
  push: {
    vapidKey: () => req<{ publicKey: string; enabled: boolean }>('/push/vapid-key'),
    subscribe: (endpoint: string, keys: { p256dh: string; auth: string }) =>
      req<{ ok: boolean }>('/push/subscribe', { method: 'POST', body: JSON.stringify({ endpoint, keys }) }),
    unsubscribe: (endpoint: string) =>
      req<{ ok: boolean }>('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }),
    /** Push de prueba real: sale del servidor, no de esta pestaña. */
    test: () => req<{ sent: number; failed: number }>('/push/test', { method: 'POST' }),
  },
  summary: {
    get: (date: string) => req<Summary>(`/summary?date=${date}`),
  },
};
