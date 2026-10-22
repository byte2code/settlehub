/**
 * Money helpers. Every amount is an integer number of "cents" (minor units x100) for every
 * currency, matching the backend. Zero-decimal currencies (JPY, ...) are displayed without decimals.
 */

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  flag: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', flag: '🇮🇩' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', flag: '🇱🇰' },
  { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee', flag: '🇳🇵' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', flag: '🇲🇾' },
];

export const DEFAULT_CURRENCY = 'INR';

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'HUF', 'ISK']);

export function isZeroDecimal(code: string): boolean {
  return ZERO_DECIMAL.has(code.toUpperCase());
}

export function getCurrency(code?: string | null): CurrencyOption {
  const clean = (code || DEFAULT_CURRENCY).trim().toUpperCase();
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === clean) || { code: clean, symbol: clean, name: clean, flag: '🌐' }
  );
}

export function formatMoney(
  cents: number,
  code: string = DEFAULT_CURRENCY,
  options: { signed?: boolean; locale?: string } = {},
): string {
  const currency = code.toUpperCase();
  const digits = isZeroDecimal(currency) ? 0 : 2;
  const value = Math.abs(cents) / 100;
  let body: string;
  try {
    body = new Intl.NumberFormat(options.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    body = `${getCurrency(currency).symbol}${value.toFixed(digits)}`;
  }
  if (cents < 0) return `-${body}`;
  if (options.signed && cents > 0) return `+${body}`;
  return body;
}

/**
 * Parses user input like "1,234.5" into cents without floating point drift
 * ("1.005" -> 101, never 100.49999). Returns NaN for invalid input.
 */
export function parseAmountToCents(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return NaN;
  const text = String(input).trim().replace(/[,\s_]/g, '');
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[1] === '' && (match[2] ?? '') === '')) return NaN;
  const whole = match[1] === '' ? 0 : Number(match[1]);
  const fraction = (match[2] ?? '').padEnd(3, '0');
  const cents = whole * 100 + Number(fraction.slice(0, 2));
  return Number(fraction[2]) >= 5 ? cents + 1 : cents;
}

/** Cents -> plain editable string ("1234.50"), for prefilling inputs. */
export function centsToInput(cents: number, code: string = DEFAULT_CURRENCY): string {
  return (cents / 100).toFixed(isZeroDecimal(code) ? 0 : 2);
}

/** Splits cents evenly; the first participants absorb the remainder (mirrors the backend). */
export function splitEvenly(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Net totals per currency (for dashboards that mix groups in different currencies). */
export function sumByCurrency(items: { currencyCode: string; cents: number }[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of items) {
    totals[item.currencyCode] = (totals[item.currencyCode] || 0) + item.cents;
  }
  return totals;
}
