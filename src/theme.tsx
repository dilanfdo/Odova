// Material Design 3 color roles, generated from a blue seed so Odova reads as
// the same product family as the NDL web tool. Every screen reads semantic
// roles (`colors.primary`, `colors.surfaceContainerLow`, ...) rather than hex
// values. A user-selected mode (light/dark/system) can override the OS
// setting — see ThemeModeProvider — and is persisted across restarts.
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { Platform, useColorScheme, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getStoredThemeMode, setStoredThemeMode } from './lib/storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  success: string;
  successContainer: string;
  onSuccessContainer: string;
  warning: string;
  surface: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  scrim: string;
  /** Pressed-state overlay (Android ripple / iOS pressed tint) on surfaces. */
  stateLayer: string;
  /** Pressed-state overlay on primary-filled surfaces. */
  stateLayerOnPrimary: string;
}

const light: ThemeColors = {
  primary: '#2f5bd3',
  onPrimary: '#ffffff',
  primaryContainer: '#dbe1ff',
  onPrimaryContainer: '#00174b',
  secondaryContainer: '#dde1f9',
  onSecondaryContainer: '#161b2c',
  tertiary: '#7a5900',
  tertiaryContainer: '#ffdea6',
  onTertiaryContainer: '#261900',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#410002',
  success: '#1d7a3a',
  successContainer: '#c6efcc',
  onSuccessContainer: '#00210b',
  warning: '#9a5b00',
  surface: '#faf8ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f4f3fa',
  surfaceContainer: '#eeedf4',
  surfaceContainerHigh: '#e8e7ef',
  surfaceContainerHighest: '#e2e2e9',
  onSurface: '#1a1b21',
  onSurfaceVariant: '#45464f',
  outline: '#767680',
  outlineVariant: '#c6c6d0',
  inverseSurface: '#2f3036',
  inverseOnSurface: '#f1f0f7',
  scrim: 'rgba(0, 0, 0, 0.32)',
  stateLayer: 'rgba(26, 27, 33, 0.10)',
  stateLayerOnPrimary: 'rgba(255, 255, 255, 0.20)',
};

const dark: ThemeColors = {
  primary: '#b4c5ff',
  onPrimary: '#002a78',
  primaryContainer: '#1c40a8',
  onPrimaryContainer: '#dbe1ff',
  secondaryContainer: '#3f4759',
  onSecondaryContainer: '#dde1f9',
  tertiary: '#f1bf48',
  tertiaryContainer: '#5c4300',
  onTertiaryContainer: '#ffdea6',
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',
  success: '#86d993',
  successContainer: '#005321',
  onSuccessContainer: '#c6efcc',
  warning: '#ffb95c',
  surface: '#121318',
  surfaceContainerLowest: '#0d0e13',
  surfaceContainerLow: '#1a1b21',
  surfaceContainer: '#1e1f25',
  surfaceContainerHigh: '#292a2f',
  surfaceContainerHighest: '#34343a',
  onSurface: '#e3e1e9',
  onSurfaceVariant: '#c6c6d0',
  outline: '#90909a',
  outlineVariant: '#45464f',
  inverseSurface: '#e3e1e9',
  inverseOnSurface: '#2f3036',
  scrim: 'rgba(0, 0, 0, 0.5)',
  stateLayer: 'rgba(227, 225, 233, 0.12)',
  stateLayerOnPrimary: 'rgba(0, 42, 120, 0.16)',
};

/** Material 3 type scale. Line heights are explicit so large system font sizes wrap rather than clip. */
export const typography = {
  displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: '400' },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '400' },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '400' },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '400' },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0.15 },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.4 },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
} satisfies Record<string, TextStyle>;

/** Material 3 shape scale. */
export const radius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 28, full: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * Space to keep above the system navigation bar / home indicator.
 * Android edge-to-edge can report a 0 bottom inset while the 3-button or
 * gesture bar is still drawn over the app, so Android gets a 48dp floor
 * (one standard navigation bar).
 */
export function useBottomInset(): number {
  const { bottom } = useSafeAreaInsets();
  if (Platform.OS === 'android') return Math.max(bottom, 48);
  return bottom;
}

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
