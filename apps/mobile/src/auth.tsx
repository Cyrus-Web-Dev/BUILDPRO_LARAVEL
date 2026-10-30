import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearSession, loadSession, saveSession, setUnauthorizedHandler, User } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { logout(); });
    loadSession().then((s) => setUser(s?.user ?? null)).finally(() => setLoading(false));
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ accessToken: string; user: User }>('/auth/login', { body: { email, password } });
    await saveSession(r.accessToken, r.user);
    setUser(r.user);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
