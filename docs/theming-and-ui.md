# Theming and shared UI

The app follows **Material Design 3** (tonal surfaces, M3 type scale, pill
buttons, outlined text fields) on both platforms, with platform-appropriate
touch feedback: ripples on Android, a state-layer overlay on iOS.

## Theme system

`src/theme.tsx` defines two full palettes (`light`, `dark`) against a single
`ThemeColors` interface of **M3 color roles**: `primary` / `onPrimary`,
`primaryContainer` / `onPrimaryContainer`, `secondaryContainer`,
`tertiary*` (the amber Pro accent), `error*`, `success*`, `warning`,
`surface` plus the `surfaceContainerLowest` through `surfaceContainerHighest`
tonal ladder, `onSurface` / `onSurfaceVariant`, `outline` / `outlineVariant`,
`inverseSurface`, `scrim`, and the `stateLayer*` press overlays. Screens
only read roles. They never use hex values and never need to know which
palette is active.

Alongside colors the theme exports three scales. Use these rather than
hand-picking numbers:
- `typography`: the M3 type scale (`displaySmall`, `headline*`, `title*`,
  `body*`, `label*`). Spread it into a style:
  `{ ...typography.titleMedium, color: colors.onSurface }`.
- `radius`: `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 28`, `full`.
- `space`: `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`, `xxl 32`.

`ThemeModeProvider` tracks a **user-selectable mode** (`'light' | 'dark' |
'system'`), persisted via AsyncStorage, resolved against the OS setting only
when `'system'` is selected. Four things consume the *resolved* scheme:
`useColors()`, `RootNavigator`'s React Navigation theme, `App.tsx`'s
`<StatusBar>` icon style, and `App.tsx`'s `SystemUI.setBackgroundColorAsync`
call. The last one keeps the root view the same color as the screens, so
modal transitions don't flash white in dark mode.

`useThemedStyles(makeStyles)` returns `{ colors, styles }`, so a screen
doesn't have to call `useColors()` and memoize its styles separately.

## Icons (`src/components/Icon.tsx`)

Icons are Material Symbols paths drawn with `react-native-svg`, which is
already a dependency, so no icon font or new package is needed. To add an
icon, add its 24×24 path to the `PATHS` map. `IconName` is derived from that
map, so a typo is a type error. Icons are hidden from accessibility, and the
control around them carries the label.

## Shared components (`src/components/ui.tsx`)

Layout:
- **`Screen`**: a `SafeAreaView` that insets the top and sides only (see
  "System navigation bar" below).
- **`AppBar`**: the M3 top app bar. Pass `onClose` for a leading ✕ on modal
  screens, `actions` for trailing `IconButton`s, `large` for a headline-sized
  title, and `onTitlePress` / `titleAccessory` for a tappable title (the
  dashboard's vehicle switcher).
- **`FormLayout`**: a keyboard-avoiding scroll view with an optional sticky
  `footer`, used by every form screen. The footer is rendered in a
  **`BottomBar`**, which handles the navigation-bar inset and drops it while
  the keyboard is open.
- **`Fab`**: an extended floating action button. It springs in on mount, and
  setting `extended={false}` collapses it to an icon (the dashboard does this
  on scroll down).

Actions:
- **`Button`**: `filled` (default), `tonal`, `outlined`, `text`, `danger`.
  It is pill-shaped, at least 48dp tall, and supports an optional `icon` and
  a `loading` spinner.
- **`IconButton`**: `standard`, `tonal`, `filled`, with a 48dp touch target
  and an optional `badge` (`'lock'` for Pro-gated actions, `'dot'` for
  status).
- **`Touchable`**: the base pressable that everything above builds on.
  Android gets a ripple, and iOS gets a state-layer overlay.

Inputs:
- **`TextField`**: an M3 outlined field with an animated floating label, a
  `suffix` (units), `supportingText`, and an `error` that turns the outline
  red and replaces the supporting text. Pass `background` when the field
  sits on a tinted container, so the floating label's notch matches.
- **`DateField`**: the same shell, opening the native date picker
  (`DateTimePickerAndroid` on Android, an inline picker in a bottom sheet on
  iOS). Date strings round-trip through `src/lib/dates.ts`, which is
  timezone-safe.
- **`SegmentedButtons`**: 2–3 mutually exclusive options. The selected
  segment shows a check icon.
- **`ChipGroup`**: wrapping filter chips (currency, fuel type, chart mode).
  Pass no `value` to get suggestion chips (the reminder presets).
- **`SwitchItem`**: a full-row switch. The whole row is the touch target.

Content:
- **`ListGroup`** and **`ListItem`**: M3 lists in a rounded tonal group, with
  a leading icon (tinted by `leadingTone`), headline, supporting text, a
  trailing element, and an optional `destructive` style.
- **`SectionHeader`**, **`Card`** (`neutral`, `primary`, or `tertiary`
  tone), **`Badge`**.
- **`EmptyState`**: an icon, title, body and optional action, used whenever a
  list has no data.
- **`Message`** (`error`, `success`, `info`) and **`ErrorText`** (the error
  variant, which renders nothing when given no content). Both are announced
  to screen readers as alerts.

## Motion

All animation uses React Native's `Animated` API, because Reanimated is not
a dependency. Motion is kept short and functional: the floating label,
segmented and chip selection, the FAB entrance and collapse, the dashboard's
vehicle menu (scale and fade), the chart crossfade when switching modes, and
the skeleton pulse. Modal routes use `fade_from_bottom` on Android and the
native sheet on iOS.

## System navigation bar

Android draws the app edge-to-edge, and the gesture or 3-button bar can
report a bottom inset of 0 while still covering the bottom of the screen.
`useBottomInset()` (`src/theme.tsx`) therefore uses the real inset, with a
48dp floor on Android. `Screen` only insets the top and sides. Scroll
content uses `useScrollBottom()`, `BottomBar` pads itself, and the
dashboard's floating ad slot and FAB are positioned with `useBottomInset()`.
As a result, lists scroll behind the transparent bar, but nothing
interactive ever sits under it. `SafeAreaProvider` receives
`initialWindowMetrics` so the inset exists on the first frame.

## Keyboard

Form screens use `FormLayout` (`KeyboardAvoidingView` with
`behavior="padding"`, plus `keyboardShouldPersistTaps="handled"`), and
Settings wraps its scroll view the same way for the sign-in email field.
Validation errors are shown on the field they belong to, not as one
banner.

## Color-contrast rule for filled surfaces

Text on a filled surface always uses the matching **`on*` role**:
`onPrimary` on `primary`, `onPrimaryContainer` on `primaryContainer`,
`onTertiaryContainer` on `tertiaryContainer` (the amber PRO badge), and so on.
Never use `onSurface` there. In dark mode `primary` is a light blue and
`onPrimary` is a dark navy, which is the reverse of light mode. A hardcoded
white or a theme-flipping text color will fail contrast in one of the two
themes. If you add a new filled surface, pair it with its `on*` role.
