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
import { genCode, normaliseCode, friendlyError, type FillUp } from '../lib/fuel-utils';
import { getRevenueCatAppUserId } from '../lib/entitlements';
import type { Reminder, DueType } from '../lib/reminders';
import {
  getStoredCode, setStoredCode, clearStoredCode,
  getStoredCurrency, setStoredCurrency,
  getStoredUnitSystem, setStoredUnitSystem,
} from '../lib/storage';
import type { Vehicle } from '../lib/types';
import { DEFAULT_CURRENCY, normalizeCurrencyCode, type CurrencyCode } from '../lib/currencies';
import { normalizeUnitSystem, type UnitSystem } from '../lib/units';
import { useAccount } from './AccountContext';

export type Step = 'loading' | 'onboarding' | 'vehicle_setup' | 'main' | 'error';

interface GarageContextValue {
  step: Step;
  userCode: string | null;
  currencyCode: CurrencyCode;
  unitSystem: UnitSystem;
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  fills: FillUp[];
  reminders: Reminder[];
  dataLoading: boolean;
  error: string | null;

  startNewGarage: (nickname: string) => Promise<void>;
  useExistingCode: (code: string) => Promise<boolean>;
  restoreFromAccount: () => Promise<boolean>;
  addVehicle: (v: { make: string; model: string; year: string; fuelType: string; nickname: string }) => Promise<boolean>;
  updateVehicle: (id: string, v: { make: string; model: string; year: string; fuelType: string; nickname: string }) => Promise<boolean>;
  setActiveVehicleId: (id: string) => void;
  addFill: (f: { fillDate: string; odometer: number; litres: number; pricePerLitre: number; isPartial: boolean; notes: string }) => Promise<boolean>;
  updateFill: (id: string, f: { fillDate: string; odometer: number; litres: number; pricePerLitre: number; isPartial: boolean; notes: string }) => Promise<boolean>;
  removeFill: (id: string) => Promise<void>;
  removeVehicle: (id: string) => Promise<void>;
  deleteAllData: () => Promise<void>;
  changeCurrency: (code: string) => Promise<void>;
  changeUnitSystem: (system: UnitSystem) => Promise<void>;
  refreshFills: () => Promise<void>;
  retryBoot: () => void;
  addReminder: (r: {
    title: string; dueType: DueType; dueDate: string | null; dueOdometer: number | null; notes: string;
    recurrenceIntervalDays: number | null; recurrenceIntervalKm: number | null;
  }) => Promise<Reminder | null>;
  updateReminder: (id: string, r: {
    title: string; dueType: DueType; dueDate: string | null; dueOdometer: number | null; notes: string;
    recurrenceIntervalDays: number | null; recurrenceIntervalKm: number | null;
  }) => Promise<boolean>;
  completeReminder: (id: string) => Promise<void>;
  removeReminder: (id: string) => Promise<void>;
  refreshReminders: () => Promise<void>;
}

const GarageContext = createContext<GarageContextValue | null>(null);

