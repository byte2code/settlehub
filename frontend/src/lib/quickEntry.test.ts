import { describe, expect, it } from 'vitest';
import { parseQuickEntry } from './quickEntry';

const members = [
  { userId: 'a', name: 'Alice Demo' },
  { userId: 'b', name: 'Bob Builder' },
];

describe('parseQuickEntry', () => {
  it('extracts amount, category, payer and description', () => {
    expect(parseQuickEntry('Seafood dinner at Brittos 1500 paid by Alice', members)).toEqual({
      amount: '1500',
      category: 'FOOD',
      payerId: 'a',
      description: 'Seafood dinner Brittos',
    });
  });

  it('understands k suffix, grouping and decimals', () => {
    expect(parseQuickEntry('hotel 2.5k', members).amount).toBe('2500');
    expect(parseQuickEntry('Flight ₹12,499.50 Bob', members)).toMatchObject({ amount: '12499.5', category: 'TRANSPORT', payerId: 'b' });
  });

  it('returns nothing for empty input and leaves unknown text as description', () => {
    expect(parseQuickEntry('   ', members)).toEqual({});
    expect(parseQuickEntry('random thing', members)).toEqual({ description: 'Random thing' });
  });
});
