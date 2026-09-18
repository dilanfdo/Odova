// Central state for the garage: sync code, vehicles, active vehicle's fills.
// Mirrors the state machine in the web app's FuelTrackerClient.tsx. Account
// sign-in (AccountContext) is optional and orthogonal to this — being signed
// in only ever *offers* to restore an account-linked garage, it never
// silently replaces a garage already active in this session (see the boot
// effect and restoreFromAccount below for exactly where that line is drawn).
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import * as api from '../lib/api';
import { genCode, normaliseCode, type FillUp } from '../lib/fuel-utils';
import {
  getStoredCode, setStoredCode, clearStoredCode,
  getStoredCurrency, setStoredCurrency,
} from '../lib/storage';
import type { Vehicle } from '../lib/types';
import { DEFAULT_CURRENCY, normalizeCurrencyCode, type CurrencyCode } from '../lib/currencies';
import { useAccount } from './AccountContext';

export type Step = 'loading' | 'onboarding' | 'vehicle_setup' | 'main';

interface GarageContextValue {
  step: Step;
  userCode: string | null;
  currencyCode: CurrencyCode;
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  fills: FillUp[];
  dataLoading: boolean;
  error: string | null;

  startNewGarage: (nickname: string) => Promise<void>;
  useExistingCode: (code: string) => Promise<boolean>;
  restoreFromAccount: () => Promise<boolean>;
  addVehicle: (v: { make: string; model: string; year: string; fuelType: string; nickname: string }) => Promise<boolean>;
  setActiveVehicleId: (id: string) => void;
  addFill: (f: { fillDate: string; odometer: number; litres: number; pricePerLitre: number; isPartial: boolean; notes: string }) => Promise<boolean>;
  removeFill: (id: string) => Promise<void>;
  removeVehicle: (id: string) => Promise<void>;
  deleteAllData: () => Promise<void>;
  changeCurrency: (code: string) => Promise<void>;
  refreshFills: () => Promise<void>;
}

const GarageContext = createContext<GarageContextValue | null>(null);

