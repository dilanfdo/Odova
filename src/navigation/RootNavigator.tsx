import React, { useMemo } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import OnboardingScreen from '../screens/OnboardingScreen';
import VehicleSetupScreen from '../screens/VehicleSetupScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AddFillScreen from '../screens/AddFillScreen';
import AddVehicleScreen from '../screens/AddVehicleScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import AddReminderScreen from '../screens/AddReminderScreen';
import PaywallScreen from '../screens/PaywallScreen';
import { DashboardSkeleton } from '../components/Skeleton';
import { useColors, type ThemeColors } from '../theme';

export type RootStackParamList = {
  Onboarding: undefined;
  VehicleSetup: undefined;
  Dashboard: undefined;
  AddFill: undefined;
  AddVehicle: undefined;
  Settings: undefined;
  Maintenance: undefined;
  AddReminder: undefined;
  Paywall: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { step } = useGarage();
  const colors = useColors();
  const scheme = useColorScheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navTheme = useMemo(() => {
    const base = scheme === 'light' ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: { ...base.colors, background: colors.bg, card: colors.surface, border: colors.border, text: colors.text, primary: colors.accent },
    };
  }, [colors, scheme]);

  if (step === 'loading') {
    return (
      <View style={styles.loading}>
        <DashboardSkeleton />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {step === 'onboarding' && (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        )}
        {step === 'vehicle_setup' && (
          <Stack.Screen name="VehicleSetup" component={VehicleSetupScreen} />
        )}
        {step === 'main' && (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="AddFill" component={AddFillScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="AddVehicle" component={AddVehicleScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Maintenance" component={MaintenanceScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="AddReminder" component={AddReminderScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Paywall" component={PaywallScreen} options={{ presentation: 'modal' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    loading: { flex: 1, backgroundColor: colors.bg },
  });
}
