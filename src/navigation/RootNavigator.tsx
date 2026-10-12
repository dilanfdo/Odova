import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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
import { Button, Screen } from '../components/ui';
import { Icon } from '../components/Icon';
import { radius, space, typography, useColors, useThemeMode, useThemedStyles, type ThemeColors } from '../theme';

function BootErrorScreen() {
  const { error, retryBoot } = useGarage();
  const { colors, styles } = useThemedStyles(makeErrorStyles);
  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.icon}>
          <Icon name="info" size={32} color={colors.onErrorContainer} />
        </View>
        <Text style={styles.title} accessibilityRole="header">Couldn't load your garage</Text>
        <Text style={styles.message}>
          {error ?? 'Something went wrong. Please check your connection and try again.'}
        </Text>
        <Button title="Try again" icon="sync" onPress={retryBoot} style={styles.button} />
      </View>
    </Screen>
  );
}

function makeErrorStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
    icon: {
      width: 64, height: 64, borderRadius: radius.full, marginBottom: space.lg,
      alignItems: 'center', justifyContent: 'center', backgroundColor: colors.errorContainer,
    },
    title: { ...typography.headlineSmall, color: colors.onSurface, marginBottom: space.sm, textAlign: 'center' },
    message: { ...typography.bodyMedium, color: colors.onSurfaceVariant, textAlign: 'center' },
    button: { marginTop: space.xl },
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

// Android: Material-style fade-through from the bottom. iOS: the native modal sheet.
const modalOptions = Platform.OS === 'android'
  ? { presentation: 'modal' as const, animation: 'fade_from_bottom' as const }
  : { presentation: 'modal' as const };

export default function RootNavigator() {
  const { step } = useGarage();
  const colors = useColors();
  const { resolvedScheme } = useThemeMode();
  const navTheme = useMemo(() => {
    const base = resolvedScheme === 'light' ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.surface,
        card: colors.surfaceContainer,
        border: colors.outlineVariant,
        text: colors.onSurface,
        primary: colors.primary,
      },
    };
  }, [colors, resolvedScheme]);

  if (step === 'loading') {
    return (
      <Screen>
        <DashboardSkeleton />
      </Screen>
    );
  }

  if (step === 'error') {
    return <BootErrorScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
          animation: 'fade',
        }}
      >
        {step === 'onboarding' && (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        )}
        {step === 'vehicle_setup' && (
          <Stack.Screen name="VehicleSetup" component={VehicleSetupScreen} />
        )}
        {step === 'main' && (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="AddFill" component={AddFillScreen} options={modalOptions} />
            <Stack.Screen name="AddVehicle" component={AddVehicleScreen} options={modalOptions} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={modalOptions} />
            <Stack.Screen name="Maintenance" component={MaintenanceScreen} options={modalOptions} />
            <Stack.Screen name="AddReminder" component={AddReminderScreen} options={modalOptions} />
            <Stack.Screen name="Paywall" component={PaywallScreen} options={modalOptions} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
