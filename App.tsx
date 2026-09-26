import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GarageProvider } from './src/context/GarageContext';
import { EntitlementProvider } from './src/context/EntitlementContext';
import { AccountProvider } from './src/context/AccountContext';
import { ThemeModeProvider, useThemeMode } from './src/theme';
import { initAds } from './src/lib/ads';
import RootNavigator from './src/navigation/RootNavigator';

function AppShell() {
  const { resolvedScheme } = useThemeMode();
  useEffect(() => { initAds(); }, []);
  return (
    <>
      <RootNavigator />
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
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
