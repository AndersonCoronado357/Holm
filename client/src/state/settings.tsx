import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { CanvasView, Settings, SettingsPatch, ThemeMode } from '../api/types';
import { applyTheme } from '../lib/theme';

const INICIAL: Settings = {
  theme: 'system',
  notifications: { enabled: false, leadMinutes: 10 },
  lastPage: {},
};

interface SettingsCtx {
  /** Los ajustes de la cuenta ya llegaron del servidor. */
  cargado: boolean;
  ajustes: Settings;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  setAvisos: (patch: Partial<Settings['notifications']>) => void;
  paginaDe: (view: CanvasView) => string | null;
  recordarPagina: (view: CanvasView, id: string | null) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

// Único sitio donde viven las preferencias de la cuenta. Son del usuario, no
// del navegador: cambiarlas en el móvil se ve en el escritorio, y reinstalar la
// app no las pierde.
//
// El guardado es optimista (la interfaz responde ya) y se manda al servidor
// agrupado: varios cambios seguidos viajan en una sola petición, y si la red
// falla se reintenta con espera creciente en vez de perderse en silencio.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [ajustes, setAjustes] = useState<Settings>(INICIAL);
  const [cargado, setCargado] = useState(false);

  const pendiente = useRef<SettingsPatch>({});
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentos = useRef(0);

  useEffect(() => {
    api.settings
      .get()
      .then((s) => {
        setAjustes({ ...INICIAL, ...s, notifications: { ...INICIAL.notifications, ...s.notifications } });
        applyTheme(s.theme);
      })
      .catch(() => applyTheme('system'))
      .finally(() => setCargado(true));
  }, []);

  const enviar = useCallback(() => {
    const patch = pendiente.current;
    if (!Object.keys(patch).length) return;
    pendiente.current = {};
    api.settings
      .set(patch)
      .then(() => {
        intentos.current = 0;
      })
      .catch(() => {
        // Se devuelve a la cola sin pisar lo que se haya cambiado mientras
        // tanto, y se reintenta: 1 s, 2 s, 4 s… hasta 30 s.
        pendiente.current = fundir(patch, pendiente.current);
        const espera = Math.min(30_000, 1000 * 2 ** intentos.current++);
        programar(espera);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const programar = useCallback(
    (ms = 350) => {
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(enviar, ms);
    },
    [enviar],
  );

  const guardar = useCallback(
    (patch: SettingsPatch) => {
      pendiente.current = fundir(pendiente.current, patch);
      programar();
    },
    [programar],
  );

  // Al cerrar la pestaña, lo que quede en la cola sale ya.
  useEffect(() => {
    const alSalir = () => {
      if (!Object.keys(pendiente.current).length) return;
      const cuerpo = JSON.stringify(pendiente.current);
      pendiente.current = {};
      // `sendBeacon` sobrevive al cierre de la pestaña; `fetch` normal no.
      navigator.sendBeacon?.('/api/settings/beacon', new Blob([cuerpo], { type: 'application/json' }));
    };
    window.addEventListener('pagehide', alSalir);
    return () => {
      window.removeEventListener('pagehide', alSalir);
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  // El tema del sistema puede cambiar mientras la app está abierta.
  useEffect(() => {
    applyTheme(ajustes.theme);
    if (ajustes.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [ajustes.theme]);

  const setTheme = (t: ThemeMode) => {
    setAjustes((a) => ({ ...a, theme: t }));
    applyTheme(t);
    guardar({ theme: t });
  };

  const setAvisos = (patch: Partial<Settings['notifications']>) => {
    setAjustes((a) => ({ ...a, notifications: { ...a.notifications, ...patch } }));
    guardar({ notifications: patch });
  };

  const paginaDe = (view: CanvasView) => ajustes.lastPage[view] ?? null;

  const recordarPagina = (view: CanvasView, id: string | null) => {
    if ((ajustes.lastPage[view] ?? null) === id) return; // nada que guardar
    setAjustes((a) => {
      const lastPage = { ...a.lastPage };
      if (id) lastPage[view] = id;
      else delete lastPage[view];
      return { ...a, lastPage };
    });
    guardar({ lastPage: { [view]: id } });
  };

  return (
    <Ctx.Provider value={{ cargado, ajustes, theme: ajustes.theme, setTheme, setAvisos, paginaDe, recordarPagina }}>
      {children}
    </Ctx.Provider>
  );
}

/** Une dos parches sin perder claves anidadas (el segundo manda). */
function fundir(a: SettingsPatch, b: SettingsPatch): SettingsPatch {
  return {
    ...a,
    ...b,
    ...(a.notifications || b.notifications
      ? { notifications: { ...a.notifications, ...b.notifications } }
      : {}),
    ...(a.lastPage || b.lastPage ? { lastPage: { ...a.lastPage, ...b.lastPage } } : {}),
  };
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings fuera de SettingsProvider');
  return ctx;
}