export function GarageProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: accountLoading } = useAccount();
  const [step, setStep] = useState<Step>('loading');
  const [userCode, setUserCode] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [fills, setFills] = useState<FillUp[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards the automatic account-restore attempt below to run at most once —
  // it's only ever meant to answer "no local garage on this device yet, but
  // I'm signed in, do I have one in the cloud?", not to re-fire and clobber
  // whatever's active every time auth state changes later in the session.
  const accountRestoreAttempted = useRef(false);

  // Bumped by retryBoot() to force the boot effect below to re-run after a
  // failed fetch (e.g. no network at launch) — see its catch block, which
  // deliberately does NOT fall back to 'vehicle_setup' on a thrown error,
  // only on a genuinely empty vehicle list. Conflating "fetch failed" with
  // "you have zero vehicles" previously showed the add-first-vehicle screen
  // for a real, non-empty garage whenever the network hiccuped at launch —
  // confusing on its own, and one save-tap away from creating a duplicate
  // vehicle alongside the ones already on the server.
  const [bootAttempt, setBootAttempt] = useState(0);
  const retryBoot = useCallback(() => setBootAttempt((n) => n + 1), []);

  // ── Boot: restore sync code from device storage, then load its garage ──────
  useEffect(() => {
    if (accountLoading) return;
    let cancelled = false;
    if (bootAttempt > 0) { setStep('loading'); setError(null); }
    (async () => {
      const [storedCode, storedCurrency, storedUnitSystem] = await Promise.all([
        getStoredCode(), getStoredCurrency(), getStoredUnitSystem(),
      ]);
      if (cancelled) return;
      if (storedCurrency) setCurrencyCode(normalizeCurrencyCode(storedCurrency));
      if (storedUnitSystem) setUnitSystem(normalizeUnitSystem(storedUnitSystem));

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
      } catch (e) {
        // Don't guess "empty garage" from a network/server failure — that's
        // indistinguishable from a real, non-empty garage the app just
        // couldn't reach, and looks identical to the add-first-vehicle
        // screen. Surface it honestly instead, with a way to retry once
        // connectivity is back.
        if (!cancelled) {
          setUserCode(storedCode);
          setError(e instanceof Error ? friendlyError(e.message) : 'Could not load your garage.');
          setStep('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [accountLoading, session, bootAttempt]);

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

  // ── Fetch reminders whenever the active vehicle changes ─────────────────────
  const refreshReminders = useCallback(async () => {
    if (!userCode || !activeVehicleId) return;
    try {
      const list = await api.fetchReminders(userCode, activeVehicleId);
      setReminders(list);
    } catch {
      setReminders([]);
    }
  }, [userCode, activeVehicleId]);

  useEffect(() => { void refreshReminders(); }, [refreshReminders]);

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
      setReminders([]);
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
      const revenueCatAppUserId = await getRevenueCatAppUserId();
      const vehicle = await api.createVehicle(userCode, {
        make: v.make.trim(), model: v.model.trim(),
        year: v.year || null, fuelType: v.fuelType, nickname: v.nickname,
      }, revenueCatAppUserId);
      setVehicles((prev) => [...prev, vehicle]);
      setActiveVehicleId(vehicle.id);
      setStep('main');
      return true;
    } catch (e) {
      setError(e instanceof Error ? friendlyError(e.message) : 'Failed to save vehicle');
      return false;
    }
  }, [userCode]);

  const updateVehicle = useCallback(async (id: string, v: { make: string; model: string; year: string; fuelType: string; nickname: string }) => {
    if (!userCode) return false;
    setError(null);
    try {
      const vehicle = await api.updateVehicle(userCode, id, {
        make: v.make.trim(), model: v.model.trim(),
        year: v.year || null, fuelType: v.fuelType, nickname: v.nickname,
      });
      setVehicles((prev) => prev.map((existing) => (existing.id === id ? vehicle : existing)));
      return true;
    } catch (e) {
      setError(e instanceof Error ? friendlyError(e.message) : 'Failed to update vehicle');
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
      setError(e instanceof Error ? friendlyError(e.message) : 'Failed to save fill-up');
      return false;
    }
  }, [userCode, activeVehicleId]);

  const updateFill = useCallback(async (id: string, f: { fillDate: string; odometer: number; litres: number; pricePerLitre: number; isPartial: boolean; notes: string }) => {
    if (!userCode) return false;
    setError(null);
    try {
      const fill = await api.updateFill(userCode, id, f);
      setFills((prev) => prev.map((existing) => (existing.id === id ? fill : existing)).sort((a, b) =>
        new Date(a.fill_date).getTime() - new Date(b.fill_date).getTime() || a.odometer - b.odometer
      ));
      return true;
    } catch (e) {
      setError(e instanceof Error ? friendlyError(e.message) : 'Failed to update fill-up');
      return false;
    }
  }, [userCode]);

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

  const addReminder = useCallback(async (r: {
    title: string; dueType: DueType; dueDate: string | null; dueOdometer: number | null; notes: string;
    recurrenceIntervalDays: number | null; recurrenceIntervalKm: number | null;
  }) => {
    if (!userCode || !activeVehicleId) return null;
    setError(null);
    try {
      const reminder = await api.createReminder(userCode, activeVehicleId, r);
      setReminders((prev) => [...prev, reminder]);
      return reminder;
    } catch (e) {
      setError(e instanceof Error ? friendlyError(e.message) : 'Failed to save reminder');
      return null;
    }
  }, [userCode, activeVehicleId]);

  const updateReminder = useCallback(async (id: string, r: {
    title: string; dueType: DueType; dueDate: string | null; dueOdometer: number | null; notes: string;
    recurrenceIntervalDays: number | null; recurrenceIntervalKm: number | null;
  }) => {
    if (!userCode) return false;
    setError(null);
    try {
      const updated = await api.updateReminder(userCode, id, r);
      setReminders((prev) => prev.map((existing) => (existing.id === id ? updated : existing)));
      return true;
    } catch (e) {
      setError(e instanceof Error ? friendlyError(e.message) : 'Failed to update reminder');
      return false;
    }
  }, [userCode]);

  // Marking a recurring reminder done also creates its next occurrence
  // (due date/odometer advanced by the interval) — two sequential API calls
  // rather than one atomic server-side op (see 011_fuel_reminders.sql's
  // header comment for why: everything else in this schema is a plain
  // single-row mutation, and a dropped 2nd call here just means the user
  // re-adds one reminder, not silent data loss).
  const completeReminder = useCallback(async (id: string) => {
    if (!userCode || !activeVehicleId) return;
    const target = reminders.find((r) => r.id === id);
    if (!target) return;
    const completedAt = new Date().toISOString();
    try {
      const updated = await api.updateReminder(userCode, id, { completedAt });
      setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));

      if (target.recurrence_interval_days) {
        const next = new Date(target.due_date ?? completedAt);
        next.setDate(next.getDate() + target.recurrence_interval_days);
        const created = await api.createReminder(userCode, activeVehicleId, {
          title: target.title, dueType: 'date', dueDate: next.toISOString().slice(0, 10), dueOdometer: null,
          notes: target.notes ?? '', recurrenceIntervalDays: target.recurrence_interval_days, recurrenceIntervalKm: null,
        });
        setReminders((prev) => [...prev, created]);
      } else if (target.recurrence_interval_km && target.due_odometer !== null) {
        const created = await api.createReminder(userCode, activeVehicleId, {
          title: target.title, dueType: 'odometer', dueDate: null,
          dueOdometer: target.due_odometer + target.recurrence_interval_km,
          notes: target.notes ?? '', recurrenceIntervalDays: null, recurrenceIntervalKm: target.recurrence_interval_km,
        });
        setReminders((prev) => [...prev, created]);
      }
    } catch (e) {
      setError(e instanceof Error ? friendlyError(e.message) : 'Failed to update reminder');
    }
  }, [userCode, activeVehicleId, reminders]);

  const removeReminder = useCallback(async (id: string) => {
    if (!userCode) return;
    await api.deleteReminder(userCode, id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, [userCode]);

  const deleteAllData = useCallback(async () => {
    if (!userCode) return;
    await api.deleteAllGarageData(userCode);
    await clearStoredCode();
    setUserCode(null);
    setVehicles([]);
    setFills([]);
    setReminders([]);
    setActiveVehicleId(null);
    setStep('onboarding');
  }, [userCode]);

  const changeCurrency = useCallback(async (code: string) => {
    const normalized = normalizeCurrencyCode(code);
    setCurrencyCode(normalized);
    await setStoredCurrency(normalized);
  }, []);

  const changeUnitSystem = useCallback(async (system: UnitSystem) => {
    setUnitSystem(system);
    await setStoredUnitSystem(system);
  }, []);

  const value = useMemo<GarageContextValue>(() => ({
    step, userCode, currencyCode, unitSystem, vehicles, activeVehicleId, fills, reminders, dataLoading, error,
    startNewGarage, useExistingCode, restoreFromAccount, addVehicle, updateVehicle, setActiveVehicleId, addFill,
    updateFill, removeFill, removeVehicle, deleteAllData, changeCurrency, changeUnitSystem, refreshFills, retryBoot,
    addReminder, updateReminder, completeReminder, removeReminder, refreshReminders,
  }), [step, userCode, currencyCode, unitSystem, vehicles, activeVehicleId, fills, reminders, dataLoading, error,
    startNewGarage, useExistingCode, restoreFromAccount, addVehicle, updateVehicle, addFill, updateFill,
    removeFill, removeVehicle, deleteAllData, changeCurrency, changeUnitSystem, refreshFills, retryBoot,
    addReminder, updateReminder, completeReminder, removeReminder, refreshReminders]);

  return <GarageContext.Provider value={value}>{children}</GarageContext.Provider>;
}

export function useGarage() {
  const ctx = useContext(GarageContext);
  if (!ctx) throw new Error('useGarage must be used within GarageProvider');
  return ctx;
}
