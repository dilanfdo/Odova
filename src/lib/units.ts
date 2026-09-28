// Storage and the API are always metric (km, litres) — this is purely a
// presentation-layer concern, so no backend changes are needed for this
// feature. Every screen that shows or accepts a distance/volume/efficiency
// value converts at the edge: parse user input in the display unit → convert
// to metric before calling addFill/updateFill/addReminder; convert stored
// metric values → display unit for anything shown on screen.
//
// "Imperial" here means the US system (miles, US gallons, mpg) — the most
// common ask and what most non-metric users expect by default. UK gallons
// differ (~20% larger) and could be added as a third option later if there's
// real demand; not built now to avoid a system nobody asked for.

export type UnitSystem = 'metric' | 'imperial';

const KM_PER_MILE = 1.609344;
const LITRES_PER_US_GALLON = 3.785411784;

export function normalizeUnitSystem(raw: string | null | undefined): UnitSystem {
  return raw === 'imperial' ? 'imperial' : 'metric';
}

// ── Distance (odometer / trip length) ───────────────────────────────────────

export function kmToDisplayDistance(km: number, system: UnitSystem): number {
  return system === 'imperial' ? km / KM_PER_MILE : km;
}

export function displayDistanceToKm(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value * KM_PER_MILE : value;
}

export function distanceUnitLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'mi' : 'km';
}

// ── Volume (fuel litres / gallons) ──────────────────────────────────────────

export function litresToDisplayVolume(litres: number, system: UnitSystem): number {
  return system === 'imperial' ? litres / LITRES_PER_US_GALLON : litres;
}

export function displayVolumeToLitres(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value * LITRES_PER_US_GALLON : value;
}

export function volumeUnitLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'gal' : 'L';
}

// ── Price per unit volume ───────────────────────────────────────────────────

/** Metric stores price per litre; imperial displays price per US gallon. */
export function pricePerLitreToDisplay(pricePerLitre: number, system: UnitSystem): number {
  return system === 'imperial' ? pricePerLitre * LITRES_PER_US_GALLON : pricePerLitre;
}

export function displayPriceToPerLitre(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value / LITRES_PER_US_GALLON : value;
}

// ── Efficiency ───────────────────────────────────────────────────────────────

/** km/L → mpg (US) is the same "higher is better" direction as km/L, so
 * imperial mode shows one figure (mpg) instead of metric's two (km/L and
 * L/100km) — there's no common imperial analogue people look for for the
 * second one. */
export function kmplToMpg(kmpl: number): number {
  // mpg = (km/L) × (mi/km) × (L/gal) = kmpl ÷ KM_PER_MILE × LITRES_PER_US_GALLON
  return kmpl * (LITRES_PER_US_GALLON / KM_PER_MILE);
}

export function efficiencyUnitLabel(system: UnitSystem): string {
  return system === 'imperial' ? 'mpg' : 'km/L';
}

export function costPerKmToDisplay(costPerKm: number, system: UnitSystem): number {
  return system === 'imperial' ? costPerKm * KM_PER_MILE : costPerKm;
}

export function costPerDistanceUnitLabel(system: UnitSystem): string {
  return system === 'imperial' ? '/mi' : '/km';
}
