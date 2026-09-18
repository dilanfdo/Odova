// The app is a client of the existing NDL web backend for garage data — it never
// sends the Supabase *service-role* key, so nothing that could bypass RLS ships
// inside the APK. It does talk to Supabase Auth directly (see src/lib/supabase.ts)
// using the *anon* key below, which is safe to embed by design (RLS-enforced) —
// the same key the web app exposes as NEXT_PUBLIC_SUPABASE_ANON_KEY.
// Override for local dev against `next dev` with EXPO_PUBLIC_API_BASE_URL in .env.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://nexusdigitallabs.dev';

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://bxahenpmglfianhlokli.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4YWhlbnBtZ2xmaWFuaGxva2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5Mjg3MTIsImV4cCI6MjA5OTUwNDcxMn0.jIh-VHNzfuJZGdj8rd9BkvDViksdamePvLGWvjqnb_s';

// RevenueCat public SDK keys — like the Supabase anon key above, these are
// meant to be embedded client-side (they only ever identify the app to
// RevenueCat, never authorize a purchase on their own). Empty by default:
// no RevenueCat project has been created for Odova yet. entitlements.ts
// checks for an empty key and falls back to the local dev-simulation
// automatically, so the app (and Expo Go testing) keeps working exactly as
// today until these are set. Get real values from the RevenueCat dashboard
// (Project settings → API keys) once Play Console/App Store Connect
// products exist for them to wrap.
export const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '';
export const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';

// One entitlement ("pro") mapped in the RevenueCat dashboard to a product on
// each store — see src/lib/entitlements.ts's header comment for the full
// wiring steps. Must match whatever entitlement identifier is actually
// configured there; this is not a secret, just needs to match.
export const REVENUECAT_ENTITLEMENT_ID = 'pro';
