import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@rd/shared';

const TOKEN_KEY = 'rd_auth_token';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAdmin: boolean;
  isManager: boolean;
  canManage: boolean; // admin or manager
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  // Validate stored token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) { setLoading(false); return; }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${storedToken}` } })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((u: User) => { setUser(u); setToken(storedToken); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || isAdmin;
  const canManage = isManager;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isManager, canManage }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
