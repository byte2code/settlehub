export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back';

/** Applies a keypad press to an amount string: at most 7 whole digits and 2 decimals, no leading zeros. */
export function applyKey(current: string, key: KeypadKey): string {
  if (key === 'back') return current.slice(0, -1);
  if (key === '.') return current.includes('.') ? current : (current || '0') + '.';
  const [whole, frac] = current.split('.');
  if (frac !== undefined) return frac.length >= 2 ? current : current + key;
  if (whole === '0') return key === '0' ? current : key;
  return whole.length >= 7 ? current : current + key;
}

export function amountToCents(amount: string): number {
  const n = Number(amount);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
