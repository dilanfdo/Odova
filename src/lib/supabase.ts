// Supabase Auth client — this is the ONLY thing in the app that talks to
// Supabase directly (garage/fuel data still goes through /api/fuel; see
// src/lib/api.ts). Uses the public anon key, matching the web app's browser
// client (src/lib/supabase/client.ts there) — same project, separate session
// storage (AsyncStorage here, cookies there), same auth.users table.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

// flowType: 'implicit', not 'pkce' — PKCE needs crypto.subtle.digest to hash
// the code_verifier, which doesn't exist in Hermes (confirmed live: "WebCrypto
// API is not supported" thrown from supabase-js on signInWithOtp). A polyfill
// (react-native-quick-crypto or similar) would need a native build anyway, so
// isn't available in Expo Go either. Implicit flow returns access_token/
// refresh_token directly in the redirect URL's fragment — see
// AccountContext's extractTokensFromUrl, no crypto primitive required.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
  },
});
