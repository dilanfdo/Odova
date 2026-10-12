// Local-calendar date helpers for YYYY-MM-DD strings.

// Deliberately NOT `d.toISOString().slice(0, 10)` — that converts to UTC
// first, which shifts the date backward by one day for anyone in a
// positive UTC offset (e.g. Sri Lanka, UTC+5:30) picking a date near
// midnight local time. Use local date components instead.
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// new Date('YYYY-MM-DD') parses as UTC midnight, which can render as the
// previous day in a negative-UTC-offset timezone — construct in local time.
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
