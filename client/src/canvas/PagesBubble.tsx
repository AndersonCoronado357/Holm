import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Page } from '../api/types';
import { cx } from '../lib/util';
import { useIslaOpen } from '../components/useIslaOpen';
import { IconPages, IconPlus, IconClose } from '../components/icons';

const ease = [0.22, 1, 0.36, 1] as const;
const spring = { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 } as const;

interface Props {
  pages: Page[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function PagesBubble({ pages, activeId, onSelect, onAdd, onRename, onDelete }: Props) {
  const { open, setOpen, hoverProps } = useIslaOpen();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const commit = () => {
    if (editing) onRename(editing, draft.trim() || 'Sin título');
    setEditing(null);
  };

  return (
    <div {...hoverProps} data-isla className="fixed left-5 top-1/2 z-30 -translate-y-1/2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, x: -4 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.98, x: -4 }}
            transition={spring}
            style={{ transformOrigin: 'left center', background: 'var(--surface)' }}
            className="absolute left-0 top-1/2 w-52 -translate-y-1/2 rounded-2xl p-2"
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-soft)' }}>
                Páginas
              </span>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--text-soft)' }}>
                <IconClose width={14} height={14} />
              </button>
            </div>
            <div className="max-h-[50vh] space-y-0.5 overflow-auto">
              {pages.map((p, i) => {
                const isActive = p.id === activeId;
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.02 + i * 0.015, duration: 0.14, ease }}
                    className={cx(
                      'group flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm transition-colors',
                      isActive ? 'bg-accent-500 text-white' : 'hover:bg-[var(--surface-3)]',
                    )}
                    style={isActive ? undefined : { color: 'var(--text-soft)' }}
                  >
                    {editing === p.id ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={commit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commit();
                          if (e.key === 'Escape') setEditing(null);
                        }}
                        className="w-full bg-transparent"
                        style={{ color: isActive ? '#fff' : 'var(--text)' }}
                      />
                    ) : (
                      <button
                        onClick={() => onSelect(p.id)}
                        onDoubleClick={() => {
                          setEditing(p.id);
                          setDraft(p.name);
                        }}
                        className="flex-1 truncate text-left font-medium"
                        title="Doble clic para renombrar"
                      >
                        {p.name}
                      </button>
                    )}
                    {pages.length > 1 && editing !== p.id && (
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar "${p.name}" y su contenido?`)) onDelete(p.id);
                        }}
                        className={cx('opacity-0 transition group-hover:opacity-100', isActive ? 'text-white/80' : 'hover:text-red-500')}
                      >
                        <IconClose width={13} height={13} />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onAdd}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-[var(--surface-3)]"
              style={{ color: 'var(--text-soft)' }}
            >
              <IconPlus width={16} height={16} /> Nueva página
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setOpen(true)}
          title="Páginas"
          className="relative flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'var(--surface)', color: 'var(--text-soft)' }}
        >
          <IconPages width={20} height={20} />
          {pages.length > 1 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">
              {pages.length}
            </span>
          )}
        </motion.button>
      )}
    </div>
  );
}
