// Thin client for the NDL `/api/fuel` REST endpoint (same backend the web app uses).
// Mirrors nexusdigitallabs.github.io/src/components/tools/FuelTrackerClient.tsx's fetch calls.
import { API_BASE_URL } from './config';
import type { FillUp } from './fuel-utils';
import type { Vehicle } from './types';

// Trailing slash required — the NDL site runs Next.js with `trailingSlash: true`,
// so `/api/fuel` 308-redirects to `/api/fuel/`. Calling it directly avoids the
// extra hop (and avoids CORS-blocking that redirect in browser-based testing).
const FUEL_ENDPOINT = `${API_BASE_URL}/api/fuel/`;

// AccountContext registers a getter here once it mounts, so this module (which
// has no React context of its own) can attach the signed-in user's token to
// every request without every call site having to thread it through. No
// account/never signed in → getter returns null → header omitted, exactly
// today's anonymous sync-code-only behaviour.
let getAccessToken: () => string | null = () => null;
export function setAccessTokenGetter(getter: () => string | null): void {
  getAccessToken = getter;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(typeof json?.error === 'string' ? json.error : 'Request failed');
  }
  return json as T;
}

export interface VehiclesResult {
  vehicles: Vehicle[];
  /** True when this garage is claimed by an account and we're not signed in as
   * its owner — the server withholds real data in this case (see NDL's
   * `/api/fuel` route.ts). Odova has no account sign-in yet (Phase 2), so a
   * locked code cannot be used here at all — callers must not treat an empty
   * `vehicles` array as "safe to create a new vehicle under this code" without
   * checking this flag first, or they'd write into someone else's garage. */
  locked: boolean;
}

export async function fetchVehicles(code: string): Promise<VehiclesResult> {
  const json = await apiFetch<{ data: Vehicle[]; locked?: boolean }>(
    `${FUEL_ENDPOINT}?code=${encodeURIComponent(code)}&resource=vehicles`
  );
  return { vehicles: json.data ?? [], locked: Boolean(json.locked) };
}

export async function fetchFills(code: string, vehicleId: string): Promise<FillUp[]> {
  const json = await apiFetch<{ data: FillUp[] }>(
    `${FUEL_ENDPOINT}?code=${encodeURIComponent(code)}&resource=fills&vehicleId=${vehicleId}`
  );
  return json.data ?? [];
}

export async function createVehicle(
  code: string,
  vehicle: { make: string; model: string; year: string | null; fuelType: string; nickname: string }
): Promise<Vehicle> {
  const json = await apiFetch<{ data: Vehicle }>(FUEL_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ resource: 'vehicle', code, ...vehicle }),
  });
  return json.data;
}

export async function createFill(
  code: string,
  vehicleId: string,
  fill: {
    fillDate: string;
    odometer: number;
    litres: number;
    pricePerLitre: number;
    isPartial: boolean;
    notes: string;
  }
): Promise<FillUp> {
  const json = await apiFetch<{ data: FillUp }>(FUEL_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ resource: 'fill', code, vehicleId, ...fill }),
  });
  return json.data;
}

export async function deleteFill(code: string, id: string): Promise<void> {
  await apiFetch(FUEL_ENDPOINT, {
    method: 'DELETE',
    body: JSON.stringify({ resource: 'fill', id, code }),
  });
}

export async function deleteVehicle(code: string, id: string): Promise<void> {
  await apiFetch(FUEL_ENDPOINT, {
    method: 'DELETE',
    body: JSON.stringify({ resource: 'vehicle', id, code }),
  });
}

export async function deleteAllGarageData(code: string): Promise<void> {
  await apiFetch(FUEL_ENDPOINT, {
    method: 'DELETE',
    body: JSON.stringify({ resource: 'user', code }),
  });
}

export interface ClaimStatus {
  claimed: boolean;
  is_owner: boolean;
  signed_in: boolean;
}

export async function getClaimStatus(code: string): Promise<ClaimStatus> {
  return apiFetch<ClaimStatus>(`${FUEL_ENDPOINT}?code=${encodeURIComponent(code)}&resource=claim_status`);
}

export async function claimGarage(code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiFetch(FUEL_ENDPOINT, { method: 'POST', body: JSON.stringify({ resource: 'claim', code }) });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not link garage' };
  }
}

export async function unlinkGarage(code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiFetch(FUEL_ENDPOINT, { method: 'POST', body: JSON.stringify({ resource: 'unlink', code }) });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not unlink garage' };
  }
}

/** Restores the signed-in account's garage (no sync code required). */
export async function fetchAccountGarage(): Promise<{ code: string | null; vehicles: Vehicle[] }> {
  const json = await apiFetch<{ data: Vehicle[]; code: string | null }>(`${FUEL_ENDPOINT}?resource=account`);
  return { code: json.code, vehicles: json.data ?? [] };
}
