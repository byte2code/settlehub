/**
 * Exchange rates from Frankfurter (European Central Bank data): free, no API key, CORS-enabled.
 * Results are cached per day in memory; callers always allow a manual rate as a fallback.
 */
const cache = new Map<string, number>();

export async function fetchRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const key = `${from}->${to}:${new Date().toISOString().slice(0, 10)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`);
  if (!res.ok) throw new Error(`No exchange rate for ${from} → ${to}`);
  const data = (await res.json()) as { rates?: Record<string, number> };
  const rate = data.rates?.[to];
  if (!rate || !Number.isFinite(rate)) throw new Error(`No exchange rate for ${from} → ${to}`);
  cache.set(key, rate);
  return rate;
}

export function convertCents(cents: number, rate: number): number {
  return Math.round(cents * rate);
}
