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

## Scope

Sync-code garage identity (as on web) plus an *optional* account layer: sign in
via magic link to claim a garage, so it restores by logging in instead of
retyping the code. Account sign-in never replaces the sync code — it's purely
additive, and everything works exactly as before if you never sign in.

The web app's account flow uses Supabase Auth session **cookies**
(`@supabase/ssr`), which a mobile app has no jar to share — so this app runs
its own Supabase Auth session (JWT, stored via `AsyncStorage`) and sends it as
an `Authorization: Bearer` header. `/api/fuel` on the NDL side accepts either:
cookie session (web) or Bearer token (mobile), same endpoints, same
`claim_fuel_garage`/`unlink_fuel_garage` RPCs — see that repo's
`route.ts` `getSignedInUserId()`.

## Project layout

```
src/
  lib/            fuel-utils, currencies, api client, reminders, notifications,
                   entitlements (Pro), supabase (Auth client), AsyncStorage, config
  context/        GarageContext (sync code/vehicles/fills),
                   EntitlementContext (Pro), AccountContext (sign-in/claim)
  navigation/     RootNavigator — swaps stacks based on GarageContext's `step`
  screens/        Onboarding, VehicleSetup, Dashboard, AddFill, AddVehicle,
                   Settings, Maintenance, AddReminder, Paywall
  components/     LineChart (react-native-svg port of the web SVG chart),
                   ProGate (soft-paywall wrapper), ui.tsx
  theme.ts        Ported NDL dark-theme color tokens
```

## Account sign-in (magic link)

`src/context/AccountContext.tsx` + `src/lib/supabase.ts`. Two real constraints
found by testing this live in Expo Go, not by reading docs — both fixed, worth
knowing if you touch this code:

- **PKCE flow doesn't work in Hermes.** Supabase JS defaults to `flowType:
  'pkce'`, which needs `crypto.subtle.digest` to hash the code verifier — not
  present in React Native's JS engine, confirmed live ("WebCrypto API is not
  supported"). Fixed by using `flowType: 'implicit'` instead, which returns
  `access_token`/`refresh_token` directly in the redirect URL's fragment (see
  `extractTokensFromUrl` in `AccountContext.tsx`) — no crypto primitive needed.
  A real polyfill (`react-native-quick-crypto` or similar) would let PKCE work,
  but needs a native build either way.
- **The Supabase project's Auth → URL Configuration → Redirect URLs allowlist
  needs the app's deep link added**, or the emailed link will be rejected when
  tapped even though *sending* it succeeds. `Linking.createURL('auth/callback')`
  produces a stable `odova://auth/callback` in a real build, but a **dynamic**
  `exp://<lan-ip>:<port>/--/auth/callback` in Expo Go (changes per machine/
  network) — so the full round trip (tap the email link, land back in the app
  signed in) is only reliably testable from an EAS dev/production build, not
  Expo Go. Sending the magic link itself, and everything after a session
  exists, was verified working in Expo Go; the deep-link callback itself
  wasn't (no test inbox access in this pass, plus the above).

## Monetization: Pro entitlement

One-time purchase (no subscription). Free tier: 1 vehicle, local-only storage,
full fill-up logging and efficiency charts. Pro unlocks: unlimited vehicles,
maintenance reminders (date or odometer, with local notifications), CSV export,
cloud account sync (see "Account sign-in" above).

**Soft-paywall pattern** — free users can see every Pro feature, not just a
locked menu item, so they know what they'd get: `ProGate`
(`src/components/ProGate.tsx`) renders the real feature UI dimmed underneath a
lock overlay with a description and an "Unlock with Pro" button that opens
`PaywallScreen`. See it on the Maintenance screen.

**Billing: RevenueCat (`react-native-purchases`), one integration for both
Google Play Billing and Apple StoreKit.** `src/lib/entitlements.ts` checks for
a configured API key (`config.ts`'s `REVENUECAT_API_KEY_ANDROID`/`_IOS`, both
empty by default — no RevenueCat project exists for Odova yet) and falls back
automatically to a local AsyncStorage-backed simulation when unset — so the
app, and Expo Go testing, keep working exactly as before with zero setup.
Settings has a `__DEV__`-only "Simulate Pro purchase" toggle for exercising
the gated screens either way. `react-native-purchases` is a native module and
throws if loaded in Expo Go the same way `expo-notifications` does — guarded
the same way (`isExpoGo` from `src/lib/platform.ts`, dynamic import), so it's
never even attempted there regardless of whether a key is set.

To go live:
1. Create the one-time `odova_pro_unlock` product in Play Console and App
   Store Connect.
2. Create a RevenueCat project, add both stores, create an entitlement (id:
   `pro`, matching `REVENUECAT_ENTITLEMENT_ID` in `config.ts`) mapped to that
   product on each store.
3. Set `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` / `_IOS` (RevenueCat dashboard
   → API keys). Once set, `entitlements.ts` automatically uses the real SDK —
   no other file needs to change.
