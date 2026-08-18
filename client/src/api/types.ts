export interface Point {
  x: number;
  y: number;
}

export type CanvasView = 'tasks' | 'projects' | 'notes' | 'ideas' | 'models';
export type ViewKey = 'home' | CanvasView | 'habits' | 'calendar';

// Evento del calendario. `eventDate` es 'yyyy-MM-dd'; las horas son 'HH:MM' o
// null cuando el evento es de todo el día.
export interface CalendarEvent {
  id: string;
  title: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  color: string;
  createdAt?: string;
}

export type ElementType =
  | 'note'
  | 'card'
  | 'text'
  | 'list'
  | 'image'
  | 'shape'
  | 'frame'
  | 'model'
  | 'arrow';

export interface Page {
  id: string;
  view: CanvasView;
  name: string;
  order: number;
  createdAt?: string;
}

export interface ListItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ModelField {
  id: string;
  name: string;
  type: string;
  key?: boolean;
}

export interface ElementContent {
  text?: string;
  title?: string;
  items?: ListItem[];
  fields?: ModelField[];
  src?: string;
  alt?: string;
  shape?: 'rect' | 'ellipse' | 'triangle';
  // flecha (coordenadas de mundo)
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // conector anclado entre dos elementos
  fromId?: string;
  toId?: string;
  // puerto exacto del que sale/entra la línea (ej: 'n_0.000', 'e_0.500')
  fromPort?: string;
  toPort?: string;
  // enrutado de la línea y tipo de flecha
  routing?: 'straight' | 'ortho' | 'curved';
  arrowType?: 'none' | 'arrow' | 'both' | 'open' | 'circle' | 'diamond';
  // quiebres intermedios que el usuario arrastró (estilo draw.io)
  waypoints?: Point[];
  // compatibilidad con conectores viejos
  lineShape?: 'straight' | 'curved';
}

export interface CanvasElement {
  id: string;
  pageId: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string | null;
  zIndex: number;
  content: ElementContent;
  locked: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type HabitMode = 'binary' | 'quantity';
export type FrequencyType = 'daily' | 'weekdays' | 'timesPerWeek';

export interface Frequency {
  type: FrequencyType;
  weekdays?: number[];
  timesPerWeek?: number;
}

export interface Habit {
  id: string;
  name: string;
  mode: HabitMode;
  unit: string | null;
  target: number | null;
  frequency: Frequency;
  color: string | null;
  order: number;
  createdAt?: string;
}

export interface HabitWithValue extends Habit {
  value: number;
}

export interface HabitLog {
  habitId: string;
  date: string;
  value: number;
}

export type ThemeMode = 'system' | 'light' | 'dark';

/** Preferencias de la cuenta. Viven en el servidor, no en el navegador. */
export interface Settings {
  theme: ThemeMode;
  notifications: { enabled: boolean; leadMinutes: number };
  /** Última pizarra abierta en cada módulo, por clave de vista. */
  lastPage: Partial<Record<CanvasView, string>>;
}

/** Lo que se puede mandar en un guardado parcial (`null` olvida la pizarra). */
export interface SettingsPatch {
  theme?: ThemeMode;
  notifications?: Partial<Settings['notifications']>;
  lastPage?: Partial<Record<CanvasView, string | null>>;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  securityQuestion: string;
  createdAt?: string;
}

export interface RecentItem {
  id: string;
  type: ElementType;
  color: string | null;
  text: string;
  pageId: string;
}

export interface Summary {
  date: string;
  habitsToday: HabitWithValue[];
  recent: Record<CanvasView, RecentItem[]>;
  counts: Record<CanvasView, { pages: number; elements: number }>;
}
