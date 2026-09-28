# Known gaps

Deliberately deferred or not-yet-done items, kept in one place so they don't
get rediscovered from scratch. "Deferred" doesn't mean "forgotten" — it means
a judgment call was made that it isn't blocking, not that it was missed.

## Server-side Pro enforcement (closed — `REVENUECAT_SECRET_API_KEY` is now set)

_Status update: the secret key described below has since been added to the NDL
repo's Vercel project, so the anonymous-garage check is live. Only a real EAS
build (with the RevenueCat SDK key baked in) can exercise it end to end — a
local dev build always uses the dev-simulation path and sends no RevenueCat id._


`/api/fuel` now checks entitlement before allowing a 2nd+ vehicle
(`hasProEntitlement` in the NDL repo's `route.ts`), instead of trusting the
client's gating entirely. It's fully enforced for **claimed** (signed-in)
garages via the `pro_entitlements` table, written by the RevenueCat webhook
— confirmed live in production (the webhook endpoint correctly 401s an
unauthenticated probe, meaning `REVENUECAT_WEBHOOK_SECRET` is already set).

For **anonymous** (not signed-in) garages — the common case, since accounts
are optional — enforcement calls RevenueCat's REST API directly with the
app's RevenueCat identity (Odova now sends `revenueCatAppUserId` on vehicle
creation; see `getRevenueCatAppUserId()` in `entitlements.ts`). This
requires one remaining ops step: add `REVENUECAT_SECRET_API_KEY` (RevenueCat
dashboard → Project Settings → API Keys → **Secret** key, not the public SDK
key already embedded in the app) to the NDL repo's Vercel project env vars.
Until that's set, the anonymous path fails open (doesn't block) by design —
see the code comment on `hasProEntitlement` for the full reasoning on why it
never blocks when it can't positively verify. See
[pro-entitlement-and-billing.md](./pro-entitlement-and-billing.md).

## R8/ProGuard minification

The native `android/app/build.gradle` references `enableMinifyInReleaseBuilds`
/ `enableShrinkResourcesInReleaseBuilds`, but neither is set in
`gradle.properties`, so release builds aren't currently minified/shrunk.
Deferred until after Pro and ads were fully wired up (to avoid debugging
minification-related crashes on top of everything else); now that both are
in place, this is a reasonable next thing to turn on — test a release build
thoroughly afterward, since R8 can occasionally strip something
reflection-based that isn't caught until runtime.

## iOS

`app.json` has an iOS bundle identifier, but no App Store Connect app, no
product IDs, and no `eas build --platform ios` has been run. The JS/TS
codebase is iOS-ready as-is (Supabase JS, AsyncStorage, RevenueCat, and
`react-native-google-mobile-ads` all support iOS natively) — what's missing
is infrastructure (Apple Developer account, App Store Connect setup, an iOS
AdMob App ID passed to the same config plugin), not architecture.

## Branded transactional email

The public contact address can send outbound mail but has no inbound
routing configured, so replies to it currently go nowhere. Not blocking
anything today since it's only referenced for support contact, but worth
fixing before it's advertised more prominently anywhere.

## Advertising: real ad unit exists but app isn't public yet

Covered in detail in [advertising.md](./advertising.md) — the short version
is that the AdMob app entry was created manually (not linked to a Play Store
listing, since Odova is Internal Testing only as of this writing) and should
be linked once a public release ships.

## Product features not yet built

Carried over from the original scope, still open:
- Service history log (as distinct from a one-off reminder) — needs a
  Supabase Storage bucket if it's ever paired with receipt/photo attachment,
  same as the document vault item below.
- Document vault (insurance/registration with expiry alerts) — needs a
  Supabase Storage bucket + upload/signed-URL API on `/api/fuel`, not yet
  designed.
- Realtime updates when two people share one sync code (currently
  refresh-on-load only). Deliberately not attempted casually: anonymous
  sync-code garages are intentionally *not* exposed via Supabase RLS (see
  `architecture.md`) — wiring live Realtime for them means either loosening
  that boundary or building a separate authorized-channel mechanism, a real
  design decision rather than a quick addition.
- Home-screen widget. Needs native Android/iOS widget code (Kotlin/Glance,
  Swift/WidgetKit) — outside what Expo's managed JS can add in one pass, and
  higher-risk to ship without real device iteration.
- Imperial-only gaps: UK gallons (imperial gallon, ~20% larger than the US
  gallon this app uses) aren't offered as a separate option — added only if
  there's real demand.

Resolved since first written:
- ~~Recurring maintenance reminders~~ — done (`recurrence_interval_days`/
  `recurrence_interval_km` on `fuel_reminders`).
- ~~Reminders don't sync across devices~~ — done, see architecture.md.
- ~~No imperial units~~ — done, see architecture.md.
