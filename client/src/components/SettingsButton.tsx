import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettings } from '../state/settings';
import { useAuth } from '../state/auth';
import { IslaButton } from './IslaButton';
import { useIslaOpen } from './useIslaOpen';
import { isEnabled, notifyNow, requestPermission, setEnabled, supported } from '../lib/notifications';
import { IconSettings, IconSun, IconMoon, IconMonitor, IconUser, IconLogout, IconBell, IconBellOff } from './icons';

const ease = [0.22, 1, 0.36, 1] as const;
const spring = { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 } as const;

export function SettingsButton() {
  const { theme, setTheme } = useSettings();
  const { user, logout } = useAuth();
  const { open, setOpen, hoverProps } = useIslaOpen();
  const [notif, setNotif] = useState(() => supported() && isEnabled());

  // Al encender pide permiso al navegador; si lo concede, avisa que quedó listo.
  const toggleNotif = async () => {
    if (notif) {
      setEnabled(false);
      setNotif(false);
      return;
    }
    const perm = Notification.permission === 'granted' ? 'granted' : await requestPermission();
    if (perm !== 'granted') return;
    setEnabled(true);
    setNotif(true);
    notifyNow('Holm', 'Te avisaré de tus eventos del calendario.');
  };

  return (
    <div {...hoverProps} className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={spring}
            style={{ transformOrigin: 'bottom right', background: 'var(--surface)' }}
            className="flex select-none flex-col items-end gap-0.5 rounded-3xl p-1.5"
          >
            <IslaButton side="left" Icon={IconUser} label={user?.name || user?.email || 'Tu cuenta'} onClick={() => {}} />
            <div className="my-0.5 h-px w-8 self-center" style={{ background: 'var(--surface-3)' }} />
            <IslaButton side="left" Icon={IconMonitor} label="Sistema" active={theme === 'system'} onClick={() => setTheme('system')} />
            <IslaButton side="left" Icon={IconSun} label="Claro" active={theme === 'light'} onClick={() => setTheme('light')} />
            <IslaButton side="left" Icon={IconMoon} label="Oscuro" active={theme === 'dark'} onClick={() => setTheme('dark')} />
            {supported() && (
              <>
                <div className="my-0.5 h-px w-8 self-center" style={{ background: 'var(--surface-3)' }} />
                <IslaButton
                  side="left"
                  Icon={notif ? IconBell : IconBellOff}
                  label={notif ? 'Avisos activados' : 'Activar avisos'}
                  active={notif}
                  onClick={toggleNotif}
                />
              </>
            )}
            <div className="my-0.5 h-px w-8 self-center" style={{ background: 'var(--surface-3)' }} />
            <IslaButton side="left" Icon={IconLogout} label="Cerrar sesión" danger onClick={logout} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: 1.03 }}
        animate={{ rotate: open ? 90 : 0 }}
        transition={{ duration: 0.25, ease }}
        onClick={() => setOpen(!open)}
        title="Ajustes"
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: 'var(--surface)', color: 'var(--text-soft)' }}
      >
        <IconSettings width={20} height={20} />
      </motion.button>
    </div>
  );
}
