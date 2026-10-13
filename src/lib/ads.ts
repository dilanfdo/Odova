// AdMob setup: gathers EEA/UK/Switzerland consent (Google's UMP requirement)
// before initializing the SDK, since ads must not be requested beforehand.
// Only ever called for free users — see AdBanner.tsx for the isPro gate.
import mobileAds, { AdsConsent, AdsConsentPrivacyOptionsRequirementStatus } from 'react-native-google-mobile-ads';

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

/**
 * Whether the user must be offered a way to revisit their ad-consent choices
 * (EEA/UK/Switzerland, where the consent form applies). Google's EU consent
 * policy expects a persistent entry point; elsewhere this is false and the
 * Settings row stays hidden.
 */
export async function isPrivacyOptionsRequired(): Promise<boolean> {
  try {
    const info = await AdsConsent.getConsentInfo();
    return info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch {
    return false;
  }
}

export async function showPrivacyOptions(): Promise<void> {
  try {
    await AdsConsent.showPrivacyOptionsForm();
  } catch (error) {
    console.warn('AdsConsent.showPrivacyOptionsForm failed:', error);
  }
}