4. Build with EAS (`eas build --profile development` to test, since Expo Go
   can't load this native module at all).
5. For server-side entitlement records (not required for the client gating
   above to work, but the prerequisite for ever enforcing Pro limits
   server-side instead of trusting the client — a gap the original security
   audit flagged): apply the NDL repo's
   `supabase/migrations/010_pro_entitlements.sql` (manually, via the Supabase
   SQL editor — see that repo's README for why this can't be scripted here),
   set `REVENUECAT_WEBHOOK_SECRET` there, and point a RevenueCat dashboard
   webhook at `/api/revenuecat-webhook`.

**Not live-tested** — unlike everything else in this README, this integration
couldn't be run end-to-end in this pass: it needs a Play Console/App Store
Connect/RevenueCat account (none exist yet) and a native build (Expo Go can't
load it). What *was* verified: every RevenueCat call site's argument and
return shapes were checked directly against the installed SDK's TypeScript
definitions (`node_modules/@revenuecat/purchases-typescript-internal`), the
whole file typechecks clean, and the automatic dev-simulation fallback was
exercised live on the Android emulator (Settings' Pro toggle, gated features
un/re-locking correctly) to confirm the fallback path — and by extension the
calling code in `EntitlementContext`/`PaywallScreen`/`SettingsScreen` — works.
The webhook endpoint *was* fully tested (auth, validation, event-type
handling, graceful failure) against a local dev server with synthetic
RevenueCat-shaped payloads and a Vitest suite (11 tests,
`src/app/api/revenuecat-webhook/__tests__/route.test.ts` in the NDL repo).

## Maintenance reminders (Pro)

`src/lib/reminders.ts` — per-vehicle reminders stored locally on-device
(AsyncStorage), due by date or by odometer reading. Odometer-based status is
computed against the vehicle's latest logged fill-up odometer (`GarageContext`).
Date-based reminders schedule a local notification via `expo-notifications`
(`src/lib/notifications.ts`) for 9am on the due date.

**`expo-notifications` must be imported lazily** (dynamic `import()` inside
each function, never at module top level) — confirmed live: a top-level import
crashed the app on *every launch* in Expo Go (not just when scheduling), because
Expo Go on SDK 53+ removed remote-push support and the package throws on import
there, and `notifications.ts` was transitively imported from `App.tsx` at boot.
`isExpoGo` (via `expo-constants`) short-circuits to a no-op in Expo Go entirely;
reminders still save correctly, just without an OS notification, until run from
a real EAS build.

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

## Verified end-to-end (2026-09-18)

Confirmed on a real Android emulator (Pixel 9a, Android 17, via Expo Go): full
onboarding → vehicle creation → fill-up logging → dashboard stats/chart/history
flow, all against the live production API (no mocks); Settings' new Account
section (email → magic-link send succeeds, correct success-state UI); Pro
soft-paywall gates (Maintenance, 2nd vehicle, CSV export) all correctly route
to the paywall for a free-tier user. Also confirmed via direct HTTPS calls
against the NDL production API, using a disposable real Supabase auth user,
that the full claim/unlock lifecycle works over a Bearer token exactly as it
does over the web app's cookie session: create → claim → locked for
non-owners → visible to the owner → restorable via `resource=account` →
unlink → open again, plus a malformed token degrading gracefully (`locked:
true`, not a 500). `npx tsc --noEmit` and `npx expo-doctor` both pass clean in
this repo; the NDL repo's 287 tests pass.

Found and fixed three real bugs in this pass, none of which would have shown
up without actually running the app:
1. `DashboardScreen`'s header rendered underneath the Android system status
   bar (missing safe-area top inset), making "Settings"/"+ Vehicle" silently
   untappable on a real device despite looking fine in the (safe-area-agnostic)
   web preview — fixed with `SafeAreaView` from `react-native-safe-area-context`.
2. A rate-limiter bug on the NDL side: read and write requests shared one
   per-IP budget, so a burst of reads could wrongly exhaust a user's write
   budget — fixed by keying them independently (see that repo's commit).
3. The two Expo Go constraints under "Account sign-in" above (notifications
   crash on boot; PKCE needs an absent WebCrypto primitive).

## Play Store path

- `app.json` — `android.package` is set to `dev.nexusdigitallabs.odova`.
  **This is permanent once published to Play** — confirm before your first
  `eas submit`.
- Use [EAS Build](https://docs.expo.dev/build/introduction/) to produce the AAB
  without needing a local Android SDK: `npx eas build --platform android`.
- EAS Update gives OTA JS updates for bug fixes without a new store review.
- EAS Build's free tier: 15 Android + 15 iOS builds/month, low-priority queue.

## Phase 2 (not yet built)

- Actually creating the Play Console/App Store Connect/RevenueCat accounts
  and products, and running an EAS build to test the real (non-simulated)
  purchase flow — the integration code is done (see Monetization above), this
  is account creation + a build, not a code change
- Server-side entitlement *enforcement* — `/api/fuel` currently trusts the
  client's Pro gating entirely (e.g. nothing stops a direct API call from
  creating a 2nd vehicle for a free-tier user). The webhook that *records*
  verified entitlement (`pro_entitlements` table) is built; nothing reads it
  to enforce limits yet
- Recurring maintenance reminders, service history log, document vault
  (insurance/registration with expiry alerts)
- iOS: same JS/TS codebase works unchanged (Supabase JS, AsyncStorage, and
  RevenueCat all support iOS natively) — remaining work is infrastructure
  only (Apple Developer account, App Store Connect product IDs, `eas build
  --platform ios`), not architecture
