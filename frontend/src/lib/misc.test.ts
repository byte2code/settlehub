import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';
import { buildUpiLink } from './upi';
import { fromDateInput, timeAgo, toDateInput } from './dates';
import { convertCents } from './fx';

describe('toCsv', () => {
  it('quotes special characters and neutralises formulas', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"'], ['=SUM(A1)', '+1', 3]])).toBe('a,"b,c","say ""hi"""\r\n\'=SUM(A1),\'+1,3');
  });
});

describe('buildUpiLink', () => {
  it('builds a standard upi:// intent', () => {
    const link = buildUpiLink({ upiId: 'alice@okhdfc', payeeName: 'Alice D', amountCents: 123450, note: 'Goa trip' });
    expect(link).toBe('upi://pay?pa=alice%40okhdfc&pn=Alice+D&am=1234.50&cu=INR&tn=Goa+trip');
  });
});

describe('dates', () => {
  it('round-trips date inputs at local noon', () => {
    expect(toDateInput(fromDateInput('2026-03-09'))).toBe('2026-03-09');
  });

  it('describes relative time', () => {
    const now = Date.parse('2026-01-10T12:00:00Z');
    expect(timeAgo('2026-01-10T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2026-01-10T11:30:00Z', now)).toBe('30m ago');
    expect(timeAgo('2026-01-08T12:00:00Z', now)).toBe('2d ago');
  });
});

describe('convertCents', () => {
  it('rounds converted amounts to the cent', () => {
    expect(convertCents(10000, 83.4567)).toBe(834567);
    expect(convertCents(333, 1.5)).toBe(500);
  });
});
