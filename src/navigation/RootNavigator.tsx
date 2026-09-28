import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { Button } from '../components/ui';
import { useColors, useThemeMode, useThemedStyles, type ThemeColors } from '../theme';

function BootErrorScreen() {
  const { error, retryBoot } = useGarage();
  const { styles } = useThemedStyles(makeErrorStyles);
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.title}>Couldn't load your garage</Text>
        <Text style={styles.message}>
          {error ?? 'Something went wrong. Please check your connection and try again.'}
        </Text>
        <Button title="Retry" variant="fill" onPress={retryBoot} style={{ marginTop: 16 }} />
      </View>
    </SafeAreaView>
  );
}

function makeErrorStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    title: { fontSize: 19, fontWeight: '800', color: colors.text, marginBottom: 10, textAlign: 'center' },
    message: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  });
}

export type RootStackParamList = {
  Onboarding: undefined;
  VehicleSetup: undefined;
  Dashboard: undefined;
  AddFill: { editId?: string } | undefined;
  AddVehicle: { editId?: string } | undefined;
  Settings: undefined;
  Maintenance: undefined;
  AddReminder: { editId?: string } | undefined;
  Paywall: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { step } = useGarage();
  const colors = useColors();
  const { resolvedScheme } = useThemeMode();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navTheme = useMemo(() => {
    const base = resolvedScheme === 'light' ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: { ...base.colors, background: colors.bg, card: colors.surface, border: colors.border, text: colors.text, primary: colors.accent },
    };
  }, [colors, resolvedScheme]);

  if (step === 'loading') {
    return (
      <View style={styles.loading}>
        <DashboardSkeleton />
      </View>
    );
  }

  if (step === 'error') {
    return <BootErrorScreen />;
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
