import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Share, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGarage } from '../context/GarageContext';
import { useEntitlement } from '../context/EntitlementContext';
import { useAccount } from '../context/AccountContext';
import * as api from '../lib/api';
import { isPrivacyOptionsRequired, showPrivacyOptions } from '../lib/ads';
import { CURRENCIES } from '../lib/currencies';
import { computeStats, fmt } from '../lib/fuel-utils';
import {
  type UnitSystem, distanceUnitLabel, volumeUnitLabel, efficiencyUnitLabel, costPerDistanceUnitLabel,
  kmToDisplayDistance, litresToDisplayVolume, pricePerLitreToDisplay, costPerKmToDisplay, kmplToMpg,
} from '../lib/units';
import {
  Button, TextField, ConsentNote, AppBar, Message, SegmentedButtons, ChipGroup, Card, Screen,
  useScrollBottom, ListGroup, ListItem, SectionHeader, IconButton, Badge,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { space, typography, useThemedStyles, useThemeMode, type ThemeColors, type ThemeMode } from '../theme';
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
  const { session, sendMagicLink, signInWithPassword, signOut, deleteAccount } = useAccount();
  const { mode, setMode } = useThemeMode();
  const { colors, styles } = useThemedStyles(makeStyles);
  const scrollBottom = useScrollBottom();
  const [copied, setCopied] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);
  useEffect(() => { void isPrivacyOptionsRequired().then(setPrivacyOptionsRequired); }, []);
  const [exporting, setExporting] = useState(false);
  const [accountDeleteBusy, setAccountDeleteBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
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

  async function handlePasswordSignIn() {
    if (!email.trim()) { setAuthError('Enter your email'); return; }
    if (!password) { setAuthError('Enter your password'); return; }
    setAuthError(null);
    setAuthBusy(true);
    const result = await signInWithPassword(email.trim(), password);
    setAuthBusy(false);
    if (!result.ok) setAuthError(result.error ?? 'Could not sign in');
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

  const claimSupporting: Record<ClaimUiState, string> = {
    idle: 'Signed in',
    loading: 'Checking garage link…',
    owned: 'This garage is linked to your account',
    claimed_other: 'This sync code is linked to a different account',
    unclaimed: 'This garage isn’t linked to your account yet',
    error: 'Couldn’t check the garage link',
  };

  return (
    <Screen>
      <AppBar title="Settings" onClose={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: scrollBottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Card tone={isPro ? 'neutral' : 'primary'} style={styles.planCard}>
          <View style={styles.planHeader}>
            <Icon name={isPro ? 'checkCircle' : 'star'} size={24} color={isPro ? colors.success : colors.onPrimaryContainer} />
            <Text style={[styles.planTitle, { color: isPro ? colors.onSurface : colors.onPrimaryContainer }]}>
              {isPro ? 'Odova Pro' : 'Free plan'}
            </Text>
            {isPro ? <Badge label="ACTIVE" tone="success" /> : null}
          </View>
          <Text style={[styles.planBody, { color: isPro ? colors.onSurfaceVariant : colors.onPrimaryContainer }]}>
            {isPro
              ? 'Unlimited vehicles, maintenance reminders, CSV export and no ads.'
              : '1 vehicle, synced with your sync code. Upgrade for maintenance reminders, unlimited vehicles and more.'}
          </Text>
          {!isPro ? (
            <Button title="Upgrade to Pro" onPress={() => navigation.navigate('Paywall')} style={styles.planButton} />
          ) : null}
          {__DEV__ ? (
            <Button
              title={isPro ? 'DEV: Clear Pro entitlement' : 'DEV: Simulate Pro purchase'}
              variant="text"
              onPress={() => void (isPro ? devClearPro() : purchasePro())}
              style={styles.devButton}
            />
          ) : null}
        </Card>

        <SectionHeader title="Appearance" />
        <SegmentedButtons options={THEME_OPTIONS} value={mode} onChange={setMode} accessibilityLabel="Theme" />

        <SectionHeader title="Sync code" />
        <ListGroup>
          <ListItem
            leadingIcon="key"
            leadingTone="primary"
            headline={userCode ?? '—'}
            supporting={copied ? 'Copied to clipboard' : 'Use this code to load your garage on another device'}
            onPress={copyCode}
            accessibilityLabel={`Sync code ${userCode ?? ''}`}
            accessibilityHint="Copies the code to the clipboard"
            trailing={(
              <IconButton
                icon={copied ? 'check' : 'copy'}
                accessibilityLabel={copied ? 'Copied' : 'Copy sync code'}
                color={copied ? colors.success : undefined}
                onPress={copyCode}
              />
            )}
          />
        </ListGroup>

        <SectionHeader title="Account" />
        {!session ? (
          magicLinkSent ? (
            <>
              <Message tone="success">{`Check ${email} for a sign-in link. Your sync code keeps working either way.`}</Message>
              <Button
                title="Use a different email"
                variant="text"
                onPress={() => { setMagicLinkSent(false); setAuthError(null); }}
                style={styles.alignStart}
              />
            </>
          ) : (
            <Card>
              <Text style={styles.cardBody}>
                Optional. Sign in to link this garage to your account so it restores on a new device without the code.
              </Text>
              <TextField
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={(t) => { setEmail(t); setAuthError(null); }}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={handleSendMagicLink}
                background={colors.surfaceContainer}
                error={authError}
              />
              {usePassword ? (
                <TextField
                  label="Password"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setAuthError(null); }}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  secureTextEntry
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handlePasswordSignIn}
                  background={colors.surfaceContainer}
                />
              ) : null}
              <ConsentNote />
              {usePassword ? (
                <Button title="Sign in" variant="tonal" onPress={handlePasswordSignIn} loading={authBusy} />
              ) : (
                <Button title="Send magic link" icon="mail" variant="tonal" onPress={handleSendMagicLink} loading={authBusy} />
              )}
              <Button
                title={usePassword ? 'Email me a link instead' : 'Sign in with a password'}
                variant="text"
                onPress={() => { setUsePassword((v) => !v); setAuthError(null); }}
              />
            </Card>
          )
        ) : (
          <>
            <ListGroup>
              <ListItem
                leadingIcon="person"
                leadingTone={claimState === 'owned' ? 'success' : claimState === 'claimed_other' ? 'error' : 'primary'}
                headline={session.user.email ?? 'Signed in'}
                supporting={claimSupporting[claimState]}
                trailing={claimState === 'loading' ? <ActivityIndicator color={colors.primary} /> : undefined}
              />
              {claimState === 'unclaimed' ? (
                <ListItem
                  leadingIcon="link"
                  headline={claimBusy ? 'Linking…' : 'Link this garage'}
                  onPress={handleClaim}
                  disabled={claimBusy}
                />
              ) : null}
              {claimState === 'owned' ? (
                <ListItem
                  leadingIcon="link"
                  headline={claimBusy ? 'Unlinking…' : 'Unlink from account'}
                  onPress={handleUnlink}
                  disabled={claimBusy}
                />
              ) : null}
              <ListItem leadingIcon="history" headline="Restore garage from account" onPress={handleRestoreFromAccount} />
              <ListItem leadingIcon="logout" headline="Sign out" onPress={() => void signOut()} />
              <ListItem
                leadingIcon="delete"
                headline={accountDeleteBusy ? 'Deleting…' : 'Delete account'}
                destructive
                onPress={confirmDeleteAccount}
                disabled={accountDeleteBusy}
              />
            </ListGroup>
            {claimMessage ? <View style={styles.messageSpace}><Message tone="info">{claimMessage}</Message></View> : null}
          </>
        )}

        <SectionHeader title="Currency" />
        <ChipGroup
          options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol} ${c.code}` }))}
          value={currencyCode}
          onChange={changeCurrency}
          accessibilityLabel="Currency"
        />

        <SectionHeader title="Units" />
        <SegmentedButtons options={UNIT_OPTIONS} value={unitSystem} onChange={changeUnitSystem} accessibilityLabel="Units" />

        {privacyOptionsRequired ? (
          <>
            <SectionHeader title="Privacy" />
            <ListGroup>
              <ListItem
                leadingIcon="info"
                leadingTone="primary"
                headline="Ad privacy options"
                supporting="Review or change your ad consent choices"
                onPress={() => { void showPrivacyOptions(); }}
              />
            </ListGroup>
          </>
        ) : null}

        <SectionHeader title="Data" />
        <ListGroup>
          <ListItem
            leadingIcon="download"
            leadingTone="primary"
            headline={exporting ? 'Preparing export…' : 'Export CSV'}
            supporting="Fill-ups and reminders for every vehicle"
            onPress={exportCSV}
            disabled={exporting}
            trailing={exporting
              ? <ActivityIndicator color={colors.primary} />
              : !isPro ? <Badge label="PRO" /> : undefined}
          />
          <ListItem
            leadingIcon="delete"
            headline="Delete all garage data"
            supporting="Vehicles, fill-ups and reminders"
            destructive
            onPress={confirmDeleteAll}
          />
        </ListGroup>
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingHorizontal: space.lg, paddingTop: space.sm },
    planCard: { paddingVertical: space.xl },
    planHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    planTitle: { ...typography.titleLarge, flexShrink: 1 },
    planBody: { ...typography.bodyMedium, marginTop: space.sm },
    planButton: { marginTop: space.lg },
    devButton: { marginTop: space.sm, alignSelf: 'flex-start' },
    cardBody: { ...typography.bodyMedium, color: colors.onSurfaceVariant, marginBottom: space.lg },
    alignStart: { alignSelf: 'flex-start' },
    messageSpace: { marginTop: space.md },
  });
}
