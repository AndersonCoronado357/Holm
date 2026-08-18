import { useEffect, useState } from 'react';
import type { CanvasView as CanvasViewKey, Page } from '../api/types';
import { api } from '../api/client';
import { Canvas } from '../canvas/Canvas';
import { PagesBubble } from '../canvas/PagesBubble';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useSettings } from '../state/settings';

const TITLES: Record<CanvasViewKey, string> = {
  tasks: 'Tareas',
  projects: 'Proyectos',
  notes: 'Notas',
  ideas: 'Ideas',
  models: 'Modelos de datos',
};

export function CanvasViewScreen({ view }: { view: CanvasViewKey }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // En qué pizarra estabas es una preferencia de la cuenta: la guarda el
  // servidor, así que abrir Holm en otro equipo te deja donde lo dejaste.
  const { cargado, paginaDe, recordarPagina } = useSettings();

  const setActiveId = (id: string | null) => {
    setActiveIdState(id);
    recordarPagina(view, id);
  };

  useEffect(() => {
    // Sin los ajustes cargados elegiríamos la primera pizarra y acto seguido
    // saltaríamos a la recordada: se vería el salto.
    if (!cargado) return;
    let alive = true;
    setReady(false);
    api.pages.list(view).then(async (list) => {
      if (!alive) return;
      if (list.length === 0) {
        const first = await api.pages.create(view, 'Página 1');
        if (!alive) return;
        setPages([first]);
        setActiveIdState(first.id);
        recordarPagina(view, first.id);
      } else {
        setPages(list);
        // La que estabas usando, si todavía existe; si no, la primera.
        const recordada = paginaDe(view);
        const elegida = list.find((p) => p.id === recordada)?.id ?? list[0].id;
        setActiveIdState(elegida);
        recordarPagina(view, elegida);
      }
      setReady(true);
    });
    return () => {
      alive = false;
    };
    // `paginaDe`/`recordarPagina` cambian en cada render del proveedor; sólo
    // hay que reelegir cuando cambias de módulo o llegan los ajustes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cargado]);

  const addPage = async () => {
    const p = await api.pages.create(view);
    setPages((prev) => [...prev, p]);
    setActiveId(p.id);
  };
  const renamePage = async (id: string, name: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    api.pages.rename(id, name).catch(() => {});
  };
  const deletePage = async (id: string) => {
    const remaining = pages.filter((p) => p.id !== id);
    setPages(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id ?? null);
    api.pages.remove(id).catch(() => {});
  };

  return (
    <div className="absolute inset-0">
      {ready && activeId && (
        <ErrorBoundary>
          <Canvas key={activeId} pageId={activeId} view={view} />
        </ErrorBoundary>
      )}
      {ready && (
        <PagesBubble
          pages={pages}
          activeId={activeId}
          onSelect={setActiveId}
          onAdd={addPage}
          onRename={renamePage}
          onDelete={deletePage}
        />
      )}
      <div
        className="pointer-events-none fixed bottom-5 left-1/2 z-20 -translate-x-1/2 text-xs font-semibold uppercase tracking-widest"
        style={{ color: 'var(--text-soft)', opacity: 0.4 }}
      >
        {TITLES[view]}
      </div>
    </div>
  );
}
