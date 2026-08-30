import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type { AdminSession } from '../preload';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  session: AdminSession | null;
  status: Status;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.authAPI.getSession().then((restored) => {
      setSession(restored);
      setStatus(restored ? 'authenticated' : 'unauthenticated');
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const result = await window.authAPI.login(email, password);
      setSession(result);
      setStatus('authenticated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'login failed');
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await window.authAPI.logout();
    setSession(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ session, status, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
