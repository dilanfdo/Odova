// Ported from nexusdigitallabs.github.io/src/app/globals.css (dark theme tokens)
// so Odova reads as the same product family as the web tool. Light palette
// mirrors the same semantic roles for system-driven day/night switching.
// A user-selected mode (light/dark/system) can override the OS setting —
// see ThemeModeProvider — and is persisted so it survives app restarts.
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { getStoredThemeMode, setStoredThemeMode } from './lib/storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  borderSoft: string;
  text: string;
  textSecondary: string;
  muted: string;
  faint: string;
  accent: string;
  accent2: string;
  accentTint: string;
  scrim: string;
  onAccent: string;
  amber: string;
  green: string;
  red: string;
}

const dark: ThemeColors = {
  bg: '#0b0f19',
  surface: '#0f1420',
  surface2: '#141b2b',
  border: 'rgba(30, 41, 59, 0.8)',
  borderSoft: 'rgba(51, 65, 85, 0.55)',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  muted: '#94a3b8',
  faint: '#64748b',
  accent: '#3b82f6',
  accent2: '#6366f1',
  accentTint: 'rgba(59, 130, 246, 0.1)',
  scrim: 'rgba(11, 15, 25, 0.85)',
  onAccent: '#ffffff',
  amber: '#f59e0b',
  green: '#4ade80',
  red: '#f87171',
};

const light: ThemeColors = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surface2: '#f1f5f9',
  border: 'rgba(203, 213, 225, 0.9)',
  borderSoft: 'rgba(226, 232, 240, 0.8)',
  text: '#0f172a',
  textSecondary: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  accent: '#2563eb',
  accent2: '#6366f1',
  accentTint: 'rgba(37, 99, 235, 0.1)',
  scrim: 'rgba(248, 250, 252, 0.9)',
  onAccent: '#ffffff',
  amber: '#d97706',
  green: '#16a34a',
  red: '#dc2626',
};

interface ThemeModeContextValue {
  mode: ThemeMode;
  resolvedScheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    getStoredThemeMode().then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') setModeState(stored);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void setStoredThemeMode(next);
  }, []);

  const resolvedScheme: 'light' | 'dark' = mode === 'system'
    ? (systemScheme === 'light' ? 'light' : 'dark')
    : mode;

  const value = useMemo(() => ({ mode, resolvedScheme, setMode }), [mode, resolvedScheme, setMode]);

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

/** Current theme mode ('light' | 'dark' | 'system') plus the resolved scheme and a setter. */
export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}

/** Reactive theme colors — re-renders the calling component when the resolved theme changes. */
export function useColors(): ThemeColors {
  const { resolvedScheme } = useThemeMode();
  return resolvedScheme === 'light' ? light : dark;
}

/**
 * Collapses the `const colors = useColors(); const styles = useMemo(() => makeStyles(colors), [colors]);`
 * pair repeated at the top of every screen/component into one call.
 */
export function useThemedStyles<T>(makeStyles: (colors: ThemeColors) => T): { colors: ThemeColors; styles: T } {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors, makeStyles]);
  return { colors, styles };
}

// Static fallback for any non-component context that can't call hooks
// (kept minimal on purpose — prefer useColors() everywhere else).
export const colors = dark;
