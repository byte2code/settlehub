import { describe, expect, it } from 'vitest';
import { amountToCents, applyKey, type KeypadKey } from './keypad';

const press = (keys: KeypadKey[]) => keys.reduce(applyKey, '');

describe('keypad', () => {
  it('builds amounts without leading zeros', () => {
    expect(press(['0', '0', '5'])).toBe('5');
    expect(press(['4', '5', '0'])).toBe('450');
  });
  it('allows one decimal point and two decimals', () => {
    expect(press(['.', '5'])).toBe('0.5');
    expect(press(['1', '.', '2', '.', '3', '4', '9'])).toBe('1.23');
  });
  it('limits length and supports backspace', () => {
    expect(press(Array(10).fill('9') as KeypadKey[])).toBe('9999999');
    expect(press(['1', '2', 'back'])).toBe('1');
  });
  it('converts to cents', () => {
    expect(amountToCents('450')).toBe(45000);
    expect(amountToCents('0.1')).toBe(10);
    expect(amountToCents('')).toBe(0);
  });
});
