import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as entitlements from '../lib/entitlements';

interface EntitlementContextValue {
  isPro: boolean;
  loading: boolean;
  purchasePro: () => Promise<{ ok: boolean; error?: string }>;
  restorePurchases: () => Promise<boolean>;
  devClearPro: () => Promise<void>;
}

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    entitlements.getStoredIsPro().then((v) => {
      setIsPro(v);
      setLoading(false);
    });
  }, []);

  const purchasePro = useCallback(async () => {
    const result = await entitlements.purchasePro();
    if (result.ok) setIsPro(true);
    return result;
  }, []);

  const restorePurchases = useCallback(async () => {
    const result = await entitlements.restorePurchases();
    if (result.restored) setIsPro(true);
    return result.restored;
  }, []);

  const devClearPro = useCallback(async () => {
    await entitlements.devClearPro();
    setIsPro(false);
  }, []);

  return (
    <EntitlementContext.Provider value={{ isPro, loading, purchasePro, restorePurchases, devClearPro }}>
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlement() {
  const ctx = useContext(EntitlementContext);
  if (!ctx) throw new Error('useEntitlement must be used within EntitlementProvider');
  return ctx;
}
