import { SUPPORTED_CURRENCIES, type CurrencyOption } from '../types';

export const DEFAULT_CURRENCY = 'INR';

export function getCurrencyOption(code?: string): CurrencyOption {
  if (!code) {
    return SUPPORTED_CURRENCIES.find((c) => c.code === DEFAULT_CURRENCY) || SUPPORTED_CURRENCIES[0];
  }
  const cleanCode = code.trim().toUpperCase();
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === cleanCode) || {
      code: cleanCode,
      symbol: cleanCode + ' ',
      name: cleanCode,
      flag: '🌐',
    }
  );
}

export function getCurrencySymbol(code?: string): string {
  return getCurrencyOption(code).symbol;
}

export function formatCurrency(cents: number, code?: string): string {
  const symbol = getCurrencySymbol(code);
  const isNegative = cents < 0;
  const abs = Math.abs(cents) / 100;
  
  // Clean 2-decimal formatting
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return isNegative ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

export function getStoredCurrency(): string {
  try {
    return localStorage.getItem('settlehub_currency') || DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export function setStoredCurrency(code: string): void {
  try {
    const clean = code.trim().toUpperCase();
    localStorage.setItem('settlehub_currency', clean);
    window.dispatchEvent(new CustomEvent('settlehub:currency-changed', { detail: clean }));
  } catch {
    // Ignore storage errors in restricted contexts
  }
}
