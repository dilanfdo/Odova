// Optional account sign-in (magic link), separate from the sync-code garage
// system in GarageContext — signing in never replaces a sync code, it just
// lets that garage be "claimed" so it can be restored via login instead of
// re-typing the code (mirrors the web app's account-link flow, reusing the
// same claim_fuel_garage/unlink_fuel_garage backend). See README "Phase 2"
// for what NOT yet built here (this ships the core flow, not every edge case
// the multi-thousand-line web client handles).
import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setAccessTokenGetter } from '../lib/api';

interface AccountContextValue {
  session: Session | null;
  loading: boolean;
  sendMagicLink: (email: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

// Implicit flow (see lib/supabase.ts for why) puts tokens in the redirect
// URL's fragment (#access_token=...&refresh_token=...), not its query string.
function extractTokensFromUrl(url: string): { access_token: string; refresh_token: string } | null {
  try {
    const parsed = new URL(url);
    const raw = parsed.hash ? parsed.hash.slice(1) : parsed.search.slice(1);
    const params = new URLSearchParams(raw);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) return null;
    return { access_token, refresh_token };
  } catch {
    return null;
  }
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAccessTokenGetter(() => session?.access_token ?? null);
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    async function handleUrl(url: string) {
      const tokens = extractTokensFromUrl(url);
      if (!tokens) return;
      await supabase.auth.setSession(tokens);
    }

    const linkSub = Linking.addEventListener('url', ({ url }) => { void handleUrl(url); });
    Linking.getInitialURL().then((url) => { if (url) void handleUrl(url); });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const redirectTo = Linking.createURL('auth/callback');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AccountContext.Provider value={{ session, loading, sendMagicLink, signOut }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within AccountProvider');
  return ctx;
}
