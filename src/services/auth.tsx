import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logActivity } from './activity';

export type Role = 'admin' | 'manager' | 'cashier';

export interface User {
  id: string;
  username: string;
  role: Role;
  displayName: string;
  avatar?: string | null;
}

interface AuthContextType {
  user: User | null;
  login: (role: Role, username: string, password: string) => Promise<string | null>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => 'Not initialized',
  logout: () => {},
  updateUser: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const SESSION_KEY = 'pos:auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const login = async (role: Role, username: string, password: string): Promise<string | null> => {
    try {
      const data = await invoke<{ user: User }>('login', { role, username, password });
      setUser(data.user);
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data.user)); } catch {}
      logActivity('Login', data.user.displayName, `Role: ${data.user.role}`);
      return null; // null = success
    } catch (e: any) {
      return typeof e === 'string' ? e : (e?.message || 'Koneksi gagal');
    }
  };

  const logout = () => {
    logActivity('Logout', user?.displayName);
    setUser(null);
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  };

  const updateUser = (patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Role → allowed tabs
export const ROLE_TABS: Record<Role, string[]> = {
  cashier: ['pos'],
  manager: ['dashboard', 'pos', 'transactions', 'inventory', 'products', 'reports', 'money', 'customers', 'discounts'],
  admin: ['dashboard', 'pos', 'transactions', 'inventory', 'products', 'reports', 'money', 'customers', 'discounts', 'settings', 'users'],
};

export const ROLE_DEFAULT_TAB: Record<Role, string> = {
  cashier: 'pos',
  manager: 'dashboard',
  admin: 'dashboard',
};
