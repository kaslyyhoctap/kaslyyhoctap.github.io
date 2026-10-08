/**
 * Theme provider ported from app.js (lines 36–38).
 *
 * - Reads/writes `S.theme` inside the `ontap12-v1` localStorage object.
 * - Applies `data-theme` attribute on `<html>` (consumed by styles.css).
 * - Falls back to `prefers-color-scheme` on first load.
 *
 * Client component because it uses localStorage and document APIs.
 */
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'ontap12-v1';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

/** Safe JSON parse for the entire ontap12-v1 state object. */
function readState(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

/** Write only the `theme` key, preserving the rest of the state object. */
function writeTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    const state = readState();
    state.theme = theme;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore — localStorage full or private mode */
  }
}

/** Apply theme via data-theme (static-site vars) AND .dark (shadcn dark: variant). */
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialTheme(): Theme {
  const stored = readState().theme as Theme | undefined;
  if (stored === 'light' || stored === 'dark') return stored;
  return getSystemTheme();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light'); // SSR default

  // Once-mounted: read persisted theme (or system preference).
  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  // Apply theme to <html> and persist whenever it changes.
  useEffect(() => {
    applyTheme(theme);
    writeTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}
