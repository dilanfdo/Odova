import React, { useCallback, useEffect, useState } from 'react';
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
import {
  type UnitSystem, distanceUnitLabel, volumeUnitLabel, efficiencyUnitLabel, costPerDistanceUnitLabel,
  kmToDisplayDistance, litresToDisplayVolume, pricePerLitreToDisplay, costPerKmToDisplay, kmplToMpg,
} from '../lib/units';
import { Button, Field, ConsentNote, ScreenHeader, ErrorText, SegmentedControl, ChipGroup, Card } from '../components/ui';
import { useThemedStyles, useThemeMode, type ThemeColors, type ThemeMode } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
type ClaimUiState = 'idle' | 'loading' | 'unclaimed' | 'owned' | 'claimed_other' | 'error';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Metric (km, L)' },
  { value: 'imperial', label: 'Imperial (mi, gal)' },
];

export default function SettingsScreen({ navigation }: Props) {
  const {
    userCode, currencyCode, unitSystem, changeCurrency, changeUnitSystem,
    deleteAllData, restoreFromAccount, fills, reminders, vehicles, activeVehicleId,
  } = useGarage();
  const { isPro, devClearPro, purchasePro } = useEntitlement();
  const { session, sendMagicLink, signOut, deleteAccount } = useAccount();
  const { mode, setMode } = useThemeMode();
  const { colors, styles } = useThemedStyles(makeStyles);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [accountDeleteBusy, setAccountDeleteBusy] = useState(false);

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
    if (!userCode) return;
    setExporting(true);
    try {
      // Every vehicle's fuel fills and maintenance reminders, not just the
      // active vehicle — reminders live only in local AsyncStorage (see
      // lib/reminders.ts), so this is the one place that ever needs to read
      // all of them at once. One flat CSV with a Vehicle/Record Type pair of
      // columns rather than separate files, since Share.share only carries
      // a single text payload cross-platform. Values export in the user's
      // chosen unit system (units.ts) — storage/API stay metric regardless.
      const distU = distanceUnitLabel(unitSystem);
      const volU = volumeUnitLabel(unitSystem);
      const effU = efficiencyUnitLabel(unitSystem);
      const costU = costPerDistanceUnitLabel(unitSystem);
      const header = [
        'Vehicle', 'Record Type', 'Date', `Odometer (${distU})`, `Distance (${distU})`, `Volume (${volU})`,
        `Price/${volU}`, 'Total Cost', effU, `Cost${costU}`, 'Partial',
        'Title', 'Due Type', 'Due Date', `Due Odometer (${distU})`, 'Completed', 'Notes',
      ];
      const rows: (string | number)[][] = [];

      for (const v of vehicles) {
        const label = v.nickname || `${v.make} ${v.model}`;

        const vehicleFills = v.id === activeVehicleId ? fills : await api.fetchFills(userCode, v.id);
        const stats = computeStats(vehicleFills);
        for (const s of stats) {
          const efficiency = unitSystem === 'imperial'
            ? (s.kmpl ? fmt(kmplToMpg(s.kmpl)) : '')
            : (s.kmpl ? fmt(s.kmpl) : '');
          rows.push([
            label, 'Fuel', s.fill.fill_date,
            fmt(kmToDisplayDistance(s.fill.odometer, unitSystem)),
            s.distance !== null ? fmt(kmToDisplayDistance(s.distance, unitSystem)) : '',
            fmt(litresToDisplayVolume(s.fill.litres, unitSystem)),
            fmt(pricePerLitreToDisplay(s.fill.price_per_litre, unitSystem)),
            fmt(s.totalCost), efficiency,
            s.costPerKm ? fmt(costPerKmToDisplay(s.costPerKm, unitSystem), 3) : '',
            s.fill.is_partial ? 'Yes' : 'No',
            '', '', '', '', '', s.fill.notes ?? '',
          ]);
        }

        const vehicleReminders = v.id === activeVehicleId ? reminders : await api.fetchReminders(userCode, v.id);
        for (const r of vehicleReminders) {
          rows.push([
            label, 'Maintenance', '', '', '', '', '', '', '', '', '',
            r.title, r.due_type,
            r.due_date ?? '',
            r.due_odometer !== null ? fmt(kmToDisplayDistance(r.due_odometer, unitSystem)) : '',
            r.completed_at ? 'Yes' : 'No', r.notes ?? '',
          ]);
        }
      }

      const csv = [header, ...rows]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      await Share.share({
        title: `odova-export-${userCode}.csv`,
        message: csv,
      });
    } finally {
      setExporting(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and sign-in. Your garage and fill-up history are not deleted — they stay available anonymously via your sync code. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account', style: 'destructive', onPress: async () => {
            setAccountDeleteBusy(true);
            const result = await deleteAccount();
            setAccountDeleteBusy(false);
            if (!result.ok) Alert.alert('Could not delete account', result.error ?? 'Please try again.');
          },
        },
      ]
    );
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
    <ScreenHeader title="Settings" onClose={() => navigation.goBack()} />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Appearance</Text>
      <SegmentedControl options={THEME_OPTIONS} value={mode} onChange={setMode} />

      <Text style={styles.sectionLabel}>Plan</Text>
      <Card style={styles.card}>
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
      </Card>

      <Text style={styles.sectionLabel}>Sync Code</Text>
      <Card style={styles.card}>
        <Text style={styles.code}>{userCode ?? '—'}</Text>
        <Text style={styles.hint}>
          Save this code to load your garage on another device — no account needed.
        </Text>
        <Pressable onPress={copyCode} style={styles.copyBtn}>
          <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy Code'}</Text>
        </Pressable>
      </Card>

      <Text style={styles.sectionLabel}>Account</Text>
      <Card style={styles.card}>
        {!session ? (
          magicLinkSent ? (
            <>
              <Text style={styles.hint}>
                Check {email} for a sign-in link. Optional — your sync code keeps working without it.
              </Text>
              <Pressable onPress={() => { setMagicLinkSent(false); setAuthError(null); }}>
                <Text style={styles.editEmailLink}>Wrong email? Edit and resend</Text>
              </Pressable>
            </>
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
              <ConsentNote />
              <ErrorText>{authError}</ErrorText>
              <Button title="Send Magic Link" onPress={handleSendMagicLink} loading={authBusy} />
            </>
          )
        ) : (
          <>
            <Text style={styles.code}>{session.user.email}</Text>
            {claimState === 'owned' && (
              <Text style={[styles.hint, { color: colors.green }]}>
                This garage is linked to your account.
              </Text>
            )}
            {claimState === 'claimed_other' && (
              <Text style={[styles.hint, { color: colors.red }]}>
                This sync code is linked to a different account.
              </Text>
            )}
            {claimState === 'unclaimed' && (
              <Text style={styles.hint}>Link this garage to your account?</Text>
            )}
            {claimMessage && <Text style={styles.hint}>{claimMessage}</Text>}

            <View style={styles.accountActions}>
              {claimState === 'owned' && (
                <Button
                  title={claimBusy ? 'Unlinking…' : 'Unlink From Account'}
                  variant="outline" onPress={handleUnlink} disabled={claimBusy}
                />
              )}
              {claimState === 'unclaimed' && (
                <Button
                  title={claimBusy ? 'Linking…' : 'Link This Garage'}
                  variant="fill" onPress={handleClaim} disabled={claimBusy}
                />
              )}
              <Button title="Restore Garage From Account" variant="outline" onPress={handleRestoreFromAccount} />
              <Button title="Sign Out" variant="outline" onPress={() => void signOut()} />
              <Button
                title={accountDeleteBusy ? 'Deleting…' : 'Delete Account'}
                variant="danger" onPress={confirmDeleteAccount} disabled={accountDeleteBusy}
              />
            </View>
          </>
        )}
      </Card>

      <Text style={styles.sectionLabel}>Currency</Text>
      <ChipGroup
        options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol} ${c.code}` }))}
        value={currencyCode}
        onChange={changeCurrency}
      />

      <Text style={styles.sectionLabel}>Units</Text>
      <SegmentedControl options={UNIT_OPTIONS} value={unitSystem} onChange={changeUnitSystem} />

      <Text style={styles.sectionLabel}>Data</Text>
      <Button title={isPro ? 'Export CSV' : 'Export CSV 🔒 Pro'} onPress={exportCSV} loading={exporting} style={{ marginBottom: 10 }} />
      <Button title="Delete All Garage Data" variant="danger" onPress={confirmDeleteAll} />
    </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, paddingTop: 12 },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase',
      color: colors.faint, marginBottom: 8, marginTop: 18,
    },
    card: { padding: 14 },
    planStatusPro: { fontSize: 16, fontWeight: '800', color: colors.green },
    planStatusFree: { fontSize: 16, fontWeight: '800', color: colors.text },
    upgradeBtn: { marginTop: 12, backgroundColor: colors.accent, paddingVertical: 10, alignItems: 'center' },
    upgradeBtnText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', color: colors.onAccent },
    devToggle: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderSoft },
    devToggleText: { fontSize: 11, color: colors.faint, fontWeight: '600' },
    code: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
    hint: { fontSize: 12, color: colors.faint, marginTop: 8, lineHeight: 17 },
    copyBtn: { marginTop: 12, borderWidth: 1, borderColor: colors.amber, paddingVertical: 8, alignItems: 'center' },
    copyBtnText: { color: colors.amber, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    accountActions: { gap: 10, marginTop: 14 },
    editEmailLink: { color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 8 },
  });
}
