import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEntitlement } from '../context/EntitlementContext';
import { PRO_PRICE_DISPLAY } from '../lib/entitlements';
import { Button } from '../components/ui';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const BENEFITS = [
  { title: 'Unlimited vehicles', desc: 'Track your whole fleet, not just one car' },
  { title: 'Maintenance reminders', desc: 'Never miss an oil change, tyre rotation, or service — by date or odometer' },
  { title: 'Cloud backup & sync', desc: 'Restore your garage automatically on a new device' },
  { title: 'CSV export', desc: 'Full fill and service history, spreadsheet-ready' },
  { title: 'No ads', desc: 'Ever' },
];

export default function PaywallScreen({ navigation }: Props) {
  const { purchasePro, restorePurchases } = useEntitlement();
  const [busy, setBusy] = useState(false);

  async function handlePurchase() {
    setBusy(true);
    try {
      const ok = await purchasePro();
      if (ok) navigation.goBack();
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        navigation.goBack();
      } else {
        Alert.alert('No purchase found', 'We could not find a previous Pro purchase for this account.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ODOVA PRO</Text>
        </View>
        <Text style={styles.title}>Look after every vehicle, A to Z</Text>
        <Text style={styles.subtitle}>One-time purchase. No subscription, no recurring charge.</Text>

        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitRow}>
              <View style={styles.checkDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <Button
          title={`Unlock Pro — ${PRO_PRICE_DISPLAY}`}
          variant="fill"
          onPress={handlePurchase}
          loading={busy}
          style={{ marginTop: 8 }}
        />
        <Pressable onPress={handleRestore} disabled={busy} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={styles.restore}>Restore Purchases</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 12, alignItems: 'center' }}>
          <Text style={styles.cancel}>Not now</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 32 },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.amber, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 16 },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#0b0f19' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 8, lineHeight: 32 },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: 28 },
  benefits: { gap: 18, marginBottom: 28 },
  benefitRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  checkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 6 },
  benefitTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  benefitDesc: { fontSize: 12.5, color: colors.faint, marginTop: 2, lineHeight: 17 },
  restore: { fontSize: 13, fontWeight: '700', color: colors.accent },
  cancel: { fontSize: 13, color: colors.faint },
});
