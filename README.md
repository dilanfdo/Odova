# Odova

Cross-platform (Android-first) vehicle tracking app — Expo / React Native.

Ports the fuel-efficiency logic and data model from the
[NDL Fuel Tracker](../NDL/nexusdigitallabs.github.io/docs/tools/fuel-tracker.md) web
tool. Same backend, same Supabase schema, same sync-code identity model — this app
is a second client of `nexusdigitallabs.dev/api/fuel`, not a fork of the database.

## Why this architecture

- **No Supabase keys ship in the app.** RLS on `fuel_vehicles`/`fuel_fills` is
  hardened (`008_enable_rls_service_role_tables.sql`) so only the service-role key
  can touch those tables, and that key lives server-side only. The app calls the
  same `/api/fuel` REST endpoint the website's client component calls — see
  `src/lib/api.ts`.
- **`src/lib/fuel-utils.ts` and `src/lib/currencies.ts` are verbatim ports** of the
  web app's pure-TS files. No DOM dependency, so no changes were needed. Keep them
  in sync by hand if the web app's calc logic changes.
- **`/api/fuel` requires a trailing slash** — the site runs Next.js with
  `trailingSlash: true`; `src/lib/config.ts` / `src/lib/api.ts` already account for
  this (calling `/api/fuel` without it 308-redirects, which browsers block on
  preflight — not an issue for native `fetch`, which isn't subject to CORS at all).

## Scope (V1)

Sync-code-only — no account-link/claim flow yet. The web app's optional
"link this garage to your account" feature depends on Supabase Auth session
cookies via `@supabase/ssr`, which doesn't translate directly to a mobile bearer-
token flow. Phase 2 (see below) adds this properly instead of hacking around it.

## Project layout

```
src/
  lib/            fuel-utils, currencies, api client, reminders, notifications,
                   entitlements (Pro), AsyncStorage, config
  context/        GarageContext (sync code/vehicles/fills), EntitlementContext (Pro)
  navigation/     RootNavigator — swaps stacks based on GarageContext's `step`
  screens/        Onboarding, VehicleSetup, Dashboard, AddFill, AddVehicle,
                   Settings, Maintenance, AddReminder, Paywall
  components/     LineChart (react-native-svg port of the web SVG chart),
                   ProGate (soft-paywall wrapper), ui.tsx
  theme.ts        Ported NDL dark-theme color tokens
```

## Monetization: Pro entitlement

One-time purchase (no subscription). Free tier: 1 vehicle, local-only storage,
full fill-up logging and efficiency charts. Pro unlocks: unlimited vehicles,
maintenance reminders (date or odometer, with local notifications), CSV export,
and (Phase 2) cloud account sync.

**Soft-paywall pattern** — free users can see every Pro feature, not just a
locked menu item, so they know what they'd get: `ProGate`
(`src/components/ProGate.tsx`) renders the real feature UI dimmed underneath a
lock overlay with a description and an "Unlock with Pro" button that opens
`PaywallScreen`. See it on the Maintenance screen.

**Billing is not wired to Google Play yet** — `src/lib/entitlements.ts` is a
local simulation (AsyncStorage-backed) so the paywall UX could be built and
tested in Expo Go, where native IAP modules can't load at all (`react-native-iap`
needs a custom EAS dev client, not Expo Go). Settings has a `__DEV__`-only
"Simulate Pro purchase" toggle for testing the gated screens without going
through the real (not-yet-built) purchase flow. To wire up real billing:
1. Create a Google Play Developer account and the app entry, then a one-time
   product `odova_pro_unlock` in Play Console.
2. Add `react-native-iap`, build an EAS dev client (`eas build --profile
   development`), since Expo Go can't load it.
3. Replace the bodies of `purchasePro`/`restorePurchases` in
   `src/lib/entitlements.ts` with real `requestPurchase`/
   `getAvailablePurchases` calls — nothing else in the app needs to change.

## Maintenance reminders (Pro)

`src/lib/reminders.ts` — per-vehicle reminders stored locally on-device
(AsyncStorage), due by date or by odometer reading. Odometer-based status is
computed against the vehicle's latest logged fill-up odometer (`GarageContext`).
Date-based reminders schedule a local notification via `expo-notifications`
(`src/lib/notifications.ts`) for 9am on the due date — this works in Expo Go on
Android for local (non-push) notifications.

Not yet built: recurring reminders (e.g. "every 5,000 km"), service history log,
document vault (insurance/registration with expiry alerts) — see Phase 2.

## Running it

```bash
npm install
npm run android   # requires Android Studio + an emulator, or a device with Expo Go
npm run ios       # requires Xcode (macOS only)
npm run web       # quick visual check only — API calls will be CORS-blocked in a
                   # browser since /api/fuel has no Access-Control-Allow-Origin;
                   # this is expected and does not affect native builds
```

No `.env` is required for production use — `src/lib/config.ts` defaults to
`https://nexusdigitallabs.dev`. Copy `.env.example` to `.env` only to point at a
local `next dev` server.

## Verified end-to-end (2026-09-17)

Confirmed on a real Android emulator (Pixel 9a, Android 17, via Expo Go): full
onboarding → vehicle creation → fill-up logging → dashboard stats/chart/history
flow, all against the live production API (no mocks). Also confirmed via direct
HTTPS calls that create-vehicle, add-fill, and fetch-fills round-trip with
exactly the shapes `src/lib/api.ts` and `src/lib/fuel-utils.ts` expect.
`npx tsc --noEmit` and `npx expo-doctor` both pass clean.

Found and fixed one real bug in this pass: `DashboardScreen`'s header rendered
underneath the Android system status bar (missing safe-area top inset), which
made "Settings"/"+ Vehicle" untappable on a real device even though they looked
fine in the (safe-area-agnostic) web preview — fixed by wrapping screens in
`SafeAreaView` from `react-native-safe-area-context`.

## Play Store path

- `app.json` — `android.package` is set to `dev.nexusdigitallabs.odova`.
  **This is permanent once published to Play** — confirm before your first
  `eas submit`.
- Use [EAS Build](https://docs.expo.dev/build/introduction/) to produce the AAB
  without needing a local Android SDK: `npx eas build --platform android`.
- EAS Update gives OTA JS updates for bug fixes without a new store review.
- EAS Build's free tier: 15 Android + 15 iOS builds/month, low-priority queue.

## Phase 2 (not yet built)

- Real Google Play Billing wiring (see above)
- Account-link parity with the web app (bearer-token auth against `/api/fuel`,
  or a dedicated mobile auth endpoint) — needed before cloud sync of
  vehicles/reminders can ship
- Recurring maintenance reminders, service history log, document vault
  (insurance/registration with expiry alerts)
