import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { GarageProvider } from './src/context/GarageContext';
import { EntitlementProvider } from './src/context/EntitlementContext';
import { AccountProvider } from './src/context/AccountContext';
import * as SystemUI from 'expo-system-ui';
import { ThemeModeProvider, useColors, useThemeMode } from './src/theme';
import { initAds } from './src/lib/ads';
import RootNavigator from './src/navigation/RootNavigator';

function AppShell() {
  const { resolvedScheme } = useThemeMode();
  const colors = useColors();
  useEffect(() => { initAds(); }, []);
  useEffect(() => {
    // Root view behind the navigator — prevents a white flash during dark-theme transitions.
    void SystemUI.setBackgroundColorAsync(colors.surface);
  }, [colors.surface]);
  return (
    <>
      <RootNavigator />
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeModeProvider>
        <AccountProvider>
          <EntitlementProvider>
            <GarageProvider>
              <AppShell />
            </GarageProvider>
          </EntitlementProvider>
        </AccountProvider>
      </ThemeModeProvider>
    </SafeAreaProvider>
  );
}
