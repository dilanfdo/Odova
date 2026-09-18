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
