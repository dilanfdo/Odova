import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { useEntitlement } from '../context/EntitlementContext';
import { useAccount } from '../context/AccountContext';
import * as api from '../lib/api';
import { CURRENCIES } from '../lib/currencies';
import { computeStats, fmt } from '../lib/fuel-utils';
import { Button, Field } from '../components/ui';
import { useColors, type ThemeColors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
type ClaimUiState = 'idle' | 'loading' | 'unclaimed' | 'owned' | 'claimed_other' | 'error';

export default function SettingsScreen({ navigation }: Props) {
  const { userCode, currencyCode, changeCurrency, deleteAllData, restoreFromAccount, fills, vehicles, activeVehicleId } = useGarage();
  const { isPro, devClearPro, purchasePro } = useEntitlement();
  const { session, sendMagicLink, signOut } = useAccount();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);

  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [claimState, setClaimState] = useState<ClaimUiState>('idle');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  const refreshClaimStatus = useCallback(async () => {
    if (!userCode || !session) { setClaimState('idle'); return; }
    setClaimState('loading');
    try {
      const status = await api.getClaimStatus(userCode);
      if (status.is_owner) setClaimState('owned');
      else if (status.claimed) setClaimState('claimed_other');
      else setClaimState('unclaimed');
    } catch {
      setClaimState('error');
    }
  }, [userCode, session]);

  useEffect(() => { void refreshClaimStatus(); }, [refreshClaimStatus]);

  async function handleSendMagicLink() {
    if (!email.trim()) { setAuthError('Enter your email'); return; }
    setAuthError(null);
    setAuthBusy(true);
    const result = await sendMagicLink(email.trim());
    setAuthBusy(false);
    if (result.ok) setMagicLinkSent(true);
    else setAuthError(result.error ?? 'Could not send magic link');
  }

  async function handleClaim() {
    if (!userCode) return;
    setClaimBusy(true);
    setClaimMessage(null);
    const result = await api.claimGarage(userCode);
    setClaimBusy(false);
    if (result.ok) {
      setClaimState('owned');
      setClaimMessage('Garage linked to your account.');
    } else {
      setClaimMessage(result.error ?? 'Could not link garage');
    }
  }

  async function handleUnlink() {
    if (!userCode) return;
    Alert.alert(
      'Unlink this garage?',
      'Your sync code and data stay intact — you’ll need the code (or to link again) on new devices.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink', style: 'destructive', onPress: async () => {
            setClaimBusy(true);
            const result = await api.unlinkGarage(userCode);
            setClaimBusy(false);
            if (result.ok) {
              setClaimState('unclaimed');
              setClaimMessage('Garage unlinked. Sync code still works.');
            } else {
              setClaimMessage(result.error ?? 'Could not unlink garage');
            }
          },
        },
      ]
    );
  }

  async function handleRestoreFromAccount() {
    Alert.alert(
      'Switch to account garage?',
      'This replaces the garage currently open here with the one linked to your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch', onPress: async () => {
            const ok = await restoreFromAccount();
            if (!ok) Alert.alert('No linked garage found for this account yet.');
          },
        },
      ]
    );
  }

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

      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.card}>
        {!session ? (
          magicLinkSent ? (
            <Text style={styles.hint}>
              Check {email} for a sign-in link. Optional — your sync code keeps working without it.
            </Text>
          ) : (
            <>
              <Text style={styles.hint}>
                Optional: sign in to link this garage to your account, so it restores on a new
                device by logging in instead of retyping the code.
              </Text>
              <View style={{ marginTop: 10 }}>
                <Field
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
              <Button title="Send Magic Link" onPress={handleSendMagicLink} loading={authBusy} />
            </>
          )
        ) : (
          <>
            <Text style={styles.code}>{session.user.email}</Text>
            {claimState === 'owned' && (
              <>
                <Text style={[styles.hint, { color: colors.green }]}>
                  This garage is linked to your account.
                </Text>
                <Pressable onPress={handleUnlink} disabled={claimBusy} style={styles.dangerLink}>
                  <Text style={styles.dangerLinkText}>{claimBusy ? 'Unlinking…' : 'Unlink from account'}</Text>
                </Pressable>
              </>
            )}
            {claimState === 'claimed_other' && (
              <Text style={[styles.hint, { color: colors.red }]}>
                This sync code is linked to a different account.
              </Text>
            )}
            {claimState === 'unclaimed' && (
              <>
                <Text style={styles.hint}>Link this garage to your account?</Text>
                <Pressable onPress={handleClaim} disabled={claimBusy} style={styles.upgradeBtn}>
                  <Text style={styles.upgradeBtnText}>{claimBusy ? 'Linking…' : 'Link This Garage'}</Text>
                </Pressable>
              </>
            )}
            {claimMessage && <Text style={styles.hint}>{claimMessage}</Text>}
            <Pressable onPress={handleRestoreFromAccount} style={{ marginTop: 10 }}>
              <Text style={styles.restoreLink}>Restore garage from account</Text>
            </Pressable>
            <Pressable onPress={() => void signOut()} style={styles.dangerLink}>
              <Text style={styles.dangerLinkText}>Sign Out</Text>
            </Pressable>
          </>
        )}
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    errorText: { color: colors.red, fontSize: 12, marginBottom: 8 },
    dangerLink: { marginTop: 12 },
    dangerLinkText: { color: colors.red, fontSize: 12, fontWeight: '700' },
    restoreLink: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  });
}
