import React from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  type TextInputProps, type ViewStyle,
} from 'react-native';
import { colors } from '../theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({
  label, ...props
}: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.faint}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function Button({
  title, onPress, variant = 'outline', loading, disabled, style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'outline' | 'fill' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const isFill = variant === 'fill';
  const isDanger = variant === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        isFill && { backgroundColor: colors.accent, borderColor: colors.accent },
        isDanger && { borderColor: colors.red },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isFill ? '#0b0f19' : colors.text} size="small" />
      ) : (
        <Text style={[
          styles.btnText,
          isFill && { color: '#0b0f19' },
          isDanger && { color: colors.red },
        ]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  field: { gap: 6, marginBottom: 14 },
  label: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase', color: colors.faint,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  btn: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 13, fontWeight: '700', letterSpacing: 0.6,
    textTransform: 'uppercase', color: colors.text,
  },
  statTile: {
    flex: 1, minWidth: '45%',
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    padding: 12, gap: 4,
  },
  statLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.6,
    textTransform: 'uppercase', color: colors.faint,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  statSub: { fontSize: 11, color: colors.muted },
});
