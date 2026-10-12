import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Linking, Animated, Platform,
  Keyboard, KeyboardAvoidingView, ScrollView, Modal, Switch,
  type TextInputProps, type StyleProp, type ViewStyle, type AccessibilityRole, type AccessibilityState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Icon, type IconName } from './Icon';
import { toISODate, parseISODate } from '../lib/dates';
import { fmtDate } from '../lib/fuel-utils';
import {
  radius, space, typography, useBottomInset, useThemeMode, useThemedStyles, type ThemeColors,
} from '../theme';

const TERMS_URL = 'https://nexusdigitallabs.dev/odova/terms/';
const PRIVACY_URL = 'https://nexusdigitallabs.dev/odova/privacy-policy/';

export type Tone = 'primary' | 'neutral' | 'error' | 'success' | 'warning' | 'tertiary';

function toneColors(colors: ThemeColors, tone: Tone): { bg: string; fg: string } {
  switch (tone) {
    case 'primary': return { bg: colors.primaryContainer, fg: colors.onPrimaryContainer };
    case 'error': return { bg: colors.errorContainer, fg: colors.onErrorContainer };
    case 'success': return { bg: colors.successContainer, fg: colors.onSuccessContainer };
    case 'tertiary':
    case 'warning': return { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer };
    default: return { bg: colors.surfaceContainerHighest, fg: colors.onSurfaceVariant };
  }
}

// ── Layout ─────────────────────────────────────────────────────────────────────

/** Root of every screen: insets the status bar and sides. The bottom is left to the content, see useScrollBottom/BottomBar. */
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

/** Scroll padding so the last item clears the system navigation bar. */
export function useScrollBottom(extra: number = space.xl): number {
  return useBottomInset() + extra;
}

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return visible;
}

/** Sticky footer for a screen's primary action. Rides above the keyboard inside FormLayout. */
export function BottomBar({ children }: { children: React.ReactNode }) {
  const { styles } = useThemedStyles(makeStyles);
  const bottom = useBottomInset();
  const keyboardVisible = useKeyboardVisible();
  return (
    <View style={[styles.bottomBar, { paddingBottom: (keyboardVisible ? 0 : bottom) + space.md }]}>
      {children}
    </View>
  );
}

/** Scrollable form body plus a sticky footer, both kept clear of the keyboard and system bars. */
export function FormLayout({ children, footer, contentStyle }: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { styles } = useThemedStyles(makeStyles);
  const scrollBottom = useScrollBottom();
  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.formContent, !footer && { paddingBottom: scrollBottom }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer ? <BottomBar>{footer}</BottomBar> : null}
    </KeyboardAvoidingView>
  );
}

// ── Touch feedback ────────────────────────────────────────────────────────────

/**
 * Pressable with Material state feedback: the native ripple on Android, a
 * state-layer tint on iOS. Clips to the style's borderRadius.
 */
export function Touchable({
  children, style, onPress, onLongPress, disabled, rippleColor, hitSlop,
  accessibilityLabel, accessibilityHint, accessibilityRole = 'button', accessibilityState,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  rippleColor?: string;
  hitSlop?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
}) {
  const { colors } = useThemedStyles(makeStyles);
  const layer = rippleColor ?? colors.stateLayer;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      android_ripple={{ color: layer }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled), ...accessibilityState }}
      style={[stylesStatic.clip, style]}
    >
      {({ pressed }) => (
        <>
          {pressed && Platform.OS !== 'android' ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: layer }]} />
          ) : null}
          {children}
        </>
      )}
    </Pressable>
  );
}

const stylesStatic = StyleSheet.create({
  clip: { overflow: 'hidden' },
});

// ── App bar ───────────────────────────────────────────────────────────────────

/**
 * Material 3 top app bar. `large` puts the title on its own line in the
 * headline style; otherwise it sits inline. `onClose` adds a leading close
 * button (full-screen dialog pattern).
 */
