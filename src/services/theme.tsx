import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export type ThemeMode = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: Resolved;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'pkasir:theme';
const CHANNEL_NAME = 'pkasir-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getSystemTheme = (): Resolved =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

const readStoredMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [resolved, setResolved] = useState<Resolved>(() =>
    readStoredMode() === 'system' ? getSystemTheme() : (readStoredMode() as Resolved)
  );
  const channelRef = useRef<BroadcastChannel | null>(null);

  const apply = useCallback((r: Resolved) => {
    const root = document.documentElement;
    root.classList.toggle('dark', r === 'dark');
    root.style.colorScheme = r;
    setResolved(r);
    // Sync Tauri native window chrome (title bar) with the resolved theme
    try {
      getCurrentWindow().setTheme(r).catch(() => {});
    } catch {
      /* not running in Tauri, ignore */
    }
  }, []);

  useEffect(() => {
    const r: Resolved = mode === 'system' ? getSystemTheme() : mode;
    apply(r);

    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => apply(mq.matches ? 'dark' : 'light');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
  }, [mode, apply]);

  // Cross-window sync: listen for theme changes from other windows (e.g. CustomerDisplay)
  useEffect(() => {
    const bc = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = bc;
    bc.onmessage = (e) => {
      const next = e.data?.mode;
      if (next === 'light' || next === 'dark' || next === 'system') {
        setModeState(next);
      }
    };
    // Announce presence so any already-open window can sync us
    bc.postMessage({ type: 'query' });
    return () => {
      bc.close();
      channelRef.current = null;
    };
  }, []);

  // Also sync via storage events (fallback when BroadcastChannel isn't enough)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = e.newValue;
      if (next === 'light' || next === 'dark' || next === 'system') {
        setModeState(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
    channelRef.current?.postMessage({ type: 'set', mode: next });
  }, []);

  const toggle = useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
