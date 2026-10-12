// Soft-paywall wrapper: free users SEE the feature (a realistic preview) so they
// know it exists, but a lock overlay blocks interaction and routes to the
// paywall. This is deliberate — hiding Pro features entirely means free users
// never discover them. Wrap real, interactive feature UI in `preview` too
// (dimmed automatically) so the preview never drifts out of sync with reality.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useEntitlement } from '../context/EntitlementContext';
import { Badge, Button } from './ui';
import { Icon } from './Icon';
import { radius, space, typography, useBottomInset, useThemedStyles, type ThemeColors } from '../theme';

export function ProGate({
  children,
  title,
  description,
  onUnlockPress,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  onUnlockPress: () => void;
}) {
  const { isPro } = useEntitlement();
  const { colors, styles } = useThemedStyles(makeStyles);
  const bottom = useBottomInset();

  if (isPro) return <>{children}</>;

  return (
    <View style={styles.wrap}>
      <View pointerEvents="none" style={styles.preview} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {children}
      </View>
      <View style={[styles.overlay, { paddingBottom: bottom }]}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Icon name="lock" size={28} color={colors.onTertiaryContainer} />
          </View>
          <Badge label="PRO" align="center" />
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <Button title="Unlock with Pro" icon="star" onPress={onUnlockPress} style={styles.button} />
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    preview: { flex: 1, opacity: 0.3 },
    overlay: {
      position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      padding: space.xl,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerHigh,
      borderRadius: radius.xl,
      padding: space.xl,
    },
    icon: {
      width: 56, height: 56, borderRadius: radius.full, marginBottom: space.md,
      alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tertiaryContainer,
    },
    title: { ...typography.headlineSmall, color: colors.onSurface, textAlign: 'center', marginTop: space.md },
    description: { ...typography.bodyMedium, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: space.sm },
    button: { marginTop: space.xl, alignSelf: 'stretch' },
  });
}
