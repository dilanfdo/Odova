import React from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Linking,
  type TextInputProps, type ViewStyle,
} from 'react-native';
import { useThemedStyles, type ThemeColors } from '../theme';

const TERMS_URL = 'https://nexusdigitallabs.dev/odova/terms/';
const PRIVACY_URL = 'https://nexusdigitallabs.dev/odova/privacy-policy/';

export function ConsentNote() {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Text style={styles.consent}>
      By continuing, you agree to our{' '}
      <Text style={styles.consentLink} onPress={() => Linking.openURL(TERMS_URL)}>Terms</Text>
      {' '}and{' '}
      <Text style={styles.consentLink} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>.
    </Text>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { styles } = useThemedStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({
  label, ...props
}: { label: string } & TextInputProps) {
  const { colors, styles } = useThemedStyles(makeStyles);
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
  const { colors, styles } = useThemedStyles(makeStyles);
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
        <ActivityIndicator color={isFill ? colors.onAccent : colors.text} size="small" />
      ) : (
        <Text style={[
          styles.btnText,
          isFill && { color: colors.onAccent },
          isDanger && { color: colors.red },
        ]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function CloseButton({ onPress, style }: { onPress: () => void; style?: ViewStyle }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={[styles.closeBtn, style]} hitSlop={8}>
      <Text style={styles.closeBtnText}>✕</Text>
    </Pressable>
  );
}

/** Title + close (X) row used at the top of modal-style screens. Omit `title` for an X-only header. */
export function ScreenHeader({ title, onClose }: { title?: string; onClose: () => void }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={[styles.screenHeader, !title && styles.screenHeaderRightOnly]}>
      {title ? <Text style={styles.screenHeaderTitle}>{title}</Text> : null}
      <CloseButton onPress={onClose} />
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  const { styles } = useThemedStyles(makeStyles);
  if (!children) return null;
  return <Text style={styles.errorText}>{children}</Text>;
}

/**
 * A single-row, joined-border control for a small, mutually-exclusive set of
 * options (2-3 items) — e.g. onboarding mode, theme mode. For a larger or
 * wrapping option set, use ChipGroup instead.
 */
export function SegmentedControl<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.segmented}>
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, i > 0 && styles.segmentDivider, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Wrapping row of individually-bordered pills — for a larger option set
 * (e.g. currency, fuel type) or one-shot tap-to-fill suggestions (omit
 * `value` so no pill ever shows as selected).
 */
export function ChipGroup<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[];
  value?: T;
  onChange: (value: T) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = value !== undefined && opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      backgroundColor: colors.surface2,
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
    consent: { fontSize: 11.5, color: colors.faint, lineHeight: 16, marginBottom: 10 },
    consentLink: { color: colors.accent, fontWeight: '700' },
    closeBtn: {
      width: 34, height: 34, borderRadius: 17,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    },
    closeBtnText: { fontSize: 15, fontWeight: '700', color: colors.muted, lineHeight: 18 },
    screenHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
    },
    screenHeaderRightOnly: { justifyContent: 'flex-end' },
    screenHeaderTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
    errorText: { color: colors.red, fontSize: 13, marginBottom: 12 },
    segmented: {
      flexDirection: 'row',
      borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden',
    },
    segment: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    segmentDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
    segmentActive: { backgroundColor: colors.accent },
    segmentText: {
      fontSize: 11, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase',
      color: colors.faint,
    },
    segmentTextActive: { color: colors.onAccent },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
    chipActive: { borderColor: colors.accent, backgroundColor: colors.accentTint },
    chipText: { fontSize: 13, color: colors.muted },
    chipTextActive: { color: colors.text, fontWeight: '700' },
  });
}
