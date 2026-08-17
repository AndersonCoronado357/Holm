import { AnimatePresence, motion } from 'framer-motion';
import type { ViewKey } from '../api/types';
import { cx } from '../lib/util';
import { IslandMark } from './Logo';
import { IslaButton } from './IslaButton';
import { useIslaOpen } from './useIslaOpen';
import {
  IconHome,
  IconTasks,
  IconProjects,
  IconNotes,
  IconIdeas,
  IconHabits,
  IconDatabase,
  IconCalendar,
} from './icons';
import type { ComponentType, SVGProps } from 'react';

const ITEMS: { key: ViewKey; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { key: 'home', label: 'Inicio', Icon: IconHome },
  { key: 'tasks', label: 'Tareas', Icon: IconTasks },
  { key: 'projects', label: 'Proyectos', Icon: IconProjects },
  { key: 'notes', label: 'Notas', Icon: IconNotes },
  { key: 'ideas', label: 'Ideas', Icon: IconIdeas },
  { key: 'models', label: 'Modelos de datos', Icon: IconDatabase },
  { key: 'calendar', label: 'Calendario', Icon: IconCalendar },
  { key: 'habits', label: 'Hábitos', Icon: IconHabits },
];

// Resorte casi crítico: fluido y natural, sin rebote perceptible.
const spring = { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 } as const;

export function NavBubble({ active, onSelect }: { active: ViewKey; onSelect: (v: ViewKey) => void }) {
  const { open, setOpen, hoverProps } = useIslaOpen();

  return (
    // El contenedor ocupa el ancho para centrar, pero NO recibe el puntero: así
    // el hover no se activa sobre el pizarrón, solo sobre el nav en sí.
    <div className="isla-top pointer-events-none fixed inset-x-0 z-40 flex justify-center">
      <div {...hoverProps} className="pointer-events-auto select-none">
        {/* Una sola pieza que se ESTIRA: la bolita no desaparece para que
            aparezca otra cosa, es la misma isla que crece. Los iconos entran
            escalonados detrás. */}
        <motion.div
          layout
          transition={spring}
          onClick={() => !open && setOpen(true)}
          title={open ? undefined : 'Menú'}
          className={cx(
            'flex flex-row items-center rounded-full',
            // En un móvil los ocho accesos no caben de lado a lado: la isla se
            // queda dentro de la pantalla y se desliza con el dedo.
            open ? 'scroll-area max-w-[calc(100vw-1.5rem)] gap-0.5 p-1.5' : 'cursor-pointer p-0',
          )}
          style={{ background: 'var(--surface)', overflowY: 'hidden' }}
        >
          <motion.span
            layout
            className="flex shrink-0 items-center justify-center"
            style={{ width: open ? 36 : 56, height: open ? 36 : 56, marginRight: open ? 2 : 0 }}
          >
            <IslandMark size={open ? 24 : 30} />
          </motion.span>

          <AnimatePresence initial={false}>
            {open &&
              ITEMS.map(({ key, label, Icon }, i) => (
                <motion.div
                  key={key}
                  layout
                  initial={{ opacity: 0, scale: 0.5, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: 'auto', transition: { ...spring, delay: i * 0.022 } }}
                  exit={{ opacity: 0, scale: 0.5, width: 0, transition: { duration: 0.12 } }}
                  className="shrink-0 overflow-visible"
                >
                  <IslaButton
                    side="right"
                    Icon={Icon}
                    label={label}
                    active={active === key}
                    onClick={() => {
                      onSelect(key);
                      setOpen(false);
                    }}
                  />
                </motion.div>
              ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
