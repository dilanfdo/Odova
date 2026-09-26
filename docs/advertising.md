# Advertising

## What's shown, and to whom

A single banner ad (`src/components/AdBanner.tsx`), anchored at the bottom of
the Dashboard screen, shown only to free-tier users — it renders nothing at
all for Pro users (`useEntitlement().isPro` gate). Purchasing Pro removes it
immediately, no restart needed.

Deliberately a standard fixed banner (`BannerAdSize.BANNER`, 320×50) rather
than an adaptive/large banner format. The adaptive formats render taller
(closer to a quarter of the screen on some devices) and generally earn more
per impression, but were judged too intrusive for a small utility-app screen
with limited vertical space — a product/design trade-off, not a technical
limitation. If that trade-off ever gets revisited, it's a one-line change
(`size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}`), but the FAB clearance
logic in `DashboardScreen.tsx` already measures the banner's actual rendered
height dynamically (`onHeightChange`), so it doesn't need adjusting either
way.

## SDK: react-native-google-mobile-ads

Chosen because Expo's own `expo-ads-admob` package no longer exists — it was
removed from the Expo SDK, and `react-native-google-mobile-ads` (by
Invertase) is the current standard path, with its own Expo config plugin.

- `app.json`'s `plugins` array configures the Android App ID and
  `delayAppMeasurementInit: true` (delays sending user-level data to Google
  until after consent is gathered — see below).
- `src/lib/ads.ts` gathers consent and initializes the SDK once per app
  session (called from `App.tsx`).
- `src/components/AdBanner.tsx` renders the actual ad, gated by `isPro`, using
  Google's public test ad ID in any `__DEV__` build and the real ad unit ID
  in a production build.

**This module needs a native build — it does not work in Expo Go.** Any
change to the ad unit ID or App ID requires `npx expo prebuild` (to
regenerate the native project) followed by a fresh `expo run:android` /
`eas build`, the same way RevenueCat does.

## Consent (EEA / UK / Switzerland)

Google's EU User Consent Policy requires consent before using device/ad
identifiers to serve personalized ads to users in the EEA, UK, or
Switzerland. `src/lib/ads.ts` uses the SDK's `AdsConsent` helper
(`gatherConsent()` + `getConsentInfo()`) to request and check this before the
Mobile Ads SDK is initialized — mirroring Google's own recommended pattern of
attempting to start immediately with consent from a prior session in
parallel with re-gathering current consent, so returning users aren't held
up by a network round-trip. If consent gathering fails for any reason, ads
still load (using the SDK's own fallback to non-personalized ads where
appropriate) rather than silently breaking the free tier.

## A known upstream packaging bug (already worked around)

`react-native-google-mobile-ads` versions **17.1.0 and 17.2.0** fail to build
on Android when configured purely through the Expo config plugin (our exact
setup — `androidAppId` in `app.json`, no root-level
`"react-native-google-mobile-ads"` JSON key), with:

```
Cannot get property 'googleMobileAdsJson' on extra properties extension as it does not exist
```

This is a real regression in the library (a Gradle property that's only
guarded with `.has()` in some code paths and not others — see upstream issue
[invertase/react-native-google-mobile-ads#903](https://github.com/invertase/react-native-google-mobile-ads/issues/903)).
**Fix: pin the exact version `17.0.0`** (the last release before the
regression) in `package.json` — already done here. Don't casually bump this
dependency without checking whether upstream has actually fixed it; test a
real Android build before merging any version bump.

## What's set up vs. still a placeholder

- The AdMob **App ID** and a real **banner ad unit ID** were created for
  Odova and are wired into `app.json` / `AdBanner.tsx`.
- Odova is not yet published to the Play Store (Internal Testing only as of
  this writing), so the AdMob app entry was created manually (not linked to
  a live store listing) — link it once a public release ships, from AdMob's
  app settings; this is optional and doesn't block anything now.
- Real ads only ever get requested from a genuine release build (`__DEV__`
  false) — a dev/debug build always uses Google's test ad ID, by design,
  regardless of what's configured, since real impressions from a dev device
  count as invalid traffic under Google's policy.
