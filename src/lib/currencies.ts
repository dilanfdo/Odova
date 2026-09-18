// Ported verbatim from the NDL web app (nexusdigitallabs.github.io/src/lib/currencies.ts).

export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'LKR', symbol: 'Rs', label: 'Sri Lankan Rupee' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

const CODE_SET = new Set<string>(CURRENCIES.map((c) => c.code));

export function isCurrencyCode(value: string | null | undefined): value is CurrencyCode {
  return Boolean(value && CODE_SET.has(value));
}

export function normalizeCurrencyCode(
  value: string | null | undefined,
  fallback: CurrencyCode = DEFAULT_CURRENCY
): CurrencyCode {
  return isCurrencyCode(value) ? value : fallback;
}

export function currencyByCode(code: string | null | undefined) {
  const normalized = normalizeCurrencyCode(code);
  return CURRENCIES.find((c) => c.code === normalized) ?? CURRENCIES[0];
}
