import { afterEach, describe, expect, it } from 'vitest';
import { evalAmount, isExpression } from './calc';
import { COPY_KEYS, copy, pick } from './copy';
import { isDebtFree, makeParticles } from './confetti';
import { getPrefs, setPrefs } from './prefs';
import { oddsFor, pickIndex, secureRandomInt } from './whoPays';

describe('calculator', () => {
  it('adds, multiplies, handles k and brackets', () => {
    expect(evalAmount('500+250')).toBe(750);
    expect(evalAmount('1.5k')).toBe(1500);
    expect(evalAmount('2*300')).toBe(600);
    expect(evalAmount('(100+50)/3')).toBe(50);
    expect(evalAmount('1,250.50')).toBe(1250.5);
    expect(evalAmount('₹ 99')).toBe(99);
  });
  it('rejects junk, division by zero and negatives', () => {
    for (const bad of ['', 'abc', '5+', '5/0', '(5', '5)', '-5', '1..2', 'alert(1)', '5;6']) expect(evalAmount(bad)).toBeNull();
  });
  it('knows when to show the result', () => {
    expect(isExpression('500+250')).toBe(true);
    expect(isExpression('1.5k')).toBe(true);
    expect(isExpression('1500')).toBe(false);
  });
});

describe('microcopy', () => {
  afterEach(() => setPrefs({ fun: true }));
  it('every key has distinct plain and fun wording', () => {
    for (const k of COPY_KEYS) {
      expect(pick(k, false).length).toBeGreaterThan(0);
      expect(pick(k, true)).not.toBe(pick(k, false));
    }
  });
  it('turns plain when Fun mode is off and fills placeholders', () => {
    setPrefs({ fun: false });
    expect(getPrefs().fun).toBe(false);
    expect(copy('toast.settled', { amount: '₹10' })).toBe('Recorded ₹10 payment');
    setPrefs({ fun: true });
    expect(copy('toast.settled', { amount: '₹10' })).toContain('🎉');
  });
  it('never uses jokes for errors', () => {
    expect(COPY_KEYS.some((k) => /error|fail/i.test(k))).toBe(false);
  });
});

describe('confetti', () => {
  it('only celebrates when a group actually reached zero after having debts', () => {
    expect(isDebtFree({ a: 0, b: 0 }, true)).toBe(true);
    expect(isDebtFree({ a: 0, b: 0 }, false)).toBe(false);
    expect(isDebtFree({ a: 100, b: -100 }, true)).toBe(false);
    expect(isDebtFree({}, true)).toBe(false);
  });
  it('makes the requested number of particles', () => {
    expect(makeParticles(40, 400, 800)).toHaveLength(40);
  });
});

describe('who pays tonight', () => {
  const people = [
    { id: 'a', name: 'Asha', paidCents: 0 },
    { id: 'b', name: 'Bob', paidCents: 5000 },
    { id: 'c', name: 'Chai', paidCents: 10000 },
  ];
  it('gives the lowest payer up to twice the chance, and never zero', () => {
    const odds = oddsFor(people);
    expect(odds[0].weight).toBe(2);
    expect(odds[2].weight).toBe(1);
    expect(odds.every((o) => o.percent > 0)).toBe(true);
    expect(odds.reduce((s, o) => s + o.percent, 0)).toBeGreaterThanOrEqual(99);
  });
  it('is equal when nobody has paid yet', () => {
    expect(oddsFor(people.map((p) => ({ ...p, paidCents: 0 }))).map((o) => o.weight)).toEqual([1, 1, 1]);
  });
  it('maps rolls to people deterministically', () => {
    const odds = oddsFor(people); // weights 2000, 1500, 1000
    expect(pickIndex(odds, () => 0)).toBe(0);
    expect(pickIndex(odds, () => 1999)).toBe(0);
    expect(pickIndex(odds, () => 2000)).toBe(1);
    expect(pickIndex(odds, () => 4499)).toBe(2);
  });
  it('secure random stays in range', () => {
    for (let i = 0; i < 200; i++) {
      const n = secureRandomInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
    expect(secureRandomInt(1)).toBe(0);
  });
});