export function AppBar({ title, subtitle, onClose, actions, large, onTitlePress, titleAccessory }: {
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  actions?: React.ReactNode;
  large?: boolean;
  onTitlePress?: () => void;
  titleAccessory?: React.ReactNode;
}) {
  const { colors, styles } = useThemedStyles(makeStyles);
  const titleBlock = title ? (
    <View style={styles.flexShrink}>
      <View style={styles.titleRow}>
        <Text
          style={[large ? styles.appBarTitleLarge : styles.appBarTitle, styles.flexShrink]}
          numberOfLines={large ? 2 : 1}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {titleAccessory}
      </View>
      {subtitle ? <Text style={styles.appBarSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
  ) : null;

  const titleNode = titleBlock && onTitlePress ? (
    <Touchable onPress={onTitlePress} style={styles.titlePressable} accessibilityHint="Opens vehicle options">
      {titleBlock}
    </Touchable>
  ) : titleBlock;

  return (
    <View style={styles.appBar}>
      <View style={styles.appBarRow}>
        {onClose ? (
          <IconButton icon="close" onPress={onClose} accessibilityLabel="Close" color={colors.onSurface} />
        ) : null}
        <View style={[styles.flex, !onClose && styles.appBarTitleInset]}>{!large ? titleNode : null}</View>
        {actions ? <View style={styles.appBarActions}>{actions}</View> : null}
      </View>
      {large && titleNode ? <View style={styles.appBarLargeTitle}>{titleNode}</View> : null}
    </View>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────────

export function IconButton({
  icon, onPress, accessibilityLabel, accessibilityHint, variant = 'standard', color, badge, disabled,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  variant?: 'standard' | 'tonal' | 'filled';
  color?: string;
  badge?: 'lock' | 'dot';
  disabled?: boolean;
}) {
  const { colors, styles } = useThemedStyles(makeStyles);
  const bg = variant === 'filled' ? colors.primary : variant === 'tonal' ? colors.secondaryContainer : 'transparent';
  const fg = color ?? (variant === 'filled' ? colors.onPrimary : variant === 'tonal' ? colors.onSecondaryContainer : colors.onSurfaceVariant);
  return (
    <View style={styles.iconButtonWrap}>
      <Touchable
        onPress={onPress}
        disabled={disabled}
        hitSlop={4}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={[styles.iconButton, { backgroundColor: bg }, disabled && styles.disabled]}
      >
        <Icon name={icon} size={24} color={fg} />
      </Touchable>
      {badge === 'lock' ? (
        <View style={styles.lockBadge} pointerEvents="none">
          <Icon name="lock" size={10} color={colors.onTertiaryContainer} />
        </View>
      ) : null}
      {badge === 'dot' ? <View style={styles.dotBadge} pointerEvents="none" /> : null}
    </View>
  );
}

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger';

export function Button({
  title, onPress, variant = 'filled', icon, loading, disabled, style, accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const { colors, styles } = useThemedStyles(makeStyles);
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string; ripple: string }> = {
    filled: { bg: colors.primary, fg: colors.onPrimary, ripple: colors.stateLayerOnPrimary },
    tonal: { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer, ripple: colors.stateLayer },
    outlined: { bg: 'transparent', fg: colors.primary, border: colors.outline, ripple: colors.stateLayer },
    text: { bg: 'transparent', fg: colors.primary, ripple: colors.stateLayer },
    danger: { bg: 'transparent', fg: colors.error, border: colors.error, ripple: colors.stateLayer },
  };
  const p = palette[variant];
  const inactive = disabled || loading;
  return (
    <Touchable
      onPress={onPress}
      disabled={inactive}
      rippleColor={p.ripple}
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: Boolean(loading) }}
      style={[
        styles.btn,
        variant === 'text' && styles.btnText,
        { backgroundColor: p.bg, borderColor: p.border ?? 'transparent' },
        disabled && !loading && (variant === 'filled' || variant === 'tonal'
          ? { backgroundColor: colors.surfaceContainerHighest }
          : styles.disabled),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <View style={styles.btnInner}>
          {icon ? <Icon name={icon} size={18} color={disabled ? colors.onSurfaceVariant : p.fg} /> : null}
          <Text
            style={[styles.btnLabel, { color: disabled && (variant === 'filled' || variant === 'tonal') ? colors.onSurfaceVariant : p.fg }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </Touchable>
  );
}

/** Material 3 extended FAB. Collapses to an icon-only FAB when `extended` is false. */
export function Fab({ icon, label, onPress, extended = true, style }: {
  icon: IconName;
  label: string;
  onPress: () => void;
  extended?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, styles } = useThemedStyles(makeStyles);
  const enter = useRef(new Animated.Value(0)).current;
  const expand = useRef(new Animated.Value(extended ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 }).start();
  }, [enter]);

  useEffect(() => {
    Animated.timing(expand, { toValue: extended ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [extended, expand]);

  return (
    <Animated.View style={[styles.fabShadow, style, { opacity: enter, transform: [{ scale: enter }] }]}>
      <Touchable onPress={onPress} accessibilityLabel={label} style={styles.fab}>
        <Icon name={icon} size={24} color={colors.onPrimaryContainer} />
        <Animated.View
          style={{
            overflow: 'hidden',
            opacity: expand,
            maxWidth: expand.interpolate({ inputRange: [0, 1], outputRange: [0, 200] }),
            marginLeft: expand.interpolate({ inputRange: [0, 1], outputRange: [0, space.md] }),
          }}
        >
          <Text style={styles.fabLabel} numberOfLines={1}>{label}</Text>
        </Animated.View>
      </Touchable>
    </Animated.View>
  );
}

// ── Inputs ────────────────────────────────────────────────────────────────────

function FieldShell({
  label, floated, focused, error, supportingText, background, multiline, onPress, children,
}: {
  label: string;
  floated: boolean;
  focused: boolean;
  error?: string | null;
  supportingText?: string;
  background?: string;
  multiline?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const { colors, styles } = useThemedStyles(makeStyles);
  const anim = useRef(new Animated.Value(floated ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: floated ? 1 : 0, duration: 150, useNativeDriver: false }).start();
  }, [floated, anim]);

  const borderColor = error ? colors.error : focused ? colors.primary : colors.outline;
  const labelColor = error ? colors.error : focused ? colors.primary : colors.onSurfaceVariant;
  const bg = background ?? colors.surface;

  return (
    <View style={styles.field}>
      <Pressable
        onPress={onPress}
        accessible={false}
        style={[
          styles.fieldBox,
          multiline && styles.fieldBoxMultiline,
          { borderColor, borderWidth: focused || error ? 2 : 1, paddingHorizontal: focused || error ? 15 : 16 },
        ]}
      >
        {children}
        <Animated.Text
          pointerEvents="none"
          numberOfLines={1}
          style={[
            styles.fieldLabel,
            {
              color: labelColor,
              backgroundColor: bg,
              top: anim.interpolate({ inputRange: [0, 1], outputRange: [15, -10] }),
              fontSize: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 12] }),
              left: focused || error ? 11 : 12,
            },
          ]}
        >
          {label}
        </Animated.Text>
      </Pressable>
      {error ? (
        <Text style={[styles.supporting, { color: colors.error }]} accessibilityLiveRegion="polite">{error}</Text>
      ) : supportingText ? (
        <Text style={styles.supporting}>{supportingText}</Text>
      ) : null}
    </View>
  );
}

/** Material 3 outlined text field with a floating label, inline error, supporting text and optional unit suffix. */
export function TextField({
  label, error, supportingText, suffix, background, onFocus, onBlur, placeholder, ...props
}: {
  label: string;
  error?: string | null;
  supportingText?: string;
  suffix?: string;
  background?: string;
} & TextInputProps) {
  const { colors, styles } = useThemedStyles(makeStyles);
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const floated = focused || Boolean(props.value);
  return (
    <FieldShell
      label={label}
      floated={floated}
      focused={focused}
      error={error}
      supportingText={supportingText}
      background={background}
      multiline={props.multiline}
      onPress={() => inputRef.current?.focus()}
    >
      <TextInput
        ref={inputRef}
        placeholder={floated ? placeholder : undefined}
        placeholderTextColor={colors.onSurfaceVariant}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        accessibilityLabel={label}
        accessibilityHint={error ?? supportingText}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[styles.input, props.multiline && styles.inputMultiline]}
        {...props}
      />
      {suffix && floated ? <Text style={styles.suffix}>{suffix}</Text> : null}
    </FieldShell>
  );
}

/**
 * Date input styled like TextField. Opens the system Material date dialog on
 * Android and an inline calendar sheet on iOS. Value is a YYYY-MM-DD string.
 */
export function DateField({
  label, value, onChange, minimumDate, maximumDate, error, supportingText,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string | null;
  supportingText?: string;
}) {
  const { colors, styles } = useThemedStyles(makeStyles);
  const { resolvedScheme } = useThemeMode();
  const bottom = useBottomInset();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ? parseISODate(value) : new Date());

  function open() {
    const current = value ? parseISODate(value) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        minimumDate,
        maximumDate,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date) onChange(toISODate(date));
        },
      });
    } else {
      setDraft(current);
      setIosOpen(true);
    }
  }

  return (
    <>
      <FieldShell
        label={label}
        floated={Boolean(value)}
        focused={iosOpen}
        error={error}
        supportingText={supportingText}
        onPress={open}
      >
        <Pressable
          onPress={open}
          style={styles.dateInner}
          accessibilityRole="button"
          accessibilityLabel={`${label}${value ? `, ${fmtDate(value)}` : ''}`}
          accessibilityHint="Opens a date picker"
        >
          <Text style={[styles.dateValue, !value && { color: 'transparent' }]} numberOfLines={1}>
            {value ? fmtDate(value) : ' '}
          </Text>
          <Icon name="event" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
      </FieldShell>

      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setIosOpen(false)} accessibilityLabel="Dismiss date picker" />
          <View style={[styles.sheet, { paddingBottom: bottom + space.lg }]}>
            <View style={styles.sheetHandle} />
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              themeVariant={resolvedScheme}
              accentColor={colors.primary}
              onChange={(_e, date) => { if (date) setDraft(date); }}
            />
            <View style={styles.sheetActions}>
              <Button title="Cancel" variant="text" onPress={() => setIosOpen(false)} />
              <Button title="OK" variant="text" onPress={() => { onChange(toISODate(draft)); setIosOpen(false); }} />
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

