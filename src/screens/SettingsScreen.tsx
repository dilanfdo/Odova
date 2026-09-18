import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { useEntitlement } from '../context/EntitlementContext';
import { CURRENCIES } from '../lib/currencies';
import { computeStats, fmt } from '../lib/fuel-utils';
import { Button } from '../components/ui';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const { userCode, currencyCode, changeCurrency, deleteAllData, fills, vehicles, activeVehicleId } = useGarage();
  const { isPro, devClearPro, purchasePro } = useEntitlement();
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!userCode) return;
    await Clipboard.setStringAsync(userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function exportCSV() {
    if (!isPro) {
      navigation.navigate('Paywall');
      return;
    }
    const stats = computeStats(fills);
    const vehicle = vehicles.find((v) => v.id === activeVehicleId);
    const header = ['Date', 'Odometer (km)', 'Distance (km)', 'Litres', 'Price', 'Total Cost', 'L/100km', 'km/L', 'Cost/km', 'Partial', 'Notes'];
    const rows = stats.map((s) => [
      s.fill.fill_date, s.fill.odometer, s.distance ?? '', s.fill.litres, s.fill.price_per_litre,
      fmt(s.totalCost), s.l100km ? fmt(s.l100km) : '', s.kmpl ? fmt(s.kmpl) : '',
      s.costPerKm ? fmt(s.costPerKm, 3) : '', s.fill.is_partial ? 'Yes' : 'No', s.fill.notes ?? '',
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    await Share.share({
      title: `fuel-log-${vehicle?.make ?? 'vehicle'}.csv`,
      message: csv,
    });
  }

  function confirmDeleteAll() {
    Alert.alert(
      'Delete all garage data?',
      'This permanently deletes all vehicles and fill-up history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Everything', style: 'destructive', onPress: () => void deleteAllData() },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.sectionLabel}>Plan</Text>
      <View style={styles.card}>
        {isPro ? (
          <>
            <Text style={styles.planStatusPro}>✓ Odova Pro</Text>
            <Text style={styles.hint}>Unlimited vehicles, maintenance reminders, cloud sync, CSV export, no ads.</Text>
          </>
        ) : (
          <>
            <Text style={styles.planStatusFree}>Free plan</Text>
            <Text style={styles.hint}>1 vehicle, local storage only. Upgrade for maintenance reminders, unlimited vehicles, and more.</Text>
            <Pressable onPress={() => navigation.navigate('Paywall')} style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
            </Pressable>
          </>
        )}
        {__DEV__ && (
          <Pressable
            onPress={() => (isPro ? devClearPro() : purchasePro())}
            style={styles.devToggle}
          >
            <Text style={styles.devToggleText}>
              DEV: {isPro ? 'Clear Pro entitlement' : 'Simulate Pro purchase'}
            </Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionLabel}>Sync Code</Text>
      <View style={styles.card}>
        <Text style={styles.code}>{userCode ?? '—'}</Text>
        <Text style={styles.hint}>
          Save this code to load your garage on another device — no account needed.
        </Text>
        <Pressable onPress={copyCode} style={styles.copyBtn}>
          <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy Code'}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Currency</Text>
      <View style={styles.chipRow}>
        {CURRENCIES.map((c) => (
          <Pressable
            key={c.code}
            onPress={() => changeCurrency(c.code)}
            style={[styles.chip, currencyCode === c.code && styles.chipActive]}
          >
            <Text style={[styles.chipText, currencyCode === c.code && styles.chipTextActive]}>
              {c.symbol} {c.code}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Data</Text>
      <Button title={isPro ? 'Export CSV' : 'Export CSV 🔒 Pro'} onPress={exportCSV} style={{ marginBottom: 10 }} />
      <Button title="Delete All Garage Data" variant="danger" onPress={confirmDeleteAll} />

      <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 24, alignItems: 'center' }}>
        <Text style={styles.close}>Close</Text>
      </Pressable>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 20 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase',
    color: colors.faint, marginBottom: 8, marginTop: 18,
  },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14 },
  planStatusPro: { fontSize: 16, fontWeight: '800', color: colors.green },
  planStatusFree: { fontSize: 16, fontWeight: '800', color: colors.text },
  upgradeBtn: { marginTop: 12, backgroundColor: colors.accent, paddingVertical: 10, alignItems: 'center' },
  upgradeBtnText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', color: '#0b0f19' },
  devToggle: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  devToggleText: { fontSize: 11, color: colors.faint, fontWeight: '600' },
  code: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  hint: { fontSize: 12, color: colors.faint, marginTop: 8, lineHeight: 17 },
  copyBtn: { marginTop: 12, borderWidth: 1, borderColor: colors.amber, paddingVertical: 8, alignItems: 'center' },
  copyBtnText: { color: colors.amber, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
  chipActive: { borderColor: colors.accent, backgroundColor: 'rgba(59,130,246,0.1)' },
  chipText: { fontSize: 13, color: colors.muted },
  chipTextActive: { color: colors.text, fontWeight: '700' },
  close: { color: colors.faint, fontSize: 13, fontWeight: '600' },
});
