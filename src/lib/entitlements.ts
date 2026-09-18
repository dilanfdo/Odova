// Pro entitlement state + purchase flow.
//
// Uses real Google Play/App Store billing via RevenueCat when a project is
// configured (see config.ts's REVENUECAT_API_KEY_*); falls back automatically
// to a local AsyncStorage-backed simulation otherwise, so the paywall
// UI/UX works today in Expo Go, where react-native-purchases (a native
// module) can't load at all — same category of constraint as
// expo-notifications, see that file's header comment.
//
// To go live:
// 1. Create the one-time "odova_pro_unlock" product in Play Console and App
//    Store Connect.
// 2. Create a RevenueCat project, add both stores, create an entitlement
//    (id: REVENUECAT_ENTITLEMENT_ID in config.ts) mapped to that product on
//    each store.
// 3. Set EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID / _IOS (RevenueCat dashboard
//    → API keys). Once set, every function below automatically uses the
//    real SDK instead of the local simulation — no other file changes.
// 4. Build with EAS (`eas build --profile development` for testing, since
//    Expo Go can't load this native module at all).
// 5. Add the NDL repo's REVENUECAT_WEBHOOK_SECRET and point a RevenueCat
//    dashboard webhook at /api/revenuecat-webhook, for server-side
//    entitlement records (not required for this file's client gating to
//    work, but the prerequisite for ever enforcing Pro limits server-side).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { isExpoGo } from './platform';
import { REVENUECAT_API_KEY_ANDROID, REVENUECAT_API_KEY_IOS, REVENUECAT_ENTITLEMENT_ID } from './config';

const PRO_KEY = 'odova_is_pro';

export const PRO_PRODUCT_ID = 'odova_pro_unlock';
export const PRO_PRICE_DISPLAY = '$4.99';

function currentApiKey(): string {
  return Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
}

function useRevenueCat(): boolean {
  return Boolean(currentApiKey()) && !isExpoGo;
}

let configured = false;
async function loadPurchases() {
  const Purchases = (await import('react-native-purchases')).default;
  if (!configured) {
    configured = true;
    Purchases.configure({ apiKey: currentApiKey() });
  }
  return Purchases;
}

/** Ties the RevenueCat identity to the signed-in Supabase account, so a
 * purchase follows the account rather than just the store login/device —
 * call from AccountContext when a session appears. No-ops when RevenueCat
 * isn't configured (dev sim) or unavailable (Expo Go). */
export async function linkEntitlementToAccount(supabaseUserId: string): Promise<void> {
  if (!useRevenueCat()) return;
  try {
    const Purchases = await loadPurchases();
    await Purchases.logIn(supabaseUserId);
  } catch {
    /* best-effort */
  }
}

/** Call from AccountContext on sign-out. */
export async function unlinkEntitlementFromAccount(): Promise<void> {
  if (!useRevenueCat()) return;
  try {
    const Purchases = await loadPurchases();
    await Purchases.logOut();
  } catch {
    /* best-effort */
  }
}

export async function getStoredIsPro(): Promise<boolean> {
  if (useRevenueCat()) {
    try {
      const Purchases = await loadPurchases();
      const info = await Purchases.getCustomerInfo();
      return Boolean(info.entitlements.active[REVENUECAT_ENTITLEMENT_ID]);
    } catch {
      return false;
    }
  }
  try {
    return (await AsyncStorage.getItem(PRO_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function purchasePro(): Promise<{ ok: boolean; error?: string }> {
  if (useRevenueCat()) {
    try {
      const Purchases = await loadPurchases();
      const offerings = await Purchases.getOfferings();
      const pkg =
        offerings.current?.availablePackages.find((p) => p.product.identifier === PRO_PRODUCT_ID) ??
        offerings.current?.availablePackages[0];
      if (!pkg) return { ok: false, error: 'Pro is not available right now. Please try again later.' };

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const active = Boolean(customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]);
      return active ? { ok: true } : { ok: false, error: 'Purchase did not complete.' };
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (err.userCancelled) return { ok: false };
      return { ok: false, error: err.message ?? 'Purchase failed' };
    }
  }
  // Dev-mode simulation — see file header.
  await AsyncStorage.setItem(PRO_KEY, 'true');
  return { ok: true };
}

export async function restorePurchases(): Promise<{ ok: boolean; restored: boolean }> {
  if (useRevenueCat()) {
    try {
      const Purchases = await loadPurchases();
      const info = await Purchases.restorePurchases();
      return { ok: true, restored: Boolean(info.entitlements.active[REVENUECAT_ENTITLEMENT_ID]) };
    } catch {
      return { ok: false, restored: false };
    }
  }
  const isPro = await getStoredIsPro();
  return { ok: true, restored: isPro };
}

/** Dev-only: lets the Settings screen flip entitlement off again for testing the local simulation. */
export async function devClearPro(): Promise<void> {
  await AsyncStorage.removeItem(PRO_KEY);
}
