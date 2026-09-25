// Ported from the NDL web app (nexusdigitallabs.github.io/src/lib/fuel-utils.ts).
// Pure TS, no DOM dependency — kept in sync by hand since the two apps share one Supabase schema.
import { getRandomBytes } from 'expo-crypto';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface FillUp {
  id: string;
  vehicle_id: string;
  fill_date: string;
  odometer: number;
  litres: number;
  price_per_litre: number;
  is_partial: boolean;
  notes: string | null;
}

export interface FillStats {
  fill: FillUp;
  distance: number | null;
  l100km: number | null;
  kmpl: number | null;
  totalCost: number;
  costPerKm: number | null;
  isFirst: boolean;
}

// ── Sync code helpers ──────────────────────────────────────────────────────────
/**
 * 8-char suffix from expo-crypto's secure RNG (~36^8 ≈ 2.8e12 combinations) — the
 * sync code is a bearer secret (see the NDL web app's docs/tools/fuel-tracker.md),
 * so it must not be guessable. Mirrors nexusdigitallabs.github.io's genCode() —
 * same algorithm, Web Crypto there vs expo-crypto here since Hermes has no global
 * `crypto`. Do not swap this for `Math.random()`.
 */
export function genCode(nickname: string): string {
  const clean = nickname.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'mygarage';
  const bytes = getRandomBytes(8);
  const suffix = Array.from(bytes, (b) => (b % 36).toString(36)).join('');
  return `${clean}-${suffix}`.toLowerCase();
}

export function normaliseCode(raw: string): string {
  return raw.trim().toLowerCase();
}

// ── Formatting helpers ─────────────────────────────────────────────────────────
export function fmt(n: number, dp = 2): string {
  return n.toFixed(dp);
}

export function fmtCurrency(sym: string, n: number): string {
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Backend error translation ───────────────────────────────────────────────────
export function friendlyError(raw: string): string {
  const r = raw.toLowerCase();
  if (
    r.includes('unknownhostexception') || r.includes('network request failed') ||
    r.includes('fetch failed') || r.includes('failed to fetch') ||
    r.includes('econnrefused') || r.includes('etimedout') || r.includes('enotfound') ||
    r.includes('no address associated with hostname')
  ) {
    return 'No internet connection. Please check your connection and try again.';
  }
  if (r.includes('invalid api key') || r.includes('invalid_key') || r.includes('apikey')) {
    return 'Could not reach the data service. Please try again in a moment.';
  }
  if (r.includes('does not exist') || r.includes('42p01') || r.includes('relation')) {
    return 'Data service is temporarily unavailable. Please try again later.';
  }
  if (r.includes('jwt') || r.includes('unauthorized') || r.includes('401')) {
    return 'Authentication failed. Please sign in again and retry.';
  }
  return raw;
}

// ── Core efficiency calculations ───────────────────────────────────────────────

/**
 * Compute derived statistics for a sorted list of fill-ups.
 * - First fill is always isFirst=true with no efficiency data (no previous odometer).
 * - Partial fills are flagged but not used for efficiency calculations.
 * - Negative or zero distance between fills is treated as invalid.
 */
export function computeStats(fills: FillUp[]): FillStats[] {
  const sorted = [...fills].sort(
    (a, b) =>
      new Date(a.fill_date).getTime() - new Date(b.fill_date).getTime() ||
      a.odometer - b.odometer,
  );

  return sorted.map((fill, i) => {
    const totalCost = fill.litres * fill.price_per_litre;
    if (i === 0) {
      return { fill, distance: null, l100km: null, kmpl: null, totalCost, costPerKm: null, isFirst: true };
    }
    if (fill.is_partial) {
      return { fill, distance: null, l100km: null, kmpl: null, totalCost, costPerKm: null, isFirst: false };
    }
    const dist = fill.odometer - sorted[i - 1].odometer;
    if (dist <= 0 || fill.litres <= 0) {
      return { fill, distance: null, l100km: null, kmpl: null, totalCost, costPerKm: null, isFirst: false };
    }
    return {
      fill,
      distance: dist,
      l100km: (fill.litres / dist) * 100,
      kmpl: dist / fill.litres,
      totalCost,
      costPerKm: totalCost / dist,
      isFirst: false,
    };
  });
}
