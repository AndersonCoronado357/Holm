import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler } from '../api/client';
import type { AuthUser } from '../api/types';
import { applyTheme } from '../lib/theme';

type Status = 'loading' | 'anon' | 'authed';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface AuthCtx {
  status: Status;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: {
    email: string;
    password: string;
    name?: string;
    securityQuestion: string;
    securityAnswer: string;
  }) => Promise<void>;
  resetWithAnswer: (email: string, answer: string, newPassword: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* ignorar */
    }
    setUser(null);
    setStatus('anon');
    applyTheme('system');
  }, []);

  // 401 real (cookie inválida/ausente) -> sesión cerrada.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus('anon');
      applyTheme('system');
    });
  }, []);

  // Arranque: la sesión vive en la cookie. Validamos con /me. Si el servidor
  // aún no respondió (recién arrancó), reintentamos; un 401 sí pasa a 'anon'.
  useEffect(() => {
    applyTheme('system');
    // Limpia restos del antiguo esquema en localStorage (ya no se usa).
    try {
      localStorage.removeItem('holm.token');
      localStorage.removeItem('holm.user');
    } catch {
      /* ignorar */
    }
    let alive = true;
    (async () => {
      for (let attempt = 0; attempt < 5 && alive; attempt++) {
        try {
          const { user } = await api.auth.me();
          if (!alive) return;
          setUser(user);
          setStatus('authed');
          return;
        } catch (err) {
          if ((err as Error).message === 'Sesión no válida') {
            if (alive) setStatus('anon'); // 401: no hay sesión
            return;
          }
          await sleep(600); // error de red: el server quizá aún no arranca
        }
      }
      if (alive) setStatus('anon');
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api.auth.login(email, password);
    setUser(user);
    setStatus('authed');
  }, []);

  const signup = useCallback<AuthCtx['signup']>(async (data) => {
    const { user } = await api.auth.signup(data);
    setUser(user);
    setStatus('authed');
  }, []);

  const resetWithAnswer = useCallback(async (email: string, answer: string, newPassword: string) => {
    const { user } = await api.auth.recoverReset(email, answer, newPassword);
    setUser(user);
    setStatus('authed');
  }, []);

  return (
    <Ctx.Provider value={{ status, user, login, signup, resetWithAnswer, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
