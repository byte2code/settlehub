import { describe, expect, it } from 'vitest';
import { wordsToDigits } from './numberWords';
import { parseQuickEntry } from './quickEntry';

describe('wordsToDigits', () => {
  it('converts spoken amounts', () => {
    expect(wordsToDigits('fifteen hundred')).toBe('1500');
    expect(wordsToDigits('two thousand five hundred')).toBe('2500');
    expect(wordsToDigits('twenty five')).toBe('25');
    expect(wordsToDigits('one lakh')).toBe('100000');
    expect(wordsToDigits('a thousand')).toBe('1000');
    expect(wordsToDigits('two thousand and fifty')).toBe('2050');
    expect(wordsToDigits('one point five')).toBe('1.5');
  });
  it('keeps everyday words that happen to be small numbers', () => {
    expect(wordsToDigits('dinner for one')).toBe('dinner for one');
    expect(wordsToDigits('no one paid')).toBe('no one paid');
    expect(wordsToDigits('table for five')).toBe('table for five');
    expect(wordsToDigits('a taxi')).toBe('a taxi');
  });
  it('keeps surrounding text and spacing', () => {
    expect(wordsToDigits('Dinner fifteen hundred paid by Rohan')).toBe('Dinner 1500 paid by Rohan');
    expect(wordsToDigits('taxi two hundred fifty rupees')).toBe('taxi 250 rupees');
  });
});

describe('spoken quick entry', () => {
  const members = [{ userId: 'r', name: 'Rohan Kumar' }, { userId: 'a', name: 'Asha Rao' }];
  it('fills amount, category and payer from speech', () => {
    expect(parseQuickEntry('Dinner fifteen hundred paid by Rohan', members)).toMatchObject({ amount: '1500', category: 'FOOD', payerId: 'r' });
    expect(parseQuickEntry('hotel two point five k Asha', members)).toMatchObject({ amount: '2500', category: 'STAY', payerId: 'a' });
  });
  it('does not guess when two members share a first name', () => {
    const twins = [{ userId: 'a', name: 'Rohan Kumar' }, { userId: 'b', name: 'Rohan Shah' }];
    const r = parseQuickEntry('Taxi 400 paid by Rohan', twins);
    expect(r.payerId).toBeUndefined();
    expect(r.ambiguousPayer).toBe('Rohan');
  });
});
