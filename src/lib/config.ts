// The app is a client of the existing NDL web backend — it never talks to Supabase
// directly, so no service-role or anon key ever ships inside the APK.
// Override for local dev against `next dev` with EXPO_PUBLIC_API_BASE_URL in .env.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://nexusdigitallabs.dev';
