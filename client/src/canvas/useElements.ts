import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { CanvasElement } from '../api/types';

export function useElements(pageId: string | null) {
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [loading, setLoading] = useState(false);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!pageId) {
      setElements([]);
      return;
    }
    let alive = true;
    setLoading(true);
    api.elements
      .list(pageId)
      .then((els) => alive && setElements(els))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [pageId]);

  // Cambio local inmediato (sin red), para arrastre/edicion fluida.
  const patchLocal = useCallback((id: string, patch: Partial<CanvasElement>) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  // Persiste (con debounce opcional para texto).
  const persist = useCallback((id: string, patch: Partial<CanvasElement>, debounceMs = 0) => {
    const timers = saveTimers.current;
    const run = () => {
      api.elements.update(id, patch).catch(() => {});
      timers.delete(id);
    };
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    if (debounceMs > 0) timers.set(id, setTimeout(run, debounceMs));
    else run();
  }, []);

  // Local + persistir.
  const update = useCallback(
    (id: string, patch: Partial<CanvasElement>, debounceMs = 0) => {
      patchLocal(id, patch);
      persist(id, patch, debounceMs);
    },
    [patchLocal, persist],
  );

  const add = useCallback(
    async (data: Omit<CanvasElement, 'id' | 'pageId'>) => {
      if (!pageId) return null;
      const created = await api.elements.create({ ...data, pageId });
      setElements((prev) => [...prev, created]);
      return created;
    },
    [pageId],
  );

  const remove = useCallback((id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id));
    api.elements.remove(id).catch(() => {});
  }, []);

  return { elements, loading, patchLocal, update, persist, add, remove };
}
