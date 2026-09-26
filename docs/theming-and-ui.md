# Theming and shared UI

## Theme system

`src/theme.tsx` defines two full color palettes (`dark`, `light`) against a
single `ThemeColors` interface, so every screen reads semantic tokens
(`colors.bg`, `colors.surface`, `colors.accent`, ...) rather than hardcoded
hex values — a screen never needs to know which palette is active.

`ThemeModeProvider` tracks a **user-selectable mode** (`'light' | 'dark' |
'system'`), persisted via AsyncStorage so it survives app restarts, resolved
against the OS setting only when `'system'` is selected. This sits on top of
(not instead of) the OS-driven `useColorScheme()`, so picking "Light"
explicitly overrides a phone set to system dark mode, immediately, without
restarting the app. The control lives in Settings → Appearance.

Three things had to consume the *resolved* scheme, not just the OS one, for
the override to actually work everywhere:
- `useColors()` — the color values every screen renders with.
- `RootNavigator`'s React Navigation theme (nav bar chrome, header colors).
- `App.tsx`'s `<StatusBar>` icon style — otherwise picking "Light" while the
  OS is in dark mode would render a light background with light (OS-driven)
  status bar icons, invisible against it.

`useThemedStyles(makeStyles)` collapses the
`const colors = useColors(); const styles = useMemo(() => makeStyles(colors), [colors]);`
pair that used to be repeated at the top of every single screen/component
into one call — a mechanical de-duplication, not a behavior change.

## Shared components (`src/components/ui.tsx`)

These came out of an audit that found the same handful of UI patterns
re-implemented with near-identical (sometimes byte-for-byte identical) style
objects across several screens. Extracting them was about removing that
duplication, not adding new capability:

- **`ScreenHeader`** — the title + close (✕) row at the top of modal-style
  screens (Settings, AddFill, AddReminder, Maintenance, Paywall). Omit
  `title` for an X-only header (Paywall, the Add-Vehicle modal). Replaced
  what used to be a bottom "Close"/"Cancel" text link on every one of these
  screens.
- **`SegmentedControl`** — a single-row, joined-border control for a small
  (2–3 option) mutually-exclusive choice: Onboarding's mode tabs, Settings'
  theme mode. Renders the active option filled solid with `colors.accent`.
- **`ChipGroup`** — a wrapping row of individually-bordered pills, for a
  larger option set (currency, fuel type) or one-shot tap-to-fill
  suggestions (the maintenance-reminder presets) — pass no `value` and no
  pill ever shows as selected.
- **`Card`** — the bordered surface container used for most grouped content;
  accepts a `style` override for the rare screen that needs different
  padding or a border radius.
- **`ErrorText`** — a `Text` that renders nothing when its child is falsy,
  replacing the `{error ? <Text style={styles.error}>{error}</Text> : null}`
  pattern that was duplicated with an identical style object across four
  screens.
- **`CloseButton`** — the circular ✕ button `ScreenHeader` uses internally;
  exported separately for the one case (`VehicleSetupScreen`'s optional
  `onClose` prop) that needs it outside a full header row.

## A color-contrast rule worth knowing before adding a new filled surface

Text sitting on top of `colors.accent`-filled elements (fill-variant buttons,
the FAB, the segmented control's active state) uses `colors.onAccent`
(white) in both themes — not `colors.text`, which flips dark/light per theme
and would fail contrast against the always-blue accent fill. Text on
`colors.amber`-filled elements (the "PRO" badge) stays hardcoded dark
(`#0b0f19`) in both themes for the same reason, in the other direction —
amber is bright enough that dark text is the correct contrast choice
regardless of theme. If you add a new accent- or amber-filled surface, follow
whichever of these two patterns matches; don't default to `colors.text`.
