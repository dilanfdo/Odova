# Known gaps

Deliberately deferred or not-yet-done items, kept in one place so they don't
get rediscovered from scratch. "Deferred" doesn't mean "forgotten" — it means
a judgment call was made that it isn't blocking, not that it was missed.

## Server-side Pro enforcement

`/api/fuel` trusts the client's Pro gating entirely. A RevenueCat webhook
already records verified entitlement status server-side
(`pro_entitlements` table, NDL repo), but nothing reads it to actually
enforce limits (e.g. blocking a free-tier account from creating a second
vehicle via a direct API call, bypassing the app UI). See
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
- Recurring maintenance reminders (e.g. "every 5,000 km", not just a single
  due date/odometer).
- Service history log (as distinct from a one-off reminder).
- Document vault (insurance/registration with expiry alerts).
