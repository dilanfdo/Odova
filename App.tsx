import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GarageProvider } from './src/context/GarageContext';
import { EntitlementProvider } from './src/context/EntitlementContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <EntitlementProvider>
        <GarageProvider>
          <RootNavigator />
          <StatusBar style="light" />
        </GarageProvider>
      </EntitlementProvider>
    </SafeAreaProvider>
  );
}
