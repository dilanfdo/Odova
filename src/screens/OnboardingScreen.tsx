import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable, ScrollView, Image } from 'react-native';
import { useGarage } from '../context/GarageContext';
import { useAccount } from '../context/AccountContext';
import { Field, Button, ConsentNote, Card, SegmentedControl, ErrorText } from '../components/ui';
import { useThemedStyles, type ThemeColors } from '../theme';

type OnboardingMode = 'new' | 'existing' | 'signin';

const MODE_OPTIONS: { value: OnboardingMode; label: string }[] = [
  { value: 'new', label: 'New Garage' },
  { value: 'existing', label: 'Have a Code' },
  { value: 'signin', label: 'Sign In' },
];

export default function OnboardingScreen() {
  const { startNewGarage, useExistingCode, error } = useGarage();
  const { sendMagicLink } = useAccount();
  const { styles } = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<OnboardingMode>('new');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [signinError, setSigninError] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState('');

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

  async function handleSignIn() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSigninError('');
    setBusy(true);
    const result = await sendMagicLink(trimmed);
    setBusy(false);
    if (result.ok) {
      setSentToEmail(trimmed);
      setLinkSent(true);
    } else {
      setSigninError(result.error ?? 'Could not send sign-in link');
    }
  }

  function handleEditEmail() {
    setLinkSent(false);
    setSigninError('');
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.mark}>
          <Image source={require('../../assets/icon.png')} style={styles.markImage} />
        </View>
        <Text style={styles.title}>Odova</Text>
        <Text style={styles.heroSubtitle}>
          Track fill-ups, efficiency, and spend for every vehicle you own. No account required.
        </Text>
      </View>

      <View style={styles.tabsWrap}>
        <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={setMode} />
      </View>

      <Card style={styles.card}>
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
      ) : mode === 'existing' ? (
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
      ) : linkSent ? (
        <>
          <Text style={styles.subtitle}>
            Check <Text style={styles.emailHighlight}>{sentToEmail}</Text> for a sign-in link. Opening it will restore the garage linked to your account.
          </Text>
          <Pressable onPress={handleEditEmail}>
            <Text style={styles.editEmail}>Wrong email? Edit and resend</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>
            Already linked a garage to your account on another device? Sign in to restore it.
          </Text>
          <Field
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <ConsentNote />
          <Button title="Send Magic Link" variant="fill" onPress={handleSignIn} loading={busy} />
          <ErrorText>{signinError}</ErrorText>
        </>
      )}

      <ErrorText>{error}</ErrorText>
      </Card>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    hero: { alignItems: 'center', marginBottom: 32 },
    mark: {
      width: 72, height: 72, borderRadius: 20, overflow: 'hidden',
      marginBottom: 16,
      shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },
    markImage: { width: '100%', height: '100%' },
    title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 8, textAlign: 'center' },
    heroSubtitle: { fontSize: 14, color: colors.muted, lineHeight: 20, textAlign: 'center' },
    subtitle: { fontSize: 13, color: colors.muted, marginBottom: 14, lineHeight: 19 },
    tabsWrap: { marginBottom: 20 },
    card: { borderRadius: 14, padding: 20 },
    emailHighlight: { color: colors.text, fontWeight: '700' },
    editEmail: { color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 4 },
  });
}
