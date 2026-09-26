// AdMob setup: gathers EEA/UK/Switzerland consent (Google's UMP requirement)
// before initializing the SDK, since ads must not be requested beforehand.
// Only ever called for free users — see AdBanner.tsx for the isPro gate.
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';

let started = false;

async function start() {
  const { canRequestAds } = await AdsConsent.getConsentInfo();
  if (!canRequestAds || started) return;
  started = true;
  await mobileAds().initialize();
}

/**
 * Call once per app session. Re-gathers consent (it can expire or change)
 * while, in parallel, attempting to start using consent from a previous
 * session — mirrors Google's own recommended pattern so returning users
 * aren't held up by a network round-trip to reconfirm consent they already gave.
 */
export function initAds(): void {
  AdsConsent.gatherConsent()
    .then(start)
    .catch((error) => console.warn('AdsConsent.gatherConsent failed:', error));
  void start();
}
