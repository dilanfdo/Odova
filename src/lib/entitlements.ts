// Pro entitlement state + purchase flow.
//
// This is the ONLY file that needs to change to wire up real Google Play
// Billing. Today `purchasePro()` is a local simulation (persisted to
// AsyncStorage) so the paywall UI/UX can be built and tested in Expo Go,
// where native IAP modules cannot load at all. Swapping in real billing
// means: add `react-native-iap` (needs an EAS dev client — it will not run
// in Expo Go), create the "odova_pro" one-time product in Play Console, and
// replace the body of `purchasePro`/`restorePurchases` below with the real
// `requestPurchase`/`getAvailablePurchases` calls. Nothing outside this file
// (ProGate, PaywallScreen, entitlement checks) needs to change.
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRO_KEY = 'odova_is_pro';

export const PRO_PRODUCT_ID = 'odova_pro_unlock';
export const PRO_PRICE_DISPLAY = '$4.99';

export async function getStoredIsPro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PRO_KEY)) === 'true';
  } catch {
    return false;
  }
}

/** Dev-mode purchase simulation — see file header. Always "succeeds". */
export async function purchasePro(): Promise<{ ok: true }> {
  await AsyncStorage.setItem(PRO_KEY, 'true');
  return { ok: true };
}

/** Dev-mode restore simulation — mirrors whatever purchasePro last set. */
export async function restorePurchases(): Promise<{ ok: boolean; restored: boolean }> {
  const isPro = await getStoredIsPro();
  return { ok: true, restored: isPro };
}

/** Dev-only: lets the Settings screen flip entitlement off again for testing. */
export async function devClearPro(): Promise<void> {
  await AsyncStorage.removeItem(PRO_KEY);
}
