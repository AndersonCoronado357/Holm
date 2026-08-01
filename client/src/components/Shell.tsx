import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ViewKey } from '../api/types';
import { NavBubble } from './NavBubble';
import { SettingsButton } from './SettingsButton';
import { HomeView } from '../views/HomeView';
import { CanvasViewScreen } from '../views/CanvasView';
import { HabitsView } from '../views/HabitsView';
import { CalendarView } from '../views/CalendarView';

const ease = [0.22, 1, 0.36, 1] as const;

// Cada vista tiene su URL, para que recargar mantenga la vista.
const VIEW_TO_PATH: Record<ViewKey, string> = {
  home: '/',
  tasks: '/tareas',
  projects: '/proyectos',
  notes: '/notas',
  ideas: '/ideas',
  models: '/modelos',
  calendar: '/calendario',
  habits: '/habitos',
};

function pathToView(path: string): ViewKey {
  const found = (Object.keys(VIEW_TO_PATH) as ViewKey[]).find((k) => VIEW_TO_PATH[k] === path);
  return found ?? 'home';
}

export function Shell() {
  const [view, setViewState] = useState<ViewKey>(() => pathToView(window.location.pathname));

  useEffect(() => {
    const onPop = () => setViewState(pathToView(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setView = (v: ViewKey) => {
    if (window.location.pathname !== VIEW_TO_PATH[v]) {
      window.history.pushState(null, '', VIEW_TO_PATH[v]);
    }
    setViewState(v);
  };

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: 'var(--surface)' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.22, ease }}
          className="absolute inset-0"
        >
          {view === 'home' ? (
            <HomeView />
          ) : view === 'habits' ? (
            <HabitsView />
          ) : view === 'calendar' ? (
            <CalendarView />
          ) : (
            <CanvasViewScreen view={view} />
          )}
        </motion.div>
      </AnimatePresence>

      <NavBubble active={view} onSelect={setView} />
      <SettingsButton />
    </div>
  );
}
