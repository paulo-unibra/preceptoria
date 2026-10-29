import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, setAuthToken, setUnauthorizedHandler } from '@/lib/api';
import { storage } from '@/lib/storage';
import type { User } from '@/lib/types';

const TOKEN_KEY = 'preceptoria.token';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: Status;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  const clearSession = useCallback(async () => {
    setAuthToken(null);
    await storage.remove(TOKEN_KEY).catch(() => {});
    setUser(null);
    setStatus('signedOut');
  }, []);

  // Restaura a sessão salva ao abrir o app.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await storage.get(TOKEN_KEY);
        if (!token) return void (!cancelled && setStatus('signedOut'));
        setAuthToken(token);
        const { user: me } = await api<{ user: User }>('/auth/me');
        if (cancelled) return;
        setUser(me);
        setStatus('signedIn');
      } catch (error: any) {
        if (cancelled) return;
        // Sem rede não derruba a sessão salva; só token inválido/expirado derruba.
        if (error?.status === 401) await clearSession();
        else setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // Token expirado/revogado em qualquer chamada: volta para o login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password },
    });
    setAuthToken(result.token);
    await storage.set(TOKEN_KEY, result.token);
    setUser(result.user);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // mesmo sem rede, encerra a sessão localmente
    }
    await clearSession();
  }, [clearSession]);

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return ctx;
}
