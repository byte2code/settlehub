import { describe, expect, it } from 'vitest';
import { centsToInput, formatMoney, parseAmountToCents, splitEvenly, sumByCurrency } from './money';

describe('parseAmountToCents', () => {
  it('parses plain and grouped amounts', () => {
    expect(parseAmountToCents('12')).toBe(1200);
    expect(parseAmountToCents('1,234.5')).toBe(123450);
    expect(parseAmountToCents('.75')).toBe(75);
    expect(parseAmountToCents(19.99)).toBe(1999);
  });

  it('avoids floating point drift', () => {
    // Math.round(1.005 * 100) === 100 in JS; we want 101
    expect(parseAmountToCents('1.005')).toBe(101);
    expect(parseAmountToCents('0.29')).toBe(29);
  });

  it('rejects invalid input', () => {
    expect(parseAmountToCents('')).toBeNaN();
    expect(parseAmountToCents('abc')).toBeNaN();
    expect(parseAmountToCents('1.2.3')).toBeNaN();
    expect(parseAmountToCents('-5')).toBeNaN();
  });
});

describe('formatMoney', () => {
  it('formats with currency rules', () => {
    expect(formatMoney(123456, 'USD', { locale: 'en-US' })).toBe('$1,234.56');
    expect(formatMoney(-500, 'EUR', { locale: 'en-US' })).toBe('-€5.00');
    expect(formatMoney(250, 'USD', { locale: 'en-US', signed: true })).toBe('+$2.50');
  });

  it('shows zero-decimal currencies without decimals', () => {
    expect(formatMoney(123400, 'JPY', { locale: 'en-US' })).toBe('¥1,234');
    expect(centsToInput(123400, 'JPY')).toBe('1234');
  });
});

describe('splitEvenly', () => {
  it('distributes the remainder to the first people, like the server', () => {
    expect(splitEvenly(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEvenly(2, 5)).toEqual([1, 1, 0, 0, 0]);
    expect(splitEvenly(100, 0)).toEqual([]);
  });
});

describe('sumByCurrency', () => {
  it('never adds different currencies together', () => {
    expect(
      sumByCurrency([
        { currencyCode: 'INR', cents: 1000 },
        { currencyCode: 'USD', cents: 500 },
        { currencyCode: 'INR', cents: 250 },
      ]),
    ).toEqual({ INR: 1250, USD: 500 });
  });
});
