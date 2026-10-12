import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEntitlement } from '../context/EntitlementContext';
import { PRO_PRICE_DISPLAY } from '../lib/entitlements';
import { Button, AppBar, Screen, BottomBar, Badge } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { radius, space, typography, useThemedStyles, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const BENEFITS: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'car', title: 'Unlimited vehicles', desc: 'Track your whole fleet, not just one car' },
  { icon: 'notifications', title: 'Maintenance reminders', desc: 'Never miss an oil change, tyre rotation or service, by date or odometer' },
  { icon: 'sync', title: 'Reminders on every device', desc: 'Your maintenance reminders follow your garage to a new device' },
  { icon: 'download', title: 'CSV export', desc: 'Full fill and service history, spreadsheet-ready' },
  { icon: 'noAds', title: 'No ads', desc: 'Ever' },
];

export default function PaywallScreen({ navigation }: Props) {
  const { purchasePro, restorePurchases } = useEntitlement();
  const { colors, styles } = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);

  async function handlePurchase() {
    setBusy('purchase');
    try {
      const result = await purchasePro();
      if (result.ok) {
        navigation.goBack();
      } else if (result.error) {
        // No error field means the user cancelled the store sheet — not an
        // error worth interrupting them with an alert for.
        Alert.alert('Purchase failed', result.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    setBusy('restore');
    try {
      const restored = await restorePurchases();
      if (restored) {
        navigation.goBack();
      } else {
        Alert.alert('No purchase found', 'We could not find a previous Pro purchase for this account.');
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <AppBar onClose={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon name="star" size={36} color={colors.onTertiaryContainer} />
          </View>
          <Badge label="ODOVA PRO" align="center" />
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            Look after every vehicle, A to Z
          </Text>
          <Text style={styles.subtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            One-time purchase. No subscription.
          </Text>
        </View>

        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitRow} accessible accessibilityLabel={`${b.title}. ${b.desc}`}>
              <View style={styles.benefitIcon}>
                <Icon name={b.icon} size={20} color={colors.onSecondaryContainer} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <BottomBar>
        <Button
          title={`Unlock Pro · ${PRO_PRICE_DISPLAY}`}
          onPress={handlePurchase}
          loading={busy === 'purchase'}
          disabled={busy === 'restore'}
        />
        <Button
          title="Restore purchases"
          variant="text"
          onPress={handleRestore}
          loading={busy === 'restore'}
          disabled={busy === 'purchase'}
          style={styles.restore}
        />
      </BottomBar>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { paddingHorizontal: space.xl, paddingBottom: space.xl },
    hero: { alignItems: 'center', alignSelf: 'stretch' },
    heroIcon: {
      width: 72, height: 72, borderRadius: radius.xl, marginBottom: space.lg,
      alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tertiaryContainer,
    },
    title: { ...typography.headlineMedium, color: colors.onSurface, marginTop: space.md, textAlign: 'center' },
    subtitle: { ...typography.bodyLarge, color: colors.onSurfaceVariant, marginTop: space.sm, marginBottom: space.xl, textAlign: 'center' },
    benefits: { gap: space.lg },
    benefitRow: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
    benefitIcon: {
      width: 40, height: 40, borderRadius: radius.full,
      alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer,
    },
    benefitText: { flex: 1, paddingTop: 2 },
    benefitTitle: { ...typography.titleMedium, color: colors.onSurface },
    benefitDesc: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
    restore: { marginTop: space.xs },
  });
}
