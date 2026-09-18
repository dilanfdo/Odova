// Soft-paywall wrapper: free users SEE the feature (a realistic preview) so they
// know it exists, but a lock overlay blocks interaction and routes to the
// paywall. This is deliberate — hiding Pro features entirely means free users
// never discover them. Wrap real, interactive feature UI in `preview` too
// (dimmed automatically) so the preview never drifts out of sync with reality.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useEntitlement } from '../context/EntitlementContext';
import { colors } from '../theme';

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

  if (isPro) return <>{children}</>;

  return (
    <View style={styles.wrap}>
      <View pointerEvents="none" style={styles.preview}>
        {children}
      </View>
      <View style={styles.overlay}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PRO</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Pressable style={styles.button} onPress={onUnlockPress}>
          <Text style={styles.buttonText}>Unlock with Pro</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  preview: { opacity: 0.35 },
  overlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', padding: 32,
    backgroundColor: 'rgba(11,15,25,0.55)',
  },
  badge: {
    backgroundColor: colors.amber, paddingVertical: 4, paddingHorizontal: 10,
    marginBottom: 14,
  },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#0b0f19' },
  title: { fontSize: 19, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8 },
  description: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  button: { backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: '#0b0f19' },
});
