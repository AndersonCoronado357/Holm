import type { CanvasElement, ElementType, Point } from '../api/types';
import { uid } from '../lib/util';

export type { Point };

export interface Viewport {
  x: number; // translate X (px de pantalla)
  y: number; // translate Y
  scale: number;
}

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 3;

// Pantalla (relativa al canvas) -> mundo
export function screenToWorld(sx: number, sy: number, vp: Viewport): Point {
  return { x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale };
}

// Zoom manteniendo fijo el punto de mundo bajo el cursor.
export function zoomAt(vp: Viewport, cx: number, cy: number, nextScale: number): Viewport {
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
  const wx = (cx - vp.x) / vp.scale;
  const wy = (cy - vp.y) / vp.scale;
  return { scale, x: cx - wx * scale, y: cy - wy * scale };
}

// Tamaño con el que nace cada tipo. Se usa también para la vista previa que
// sigue al cursor al arrastrarlo desde la paleta.
export const TAMANO: Record<ElementType, { w: number; h: number }> = {
  note: { w: 200, h: 168 },
  card: { w: 248, h: 150 },
  text: { w: 220, h: 48 },
  list: { w: 248, h: 210 },
  image: { w: 248, h: 184 },
  shape: { w: 168, h: 168 },
  frame: { w: 440, h: 320 },
  model: { w: 240, h: 168 },
  arrow: { w: 160, h: 2 },
};

// Color con el que nace cada tipo, cuando no lleva uno propio.
export const COLOR_BASE: Partial<Record<ElementType, string>> = {
  note: '#FDE68A',
  shape: '#99E4F0',
};

// Plantilla de elemento nuevo, centrado en un punto de mundo.
export function newElement(
  type: ElementType,
  world: Point,
  zIndex: number,
): Omit<CanvasElement, 'id' | 'pageId'> {
  const base = { color: null as string | null, zIndex, locked: false };
  switch (type) {
    case 'note':
      return { ...base, type, ...centered(world, 200, 168), color: '#FDE68A', content: { text: '' } };
    case 'card':
      return { ...base, type, ...centered(world, 248, 150), content: { text: '' } };
    case 'text':
      return { ...base, type, ...centered(world, 220, 48), content: { text: 'Texto' } };
    case 'list':
      return {
        ...base,
        type,
        ...centered(world, 248, 210),
        content: { title: 'Lista', items: [{ id: uid(), text: '', done: false }] },
      };
    case 'image':
      return { ...base, type, ...centered(world, 248, 184), content: { src: '', alt: '' } };
    case 'shape':
      return { ...base, type, ...centered(world, 168, 168), color: '#99E4F0', content: { shape: 'rect', text: '' } };
    case 'frame':
      return { ...base, type, ...centered(world, 440, 320), content: { title: 'Marco' } };
    case 'model':
      return {
        ...base,
        type,
        ...centered(world, 240, 168),
        content: {
          title: 'Tabla',
          fields: [
            { id: uid(), name: 'id', type: 'int', key: true },
            { id: uid(), name: 'nombre', type: 'text' },
          ],
        },
      };
    case 'arrow':
      return {
        ...base,
        type,
        x: world.x,
        y: world.y,
        w: 0,
        h: 0,
        color: '#5c656e',
        content: { x1: world.x - 80, y1: world.y, x2: world.x + 80, y2: world.y },
      };
  }
}

function centered(world: Point, w: number, h: number) {
  return { x: Math.round(world.x - w / 2), y: Math.round(world.y - h / 2), w, h };
}