export function GarageProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: accountLoading } = useAccount();
  const [step, setStep] = useState<Step>('loading');
  const [userCode, setUserCode] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [fills, setFills] = useState<FillUp[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards the automatic account-restore attempt below to run at most once —
  // it's only ever meant to answer "no local garage on this device yet, but
  // I'm signed in, do I have one in the cloud?", not to re-fire and clobber
  // whatever's active every time auth state changes later in the session.
  const accountRestoreAttempted = useRef(false);

  // ── Boot: restore sync code from device storage, then load its garage ──────
  useEffect(() => {
    if (accountLoading) return;
    let cancelled = false;
    (async () => {
      const [storedCode, storedCurrency] = await Promise.all([getStoredCode(), getStoredCurrency()]);
      if (cancelled) return;
      if (storedCurrency) setCurrencyCode(normalizeCurrencyCode(storedCurrency));

      if (!storedCode) {
        if (session && !accountRestoreAttempted.current) {
          accountRestoreAttempted.current = true;
          try {
            const account = await api.fetchAccountGarage();
            if (!cancelled && account.code && account.vehicles.length > 0) {
              await setStoredCode(account.code);
              setUserCode(account.code);
              setVehicles(account.vehicles);
              setActiveVehicleId(account.vehicles[0].id);
              setStep('main');
              return;
            }
          } catch {
            // fall through to onboarding — account restore is best-effort
          }
        }
        if (!cancelled) setStep('onboarding');
        return;
      }
      try {
        const { vehicles: list, locked } = await api.fetchVehicles(storedCode);
        if (cancelled) return;
        if (locked) {
          // Claimed by an account — the server already checked our session
          // (Bearer token, if signed in) and it doesn't own this garage.
          // Don't silently create a new vehicle under someone else's code;
          // drop back to onboarding with an honest explanation.
          await clearStoredCode();
          setError(
            session
              ? 'This garage is linked to a different account. Sign in with that account, or start a new garage below.'
              : 'This garage is linked to an account. Sign in to access it, or start a new garage below.'
          );
          setStep('onboarding');
          return;
        }
        setUserCode(storedCode);
        if (list.length > 0) {
          setVehicles(list);
          setActiveVehicleId(list[0].id);
          setStep('main');
        } else {
          setStep('vehicle_setup');
        }
      } catch {
        if (!cancelled) {
          setUserCode(storedCode);
          setStep('vehicle_setup');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [accountLoading, session]);

  // ── Fetch fills whenever the active vehicle changes ─────────────────────────
  const refreshFills = useCallback(async () => {
    if (!userCode || !activeVehicleId) return;
    setDataLoading(true);
    try {
      const list = await api.fetchFills(userCode, activeVehicleId);
      setFills(list);
    } catch {
      setFills([]);
    } finally {
      setDataLoading(false);
    }
  }, [userCode, activeVehicleId]);

  useEffect(() => { void refreshFills(); }, [refreshFills]);

  const startNewGarage = useCallback(async (nickname: string) => {
    const code = genCode(nickname.trim());
    await setStoredCode(code);
    setUserCode(code);
    setVehicles([]);
    setStep('vehicle_setup');
  }, []);

  const useExistingCode = useCallback(async (raw: string) => {
    const code = normaliseCode(raw);
    if (!code) return false;
    setError(null);
    try {
      const { vehicles: list, locked } = await api.fetchVehicles(code);
      if (locked) {
        setError(
          session
            ? 'This garage is linked to a different account. Sign in with that account to access it.'
            : 'This garage is linked to an account. Sign in to access it.'
        );
        return false;
      }
      if (list.length === 0) {
        setError('No garage found for that code. Check the full code including the suffix.');
        return false;
      }
      await setStoredCode(code);
      setUserCode(code);
      setVehicles(list);
      setActiveVehicleId(list[0].id);
      setStep('main');
      return true;
    } catch {
      setError('Could not connect. Please try again.');
      return false;
    }
  }, [session]);

  // Explicit, user-initiated switch to the signed-in account's garage — unlike
  // the boot-time auto-restore above, this can run at any time (e.g. a
  // "Restore from account" button in Settings) and deliberately requires a
  // deliberate call rather than firing on every auth-state change, so signing
  // in mid-session never silently swaps out a garage already in use.
  const restoreFromAccount = useCallback(async (): Promise<boolean> => {
    if (!session) return false;
    try {
      const account = await api.fetchAccountGarage();
      if (!account.code || account.vehicles.length === 0) return false;
      await setStoredCode(account.code);
      setUserCode(account.code);
      setVehicles(account.vehicles);
      setActiveVehicleId(account.vehicles[0].id);
      setFills([]);
      setStep('main');
      return true;
    } catch {
      return false;
    }
  }, [session]);

  const addVehicle = useCallback(async (v: { make: string; model: string; year: string; fuelType: string; nickname: string }) => {
    if (!userCode) return false;
    setError(null);
    try {
      const vehicle = await api.createVehicle(userCode, {
        make: v.make.trim(), model: v.model.trim(),
        year: v.year || null, fuelType: v.fuelType, nickname: v.nickname,
      });
      setVehicles((prev) => [...prev, vehicle]);
      setActiveVehicleId(vehicle.id);
      setStep('main');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save vehicle');
      return false;
    }
  }, [userCode]);

  const addFill = useCallback(async (f: { fillDate: string; odometer: number; litres: number; pricePerLitre: number; isPartial: boolean; notes: string }) => {
    if (!userCode || !activeVehicleId) return false;
    setError(null);
    try {
      const fill = await api.createFill(userCode, activeVehicleId, f);
      setFills((prev) => [...prev, fill].sort((a, b) =>
        new Date(a.fill_date).getTime() - new Date(b.fill_date).getTime() || a.odometer - b.odometer
      ));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save fill-up');
      return false;
    }
  }, [userCode, activeVehicleId]);

  const removeFill = useCallback(async (id: string) => {
    if (!userCode) return;
    await api.deleteFill(userCode, id);
    setFills((prev) => prev.filter((f) => f.id !== id));
  }, [userCode]);

  const removeVehicle = useCallback(async (id: string) => {
    if (!userCode) return;
    await api.deleteVehicle(userCode, id);
    setVehicles((prev) => {
      const next = prev.filter((v) => v.id !== id);
      if (activeVehicleId === id) setActiveVehicleId(next[0]?.id ?? null);
      return next;
    });
  }, [userCode, activeVehicleId]);

  const deleteAllData = useCallback(async () => {
    if (!userCode) return;
    await api.deleteAllGarageData(userCode);
    await clearStoredCode();
    setUserCode(null);
    setVehicles([]);
    setFills([]);
    setActiveVehicleId(null);
    setStep('onboarding');
  }, [userCode]);

  const changeCurrency = useCallback(async (code: string) => {
    const normalized = normalizeCurrencyCode(code);
    setCurrencyCode(normalized);
    await setStoredCurrency(normalized);
  }, []);

  const value = useMemo<GarageContextValue>(() => ({
    step, userCode, currencyCode, vehicles, activeVehicleId, fills, dataLoading, error,
    startNewGarage, useExistingCode, restoreFromAccount, addVehicle, setActiveVehicleId, addFill,
    removeFill, removeVehicle, deleteAllData, changeCurrency, refreshFills,
  }), [step, userCode, currencyCode, vehicles, activeVehicleId, fills, dataLoading, error,
    startNewGarage, useExistingCode, restoreFromAccount, addVehicle, addFill, removeFill, removeVehicle,
    deleteAllData, changeCurrency, refreshFills]);

  return <GarageContext.Provider value={value}>{children}</GarageContext.Provider>;
}

export function useGarage() {
  const ctx = useContext(GarageContext);
  if (!ctx) throw new Error('useGarage must be used within GarageProvider');
  return ctx;
}
