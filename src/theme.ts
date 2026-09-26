// Ported from nexusdigitallabs.github.io/src/app/globals.css (dark theme tokens)
// so Odova reads as the same product family as the web tool. Light palette
// mirrors the same semantic roles for system-driven day/night switching.
import { useColorScheme } from 'react-native';

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
  amber: '#d97706',
  green: '#16a34a',
  red: '#dc2626',
};

/** Reactive theme colors — re-renders the calling component when the system theme changes. */
export function useColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'light' ? light : dark;
}

// Static fallback for any non-component context that can't call hooks
// (kept minimal on purpose — prefer useColors() everywhere else).
export const colors = dark;
