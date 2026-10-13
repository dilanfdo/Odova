import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useGarage } from '../context/GarageContext';
import { useAccount } from '../context/AccountContext';
import {
  TextField, Button, ConsentNote, SegmentedButtons, ErrorText, Message, Screen, FormLayout,
} from '../components/ui';
import { radius, space, typography, useThemedStyles, type ThemeColors } from '../theme';

type OnboardingMode = 'new' | 'existing' | 'signin';

const MODE_OPTIONS: { value: OnboardingMode; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'existing', label: 'Use code' },
  { value: 'signin', label: 'Sign in' },
];

const MODE_COPY: Record<OnboardingMode, string> = {
  new: 'Create a garage on this device. No account needed. You get a sync code to use on other devices.',
  existing: 'Enter the sync code from another device to load that garage here.',
  signin: 'Already linked a garage to your account on another device? Sign in to restore it.',
};

export default function OnboardingScreen() {
  const { startNewGarage, useExistingCode, error, clearError } = useGarage();
  const { sendMagicLink, signInWithPassword } = useAccount();
  const { styles } = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<OnboardingMode>('new');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [signinError, setSigninError] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState('');

  function changeMode(next: OnboardingMode) {
    setMode(next);
    setFieldError(null);
    setSigninError('');
    clearError();
  }

  async function handleNew() {
    if (!nickname.trim()) { setFieldError('Enter a nickname for your garage'); return; }
    setBusy(true);
    await startNewGarage(nickname);
    setBusy(false);
  }

  async function handleExisting() {
    if (!code.trim()) { setFieldError('Enter your sync code'); return; }
    setBusy(true);
    await useExistingCode(code);
    setBusy(false);
  }

  async function handleSignIn() {
    const trimmed = email.trim();
    if (!trimmed) { setFieldError('Enter your email'); return; }
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) { setFieldError('Enter a valid email address'); return; }
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

  async function handlePasswordSignIn() {
    const trimmed = email.trim();
    if (!trimmed) { setFieldError('Enter your email'); return; }
    if (!password) { setSigninError('Enter your password'); return; }
    setSigninError('');
    setBusy(true);
    const result = await signInWithPassword(trimmed, password);
    setBusy(false);
    if (!result.ok) setSigninError(result.error ?? 'Could not sign in');
  }

  function handleEditEmail() {
    setLinkSent(false);
    setSigninError('');
  }

  return (
    <Screen>
      <FormLayout contentStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.mark}>
            <Image source={require('../../assets/icon.png')} style={styles.markImage} accessibilityIgnoresInvertColors />
          </View>
          <Text style={styles.title} accessibilityRole="header">Odova</Text>
          <Text style={styles.heroSubtitle}>
            Track fill-ups, efficiency and spend for every vehicle you own.
          </Text>
        </View>

        <SegmentedButtons options={MODE_OPTIONS} value={mode} onChange={changeMode} accessibilityLabel="How do you want to start?" />
        <Text style={styles.modeCopy}>{MODE_COPY[mode]}</Text>

        {mode === 'new' ? (
          <>
            <TextField
              label="Garage nickname"
              placeholder="e.g. MyGarage"
              value={nickname}
              onChangeText={(t) => { setNickname(t); setFieldError(null); }}
              autoCapitalize="none"
              maxLength={20}
              returnKeyType="go"
              onSubmitEditing={handleNew}
              error={fieldError}
              supportingText={`${nickname.length}/20`}
            />
            <Button title="Start tracking" onPress={handleNew} loading={busy} />
          </>
        ) : mode === 'existing' ? (
          <>
            <TextField
              label="Sync code"
              placeholder="e.g. mygarage-7x4p"
              value={code}
              onChangeText={(t) => { setCode(t); setFieldError(null); }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleExisting}
              error={fieldError}
            />
            <Button title="Load garage" onPress={handleExisting} loading={busy} />
          </>
        ) : linkSent ? (
          <>
            <Message tone="success">{`Check ${sentToEmail} for a sign-in link. Opening it restores the garage linked to your account.`}</Message>
            <Button title="Use a different email" variant="text" onPress={handleEditEmail} />
          </>
        ) : (
          <>
            <TextField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={(t) => { setEmail(t); setFieldError(null); }}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={handleSignIn}
              error={fieldError}
            />
            {usePassword ? (
              <TextField
                label="Password"
                value={password}
                onChangeText={(t) => { setPassword(t); setSigninError(''); }}
                autoCapitalize="none"
                autoComplete="current-password"
                secureTextEntry
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handlePasswordSignIn}
              />
            ) : null}
            <ConsentNote />
            <ErrorText>{signinError}</ErrorText>
            {usePassword ? (
              <Button title="Sign in" onPress={handlePasswordSignIn} loading={busy} />
            ) : (
              <Button title="Send magic link" icon="mail" onPress={handleSignIn} loading={busy} />
            )}
            <Button
              title={usePassword ? 'Email me a link instead' : 'Sign in with a password'}
              variant="text"
              onPress={() => { setUsePassword((v) => !v); setSigninError(''); setFieldError(null); }}
            />
          </>
        )}

        <View style={styles.errorSpace}>
          <ErrorText>{error}</ErrorText>
        </View>
      </FormLayout>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space.xl },
    hero: { alignItems: 'center', marginBottom: space.xxl },
    mark: {
      width: 88, height: 88, borderRadius: radius.xl, overflow: 'hidden', marginBottom: space.lg,
      backgroundColor: colors.primaryContainer,
    },
    markImage: { width: '100%', height: '100%' },
    title: { ...typography.displaySmall, color: colors.onSurface, textAlign: 'center' },
    heroSubtitle: { ...typography.bodyLarge, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: space.sm },
    modeCopy: { ...typography.bodyMedium, color: colors.onSurfaceVariant, marginTop: space.lg, marginBottom: space.xl },
    errorSpace: { marginTop: space.lg },
  });
}
