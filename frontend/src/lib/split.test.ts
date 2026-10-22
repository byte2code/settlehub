import { describe, expect, it } from 'vitest';
import { validateSplit, type SplitFormState } from './split';

const base: SplitFormState = {
  totalCents: 3000,
  currency: 'USD',
  method: 'EQUAL',
  multiPayer: false,
  payerAmounts: { a: '', b: '' },
  selected: { a: true, b: true, c: false },
  exactAmounts: { a: '', b: '' },
  percentages: { a: '50', b: '50' },
};

describe('validateSplit', () => {
  it('needs an amount', () => {
    expect(validateSplit({ ...base, totalCents: 0 }).valid).toBe(false);
  });

  it('equal split needs at least one person', () => {
    expect(validateSplit(base).valid).toBe(true);
    expect(validateSplit({ ...base, selected: { a: false } }).valid).toBe(false);
  });

  it('exact amounts must add up to the cent', () => {
    expect(validateSplit({ ...base, method: 'EXACT', exactAmounts: { a: '10', b: '20' } }).valid).toBe(true);
    const short = validateSplit({ ...base, method: 'EXACT', exactAmounts: { a: '10', b: '19.99' } });
    expect(short.valid).toBe(false);
    expect(short.message).toContain('left to split');
  });

  it('percentages must total 100 within tolerance', () => {
    expect(validateSplit({ ...base, method: 'PERCENT', percentages: { a: '33.33', b: '66.67' } }).valid).toBe(true);
    expect(validateSplit({ ...base, method: 'PERCENT', percentages: { a: '50', b: '40' } }).valid).toBe(false);
  });

  it('multiple payers must cover the total', () => {
    expect(validateSplit({ ...base, multiPayer: true, payerAmounts: { a: '10', b: '20' } }).valid).toBe(true);
    expect(validateSplit({ ...base, multiPayer: true, payerAmounts: { a: '10', b: '25' } }).message).toContain('exceed');
  });
});
