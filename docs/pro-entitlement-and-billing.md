# Pro entitlement and billing

## The offer

A single one-time purchase (`odova_pro_unlock`, $4.99 USD) — no subscription.
Free tier: 1 vehicle, local-only storage, full fill-up logging and efficiency
charts. Pro unlocks: unlimited vehicles, maintenance reminders (with local
notifications), CSV export, cloud account sync, and removes ads (see
[advertising.md](./advertising.md)).

## Soft-paywall pattern

Free users can *see* every Pro feature, dimmed, rather than a locked menu
item hiding it entirely — the idea being that a feature you never see is a
feature you never know to want. `src/components/ProGate.tsx` renders the real
feature UI underneath a lock overlay with a description and an "Unlock with
Pro" button that opens `PaywallScreen`. See it wrapping the Maintenance
screen — the screen's header (title + close) stays outside the gate so
there's always a way back, even when locked.

## Billing: RevenueCat

`react-native-purchases`, one integration covering both Google Play Billing
and Apple StoreKit, so `src/lib/entitlements.ts` doesn't need per-platform
billing code. Purchases and restores go through RevenueCat's SDK; RevenueCat
itself talks to each store's billing API.

`EntitlementContext` wraps `entitlements.ts` and exposes `isPro`,
`purchasePro()`, `restorePurchases()`, and (dev builds only) `devClearPro()`.
Every screen that gates a feature reads `isPro` from this context — nothing
calls RevenueCat directly outside `entitlements.ts`.

**Entitlement identity follows the account, not just the store login.**
`AccountContext` calls RevenueCat's `logIn`/`logOut` whenever the Supabase
session changes, so a Pro purchase made while signed in is tied to that
account — buy Pro on one device, sign in on another, and Pro is already
unlocked there too. Signed-out/anonymous users still get the standard
same-store-account restore behavior (`restorePurchases()`), so nothing
regresses for someone who never signs in.

**Dev-mode fallback.** If no RevenueCat API key is configured,
`entitlements.ts` automatically falls back to a local AsyncStorage-backed
simulation, so the app (and any Expo Go / dev-client testing) keeps working
with zero external setup. Settings has a `__DEV__`-only toggle
("Simulate Pro purchase" / "Clear Pro entitlement") for exercising gated
screens either way without a real transaction. This is also what makes it
possible to demo or test Pro-gated UI without needing store or RevenueCat
credentials on hand.

## What was set up to make this real (no keys or account identifiers below)

- A one-time product was created in the Play Console, matching
  `odova_pro_unlock`, priced and configured under the "Digital app sales" tax
  category.
- A RevenueCat project was created with an entitlement (id `pro`) mapped to
  that Play Console product. A Google Cloud service account with Play
  Developer API access was created and connected to RevenueCat so it can
  validate purchases server-side (this needs *both* "View financial data"
  *and* "Manage orders and subscriptions" permissions on the Play Console app
  — granting only one is a common setup mistake that fails validation
  silently until both are present).
- RevenueCat's Android API key was set as an EAS environment variable
  (`EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`), baked into the app at build
  time — never hardcoded in source.
- A real purchase was completed end-to-end on a physical device against the
  live product (Internal Testing track) to confirm the whole chain — Play
  Billing → RevenueCat → `EntitlementContext` → gated UI unlocking — works
  outside the local-simulation fallback.

## Server-side enforcement: not yet built

`/api/fuel` currently trusts the client's Pro gating entirely — nothing on
the backend stops a direct API call from creating a second vehicle for a
free-tier user. A RevenueCat webhook (`/api/revenuecat-webhook` in the NDL
repo) already records verified entitlement status into a `pro_entitlements`
table when a purchase event fires, but nothing reads that table to enforce
limits yet. This is the natural next step if server-side enforcement is ever
needed; see [known-gaps.md](./known-gaps.md).