/** Material 3 segmented buttons for 2–3 mutually exclusive options. */
export function SegmentedButtons<T extends string>({
  options, value, onChange, accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const { colors, styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <Touchable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ checked: active }}
            style={[
              styles.segment,
              i > 0 && styles.segmentDivider,
              active && { backgroundColor: colors.secondaryContainer },
            ]}
          >
            {active ? <Icon name="check" size={18} color={colors.onSecondaryContainer} /> : null}
            <Text
              style={[styles.segmentLabel, { color: active ? colors.onSecondaryContainer : colors.onSurface }]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

/**
 * Wrapping row of Material 3 chips. With `value` they're filter chips (one
 * selected, shown with a check); without it they're one-shot suggestion chips.
 */
export function ChipGroup<T extends string>({
  options, value, onChange, accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value?: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const { colors, styles } = useThemedStyles(makeStyles);
  const isFilter = value !== undefined;
  return (
    <View style={styles.chipRow} accessibilityLabel={accessibilityLabel}>
      {options.map((opt) => {
        const active = isFilter && opt.value === value;
        return (
          <Touchable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            hitSlop={8}
            accessibilityRole={isFilter ? 'radio' : 'button'}
            accessibilityLabel={opt.label}
            accessibilityState={isFilter ? { checked: active } : undefined}
            style={[
              styles.chip,
              active && { backgroundColor: colors.secondaryContainer, borderColor: colors.secondaryContainer },
              active && styles.chipWithIcon,
            ]}
          >
            {active ? <Icon name="check" size={18} color={colors.onSecondaryContainer} /> : null}
            <Text
              numberOfLines={1}
              style={[styles.chipLabel, { color: active ? colors.onSecondaryContainer : colors.onSurfaceVariant }]}
            >
              {opt.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

// ── Lists & containers ────────────────────────────────────────────────────────

export function SectionHeader({ title, trailing }: { title: string; trailing?: React.ReactNode }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText} accessibilityRole="header">{title}</Text>
      {trailing}
    </View>
  );
}

/** Tonal container that groups list items, with hairline dividers between them. */
export function ListGroup({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { styles } = useThemedStyles(makeStyles);
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.listGroup, style]}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

export function ListItem({
  headline, supporting, leadingIcon, leadingTone = 'neutral', trailing, onPress, onLongPress,
  destructive, disabled, accessibilityHint, accessibilityRole, accessibilityState, accessibilityLabel,
}: {
  headline: string;
  supporting?: string;
  leadingIcon?: IconName;
  leadingTone?: Tone;
  trailing?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityLabel?: string;
}) {
  const { colors, styles } = useThemedStyles(makeStyles);
  const tone = toneColors(colors, destructive ? 'error' : leadingTone);
  const content = (
    <>
      {leadingIcon ? (
        <View style={[styles.leadingIcon, { backgroundColor: tone.bg }]}>
          <Icon name={leadingIcon} size={20} color={tone.fg} />
        </View>
      ) : null}
      <View style={styles.flexShrinkGrow}>
        <Text style={[styles.listHeadline, destructive && { color: colors.error }]}>{headline}</Text>
        {supporting ? <Text style={styles.listSupporting}>{supporting}</Text> : null}
      </View>
      {trailing ? <View style={styles.listTrailing}>{trailing}</View> : null}
    </>
  );
  if (!onPress && !onLongPress) {
    return <View style={styles.listItem} accessible accessibilityLabel={accessibilityLabel}>{content}</View>;
  }
  return (
    <Touchable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? (supporting ? `${headline}, ${supporting}` : headline)}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      style={[styles.listItem, disabled && styles.disabled]}
    >
      {content}
    </Touchable>
  );
}

/** List row with a trailing switch; tapping anywhere on the row toggles it. */
export function SwitchItem({ headline, supporting, value, onValueChange }: {
  headline: string;
  supporting?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useThemedStyles(makeStyles);
  return (
    <ListItem
      headline={headline}
      supporting={supporting}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      trailing={(
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.surfaceContainerHighest, true: colors.primary }}
          thumbColor={Platform.OS === 'android' ? (value ? colors.onPrimary : colors.outline) : undefined}
          ios_backgroundColor={colors.surfaceContainerHighest}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        />
      )}
    />
  );
}

export function Card({ children, style, tone = 'neutral' }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'neutral' | 'primary' | 'tertiary';
}) {
  const { colors, styles } = useThemedStyles(makeStyles);
  const bg = tone === 'primary' ? colors.primaryContainer : tone === 'tertiary' ? colors.tertiaryContainer : colors.surfaceContainer;
  return <View style={[styles.card, { backgroundColor: bg }, style]}>{children}</View>;
}

export function Badge({ label, tone = 'tertiary', align = 'start' }: {
  label: string;
  tone?: Tone;
  /** Where the badge sits inside a column container. */
  align?: 'start' | 'center';
}) {
  const { colors, styles } = useThemedStyles(makeStyles);
  const t = toneColors(colors, tone);
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, align === 'center' && styles.badgeCenter]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: {
  icon: IconName;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  const { colors, styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={32} color={colors.onSecondaryContainer} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

/** Inline banner for form-level errors and confirmations. */
export function Message({ children, tone = 'error' }: { children?: string | null; tone?: 'error' | 'success' | 'info' }) {
  const { colors, styles } = useThemedStyles(makeStyles);
  if (!children) return null;
  const t = toneColors(colors, tone === 'error' ? 'error' : tone === 'success' ? 'success' : 'primary');
  return (
    <View style={[styles.message, { backgroundColor: t.bg }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Icon name={tone === 'success' ? 'checkCircle' : 'info'} size={20} color={t.fg} />
      <Text style={[styles.messageText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

/** Form-level error banner. Renders nothing when empty. */
export function ErrorText({ children }: { children?: string | null }) {
  return <Message tone="error">{children}</Message>;
}

export function ConsentNote() {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Text style={styles.consent}>
      By continuing, you agree to our{' '}
      <Text style={styles.consentLink} onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link">Terms</Text>
      {' '}and{' '}
      <Text style={styles.consentLink} onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">Privacy Policy</Text>.
    </Text>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    flexShrink: { flexShrink: 1 },
    flexShrinkGrow: { flex: 1, flexShrink: 1 },
    disabled: { opacity: 0.38 },
    screen: { flex: 1, backgroundColor: colors.surface },
    formContent: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xl },
    bottomBar: {
      paddingHorizontal: space.lg,
      paddingTop: space.md,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outlineVariant,
    },

    appBar: { paddingHorizontal: space.xs, paddingTop: space.xs },
    appBarRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center' },
    appBarTitleInset: { paddingLeft: space.md },
    appBarTitle: { ...typography.titleLarge, color: colors.onSurface },
    appBarTitleLarge: { ...typography.headlineMedium, color: colors.onSurface },
    appBarSubtitle: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
    appBarActions: { flexDirection: 'row', alignItems: 'center' },
    appBarLargeTitle: { paddingHorizontal: space.md, paddingBottom: space.lg },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    titlePressable: { borderRadius: radius.md, paddingVertical: space.xs, paddingHorizontal: space.xs, marginLeft: -space.xs, alignSelf: 'flex-start' },

    iconButtonWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    iconButton: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
    lockBadge: {
      position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tertiaryContainer,
    },
    dotBadge: {
      position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4,
      backgroundColor: colors.success,
    },

    btn: {
      minHeight: 48,
      borderRadius: radius.full,
      borderWidth: 1,
      paddingHorizontal: space.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: { paddingHorizontal: space.md },
    btnInner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    btnLabel: { ...typography.labelLarge, fontSize: 15 },

    fabShadow: {
      borderRadius: radius.lg,
      backgroundColor: colors.primaryContainer,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
        android: { elevation: 4 },
        default: {},
      }),
    },
    fab: {
      minHeight: 56,
      minWidth: 56,
      borderRadius: radius.lg,
      paddingHorizontal: space.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryContainer,
    },
    fabLabel: { ...typography.labelLarge, fontSize: 15, color: colors.onPrimaryContainer },

    field: { marginBottom: space.lg },
    fieldBox: {
      minHeight: 56,
      borderRadius: radius.sm,
      flexDirection: 'row',
      alignItems: 'center',
    },
    fieldBoxMultiline: { minHeight: 104, alignItems: 'flex-start' },
    fieldLabel: { position: 'absolute', right: 12, paddingHorizontal: 4, alignSelf: 'flex-start' },
    input: { ...typography.bodyLarge, flex: 1, color: colors.onSurface, paddingVertical: 15, minHeight: 54 },
    inputMultiline: { minHeight: 100, textAlignVertical: 'top', paddingTop: 16 },
    suffix: { ...typography.bodyLarge, color: colors.onSurfaceVariant, marginLeft: space.sm },
    supporting: { ...typography.bodySmall, color: colors.onSurfaceVariant, marginTop: space.xs, paddingHorizontal: space.lg },
    dateInner: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 54 },
    dateValue: { ...typography.bodyLarge, flex: 1, color: colors.onSurface },

    sheetBackdrop: { flex: 1, backgroundColor: colors.scrim },
    sheet: {
      backgroundColor: colors.surfaceContainerLow,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: space.lg,
      paddingTop: space.sm,
    },
    sheetHandle: {
      alignSelf: 'center', width: 32, height: 4, borderRadius: 2,
      backgroundColor: colors.onSurfaceVariant, opacity: 0.4, marginBottom: space.sm,
    },
    sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },

    segmented: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.outline,
      borderRadius: radius.full,
      overflow: 'hidden',
    },
    segment: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: space.sm,
    },
    segmentDivider: { borderLeftWidth: 1, borderLeftColor: colors.outline },
    segmentLabel: { ...typography.labelLarge, flexShrink: 1 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    chip: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: space.lg,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    chipWithIcon: { paddingLeft: space.sm },
    chipLabel: { ...typography.labelLarge, flexShrink: 0 },

    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: space.xl, paddingBottom: space.sm, paddingHorizontal: space.xs,
    },
    sectionHeaderText: { ...typography.titleSmall, color: colors.primary },
    listGroup: { backgroundColor: colors.surfaceContainer, borderRadius: radius.lg, overflow: 'hidden' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant, marginLeft: space.lg },
    listItem: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.lg,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
    },
    leadingIcon: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
    listHeadline: { ...typography.bodyLarge, color: colors.onSurface },
    listSupporting: { ...typography.bodyMedium, color: colors.onSurfaceVariant },
    listTrailing: { alignItems: 'flex-end', justifyContent: 'center' },

    card: { borderRadius: radius.lg, padding: space.lg },
    badge: { borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 2, alignSelf: 'flex-start' },
    badgeCenter: { alignSelf: 'center' },
    badgeText: { ...typography.labelSmall },

    empty: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl, gap: space.sm },
    emptyIcon: {
      width: 64, height: 64, borderRadius: radius.full, marginBottom: space.sm,
      alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer,
    },
    emptyTitle: { ...typography.titleMedium, color: colors.onSurface, textAlign: 'center' },
    emptyBody: { ...typography.bodyMedium, color: colors.onSurfaceVariant, textAlign: 'center' },
    emptyAction: { marginTop: space.md },

    message: {
      flexDirection: 'row', alignItems: 'flex-start', gap: space.md,
      borderRadius: radius.md, padding: space.md, marginBottom: space.lg,
    },
    messageText: { ...typography.bodyMedium, flex: 1 },

    consent: { ...typography.bodySmall, color: colors.onSurfaceVariant, marginBottom: space.lg },
    consentLink: { color: colors.primary, fontWeight: '500', textDecorationLine: 'underline' },
  });
}
