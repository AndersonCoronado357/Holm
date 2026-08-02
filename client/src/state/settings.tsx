import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { ThemeMode } from '../api/types';
import { applyTheme } from '../lib/theme';

interface SettingsCtx {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

// Se monta solo con sesión activa: la carga de ajustes ya va autenticada.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('system');

  useEffect(() => {
    api.settings
      .get()
      .then((s) => {
        setThemeState(s.theme);
        applyTheme(s.theme);
      })
      .catch(() => applyTheme('system'));
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    applyTheme(t);
    api.settings.set({ theme: t }).catch(() => {});
  };

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings fuera de SettingsProvider');
  return ctx;
}
