import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useGarage } from '../context/GarageContext';
import { Field, Button } from '../components/ui';
import { useColors, type ThemeColors } from '../theme';

export default function OnboardingScreen() {
  const { startNewGarage, useExistingCode, error } = useGarage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleNew() {
    if (!nickname.trim()) return;
    setBusy(true);
    await startNewGarage(nickname);
    setBusy(false);
  }

  async function handleExisting() {
    if (!code.trim()) return;
    setBusy(true);
    await useExistingCode(code);
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>Odova</Text>
      <Text style={styles.subtitle}>
        Track fill-ups, efficiency, and spend for every vehicle you own. No account required.
      </Text>

      <View style={styles.tabs}>
        <Text
          onPress={() => setMode('new')}
          style={[styles.tab, mode === 'new' && styles.tabActive]}
        >
          New Garage
        </Text>
        <Text
          onPress={() => setMode('existing')}
          style={[styles.tab, mode === 'existing' && styles.tabActive]}
        >
          I Have a Code
        </Text>
      </View>

      {mode === 'new' ? (
        <>
          <Field
            label="Garage nickname"
            placeholder="e.g. MyGarage"
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="none"
            maxLength={20}
          />
          <Button title="Start Tracking" variant="fill" onPress={handleNew} loading={busy} />
        </>
      ) : (
        <>
          <Field
            label="Sync code"
            placeholder="e.g. mygarage-7x4p"
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
          />
          <Button title="Load Garage" variant="fill" onPress={handleExisting} loading={busy} />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center' },
    title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 8 },
    subtitle: { fontSize: 14, color: colors.muted, marginBottom: 28, lineHeight: 20 },
    tabs: { flexDirection: 'row', marginBottom: 20, gap: 8 },
    tab: {
      flex: 1, textAlign: 'center', paddingVertical: 10,
      fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase',
      color: colors.faint, borderWidth: 1, borderColor: colors.border,
    },
    tabActive: { color: colors.text, borderColor: colors.accent, backgroundColor: 'rgba(59,130,246,0.08)' },
    error: { color: colors.red, fontSize: 13, marginTop: 16 },
  });
}
